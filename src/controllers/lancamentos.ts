import { Request, Response } from 'express';
import { Prisma } from 'generated/prisma/client';

interface LancamentosQuery {
  usuario_id?: string;
  cargo?: string;
}

interface PostLancamentoBody {
  usuario_id: number | string;
  projeto_id: number | string;
  atividade_id: number | string;
  cliente_id: number | string;
  data: string;
  hora_inicio: string;
  hora_fim: string;
  descricao?: string;
  tipo_lancamento?: string;
}

interface PutLancamentoBody {
  projeto_id: number | string;
  atividade_id: number | string;
  cliente_id?: number | string;
  data_lancamento: string;
  hora_inicio: string;
  hora_fim: string;
  descricao?: string;
  motivo_edicao?: string;
}

interface PatchStatusBody {
  status: string;
  cargo: string;
}

export const getLancamentos = async (
  req: Request<{}, {}, {}, LancamentosQuery>,
  res: Response
): Promise<void> => {
  const { usuario_id, cargo } = req.query;

  try {
    let whereClause: Prisma.lancamentos_de_horasWhereInput = {};

    if (cargo !== 'gerente' && usuario_id) {
      const usuario = await global.prisma.usuarios.findUnique({
        where: { usuario_id: Number(usuario_id) },
        select: { colaborador_id: true }
      });
      if (usuario?.colaborador_id) {
        whereClause.colaborador_id = usuario.colaborador_id;
      }
    }

    const lancamentos = await global.prisma.lancamentos_de_horas.findMany({
      where: whereClause,
      include: {
        colaboradores: { select: { nome_colaborador: true } },
        projetos: { select: { nome_projeto: true } },
        clientes: { select: { nome_cliente: true } },
        atividades: { select: { nome_atividade: true } }
      },
      orderBy: { data_lancamento: 'desc' }
    });

    const formatados = lancamentos.map(item => ({
      ...item,
      data: item.data_lancamento,
    }));

    res.status(200).json(formatados);
  } catch (error) {
    res.status(500).json({ error: 'Erro ao listar horas.' });
  }
};

export const postLancamentos = async (
  req: Request<{}, {}, PostLancamentoBody>,
  res: Response
): Promise<void> => {
  const {
    usuario_id, projeto_id, atividade_id, cliente_id,
    data, hora_inicio, hora_fim, descricao, tipo_lancamento
  } = req.body;

  try {
    // Validação de Data Futura
    const dataLancamentoLocal = new Date(`${data}T00:00:00`);
    const hoje = new Date();
    hoje.setHours(0, 0, 0, 0);

    if (dataLancamentoLocal > hoje) {
      res.status(400).json({ error: "Não é permitido lançar horas em datas futuras." });
      return;
    }

    // Buscar o usuário e colaborador
    if (!usuario_id) {
      res.status(400).json({ error: "ID do usuário não fornecido." });
      return;
    }

    const usuarioExistente = await global.prisma.usuarios.findUnique({
      where: { usuario_id: Number(usuario_id) },
      select: { colaborador_id: true }
    });

    if (!usuarioExistente) {
      res.status(404).json({ error: "Usuário não encontrado." });
      return;
    }

    if (!usuarioExistente.colaborador_id) {
      res.status(400).json({ error: "Este usuário não possui um colaborador vinculado." });
      return;
    }

    const colabId = usuarioExistente.colaborador_id;

    // Preparação dos horários para comparação
    const inicioDate = new Date(`${data}T${hora_inicio}:00Z`);
    const fimDate = new Date(`${data}T${hora_fim}:00Z`);
    const dataLancamentoBanco = new Date(`${data}T12:00:00Z`);

    // Verificação de Sobreposição
    const sobreposicao = await global.prisma.lancamentos_de_horas.findFirst({
      where: {
        colaborador_id: colabId,
        data_lancamento: dataLancamentoBanco,
        AND: [
          { hora_inicio: { lt: fimDate } },
          { hora_fim: { gt: inicioDate } }
        ]
      }
    });

    if (sobreposicao) {
      const hI = sobreposicao.hora_inicio.getUTCHours().toString().padStart(2, '0');
      const mI = sobreposicao.hora_inicio.getUTCMinutes().toString().padStart(2, '0');
      const hF = sobreposicao.hora_fim.getUTCHours().toString().padStart(2, '0');
      const mF = sobreposicao.hora_fim.getUTCMinutes().toString().padStart(2, '0');

      res.status(400).json({
        error: `Você já possui um lançamento registrado entre [${hI}:${mI}] e [${hF}:${mF}] nesta data.`
      });
      return;
    }

    // Cálculo de duração
    const diffMs = fimDate.getTime() - inicioDate.getTime();
    const duracaoHoras = diffMs / (1000 * 60 * 60);

    if (isNaN(duracaoHoras) || duracaoHoras <= 0) {
      res.status(400).json({ error: "O horário de término deve ser maior que o de início." });
      return;
    }

    const novoLancamento = await global.prisma.lancamentos_de_horas.create({
      data: {
        colaborador_id: colabId,
        projeto_id: Number(projeto_id),
        atividade_id: Number(atividade_id),
        cliente_id: Number(cliente_id),
        data_lancamento: new Date(`${data}T12:00:00Z`),
        hora_inicio: inicioDate,
        hora_fim: fimDate,
        duracao_total: duracaoHoras,
        descricao: descricao || "",
        status_aprovacao: 'aprovado',
        tipo_lancamento: tipo_lancamento || "manual"
      }
    });

    res.status(201).json(novoLancamento);
  } catch (error) {
    res.status(500).json({ error: 'Erro interno ao registrar horas.' });
  }
};

export const putLancamentos = async (
  req: Request<{ id: string }, {}, PutLancamentoBody>,
  res: Response
): Promise<void> => {
  const { id } = req.params;
  const {
    projeto_id, atividade_id, cliente_id,
    data_lancamento, hora_inicio, hora_fim,
    descricao, motivo_edicao
  } = req.body;

  try {
    // Validações e Tratamento
    if (!projeto_id || !atividade_id) {
      res.status(400).json({ error: "Projeto e Atividade são obrigatórios." });
      return;
    }

    const idLancamento = Number(id);
    const idProjeto = Number(projeto_id);
    const idAtividade = Number(atividade_id);
    const idCliente = cliente_id ? Number(cliente_id) : null;

    if (isNaN(idProjeto) || isNaN(idAtividade)) {
      res.status(400).json({ error: "IDs inválidos." });
      return;
    }

    const dataBase = data_lancamento && data_lancamento.includes('T')
      ? data_lancamento.split('T')[0]
      : data_lancamento;

    if (!dataBase) {
      res.status(400).json({ error: "Data obrigatória." });
      return;
    }

    const timeToDate = (dateStr: string, timeStr: string): Date | null => {
      if (!timeStr) return null;
      const timeParts = timeStr.split(':');
      const d = new Date(dateStr);
      d.setUTCHours(Number(timeParts[0]), Number(timeParts[1]), 0, 0);
      return d;
    };

    const inicioDate = timeToDate(dataBase, hora_inicio);
    const fimDate = timeToDate(dataBase, hora_fim);
    const dataLancamentoDate = new Date(`${dataBase}T12:00:00Z`);

    // Obter o colaborador_id do lançamento atual
    const lancamentoAtual = await global.prisma.lancamentos_de_horas.findUnique({
      where: { lancamento_id: idLancamento },
      select: { colaborador_id: true }
    });

    if (!lancamentoAtual) {
      res.status(404).json({ error: "Lançamento não encontrado." });
      return;
    }

    const conflito = await global.prisma.lancamentos_de_horas.findFirst({
      where: {
        lancamento_id: { not: idLancamento },
        colaborador_id: lancamentoAtual.colaborador_id,
        data_lancamento: dataLancamentoDate,
        AND: [
          { hora_inicio: { lt: fimDate! } },
          { hora_fim: { gt: inicioDate! } }
        ]
      }
    });

    if (conflito) {
      const hI = conflito.hora_inicio.getUTCHours().toString().padStart(2, '0');
      const mI = conflito.hora_inicio.getUTCMinutes().toString().padStart(2, '0');
      const hF = conflito.hora_fim.getUTCHours().toString().padStart(2, '0');
      const mF = conflito.hora_fim.getUTCMinutes().toString().padStart(2, '0');

      res.status(400).json({
        error: `Você já possui um lançamento de horas registrado entre [${hI}:${mI}] e [${hF}:${mF}] nesta data.`
      });
      return;
    }

    let duracaoHoras = 0;
    if (inicioDate && fimDate) {
      const diffMs = fimDate.getTime() - inicioDate.getTime();
      duracaoHoras = diffMs / (1000 * 60 * 60);
    }

    let descricaoFinal = descricao || "";
    if (motivo_edicao && motivo_edicao.trim() !== "") {
      descricaoFinal = `${descricaoFinal} | [Motivo Edição: ${motivo_edicao}]`;
    }

    const updateData: Prisma.lancamentos_de_horasUpdateInput = {
      projetos: { connect: { projeto_id: idProjeto } },
      atividades: { connect: { atividade_id: idAtividade } },
      data_lancamento: dataLancamentoDate,
      hora_inicio: inicioDate || undefined,
      hora_fim: fimDate || undefined,
      duracao_total: duracaoHoras,
      descricao: descricaoFinal,
    };

    if (idCliente) {
      updateData.clientes = { connect: { cliente_id: idCliente } };
    }

    const lancamentoAtualizado = await global.prisma.lancamentos_de_horas.update({
      where: { lancamento_id: idLancamento },
      data: updateData,
    });

    res.json(lancamentoAtualizado);
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError) {
      if (error.code === 'P2025') {
        res.status(404).json({ error: "Lançamento não encontrado." });
        return;
      }
      if (error.code === 'P2003') {
        res.status(400).json({ error: "Projeto ou Atividade informados não existem." });
        return;
      }
    }
    res.status(500).json({ error: "Erro interno no servidor" });
  }
};

export const deleteLancamentos = async (
  req: Request<{ id: string }>,
  res: Response
): Promise<void> => {
  const { id } = req.params;

  try {
    await global.prisma.lancamentos_de_horas.delete({
      where: { lancamento_id: Number(id) },
    });
    res.status(204).send();
  } catch (error) {
    res.status(500).json({ error: "Erro ao excluir." });
  }
};

export const patchLancamentosStatus = async (
  req: Request<{ id: string }, {}, PatchStatusBody>,
  res: Response
): Promise<void> => {
  const { id } = req.params;
  const { status, cargo } = req.body;

  if (cargo !== 'gerente') {
    res.status(403).json({ error: "Apenas gerentes podem aprovar horas." });
    return;
  }

  try {
    const atualizado = await global.prisma.lancamentos_de_horas.update({
      where: { lancamento_id: parseInt(id) },
      data: { status_aprovacao: status }
    });
    res.status(200).json(atualizado);
  } catch (error) {
    res.status(500).json({ error: 'Erro ao atualizar status.' });
  }
};

export default {
  getLancamentos,
  postLancamentos,
  putLancamentos,
  deleteLancamentos,
  patchLancamentosStatus
};
