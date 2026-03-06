import { Request, Response } from 'express';
import { Prisma } from '@/generated/prisma/client';

interface PostColaboradorBody {
  nome_colaborador: string;
  cargo: string;
  email: string;
  data_admissao?: string;
  status?: boolean;
  foto?: string;
}

interface PutColaboradorBody extends Partial<PostColaboradorBody> {}

export const getColaboradores = async (req: Request, res: Response): Promise<void> => {
  try {
    const colaboradores = await global.prisma.colaboradores.findMany({
      include: {
        projeto_colaboradores: {
          include: {
            projetos: {
              include: { atividades: true, clientes: true }
            }
          }
        }
      },
      orderBy: { nome_colaborador: 'asc' }
    });

    const colaboradoresFormatados = colaboradores.map(col => {
      const projetosNomes = col.projeto_colaboradores.map(pc => pc.projetos?.nome_projeto).filter(Boolean);
      const atividadesEquipe = col.projeto_colaboradores.flatMap(pc => pc.projetos?.atividades || []);

      return {
        ...col,
        foto: col.foto ? col.foto.toString() : null,
        listaProjetos: projetosNomes,
        atividadesEquipe: atividadesEquipe
      };
    });

    res.status(200).json(colaboradoresFormatados);
  } catch (error) {
    res.status(500).json({ error: 'Erro ao buscar lista de colaboradores' });
  }
};

export const getColaboradorByEmail = async (
  req: Request<{ email: string }>,
  res: Response
): Promise<void> => {
  const { email } = req.params;

  if (!email || !email.includes('@')) {
    res.status(400).json({ error: 'Formato de e-mail inválido.' });
    return;
  }

  try {
    const colaborador = await global.prisma.colaboradores.findUnique({
      where: { email: email }
    });

    if (colaborador) {
      res.status(200).json({ existe: true, colaborador: colaborador });
    } else {
      res.status(200).json({ existe: false });
    }
  } catch (error) {
    res.status(500).json({ error: 'Erro interno do servidor.' });
  }
};

export const postColaboradores = async (
  req: Request<{}, {}, PostColaboradorBody>,
  res: Response
): Promise<void> => {
  const { nome_colaborador, cargo, email, data_admissao, status, foto } = req.body;

  if (!email || !nome_colaborador || !cargo) {
    res.status(400).json({ error: 'Nome, Cargo e E-mail são obrigatórios.' });
    return;
  }

  try {
    const novoColaborador = await global.prisma.colaboradores.create({
      data: {
        nome_colaborador,
        cargo,
        email,
        data_admissao: data_admissao ? new Date(data_admissao) : new Date(),
        status: status !== undefined ? status : true,
        foto: foto ? Buffer.from(foto, 'base64') : null,
      }
    });

    res.status(201).json(novoColaborador);
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
      res.status(409).json({ error: 'Este e-mail já está cadastrado.' });
      return;
    }
    res.status(500).json({ error: 'Erro interno do servidor.' });
  }
};

export const getColaboradorById = async (
  req: Request<{ id: string }>,
  res: Response
): Promise<void> => {
  const { id } = req.params;
  const colaboradorId = parseInt(id);

  if (isNaN(colaboradorId)) {
    res.status(400).json({ error: 'ID do colaborador inválido.' });
    return;
  }

  try {
    const colaborador = await global.prisma.colaboradores.findUnique({
      where: { colaborador_id: colaboradorId },
      include: {
        projeto_colaboradores: {
          include: { projetos: true }
        },
        atividades: {
          include: {
            projetos: { select: { nome_projeto: true } }
          },
          orderBy: { atividade_id: 'desc' }
        },
        lancamentos_de_horas: true,
        despesas: {
          include: {
            projeto: { select: { nome_projeto: true } }
          },
          orderBy: { data_despesa: 'desc' }
        }
      }
    });

    if (!colaborador) {
      res.status(404).json({ error: 'Colaborador não encontrado.' });
      return;
    }

    const totalAtividades = colaborador.atividades.length;
    const despesasAprovadas = colaborador.despesas
      .filter(d => d.status_aprovacao === 'Aprovada')
      .reduce((acc, curr) => acc + Number(curr.valor || 0), 0);

    const despesasPendentes = colaborador.despesas
      .filter(d => d.status_aprovacao === 'Pendente')
      .reduce((acc, curr) => acc + Number(curr.valor || 0), 0);

    const totalHorasAcumuladas = colaborador.lancamentos_de_horas.reduce(
      (acc, curr) => acc + Number(curr.duracao_total || 0), 0
    );

    const totalDespesas = colaborador.despesas.reduce(
      (acc, curr) => acc + Number(curr.valor || 0), 0
    );

    const colaboradorFormatado = {
      ...colaborador,
      foto: colaborador.foto ? colaborador.foto.toString() : null,
      total_atividades: totalAtividades,
      total_horas: totalHorasAcumuladas,
      total_despesas_valor: totalDespesas,
      valor_despesas_aprovadas: despesasAprovadas,
      valor_despesas_pendentes: despesasPendentes,
      listaProjetos: colaborador.projeto_colaboradores.map(pc => pc.projetos?.nome_projeto).filter(Boolean),
      historico_lancamentos: colaborador.lancamentos_de_horas,
      lista_despesas: colaborador.despesas,
      lancamentos_de_horas: undefined
    };

    res.status(200).json(colaboradorFormatado);
  } catch (error) {
    res.status(500).json({ error: 'Erro interno ao buscar colaborador.' });
  }
};

export const putColaboradores = async (
  req: Request<{ id: string }, {}, PutColaboradorBody>,
  res: Response
): Promise<void> => {
  const id = parseInt(req.params.id);
  const { nome_colaborador, cargo, email, status, foto, data_admissao } = req.body;

  if (isNaN(id)) {
    res.status(400).json({ error: 'ID inválido.' });
    return;
  }

  const dadosParaAtualizar: Prisma.colaboradoresUpdateInput = {
    nome_colaborador,
    cargo,
    email,
    status
  };

  if (foto) dadosParaAtualizar.foto = Buffer.from(foto, 'base64');
  if (data_admissao) dadosParaAtualizar.data_admissao = new Date(data_admissao);

  try {
    const colaboradorAtualizado = await global.prisma.colaboradores.update({
      where: { colaborador_id: id },
      data: dadosParaAtualizar,
    });

    res.status(200).json(colaboradorAtualizado);
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError) {
      if (error.code === 'P2025') {
        res.status(404).json({ error: 'Colaborador não encontrado.' });
        return;
      }
      if (error.code === 'P2002') {
        res.status(400).json({ error: 'E-mail já está em uso.' });
        return;
      }
    }
    res.status(500).json({ error: 'Erro interno ao atualizar.' });
  }
};

export const deleteColaboradores = async (
  req: Request<{ id: string }>,
  res: Response
): Promise<void> => {
  const id = parseInt(req.params.id);

  try {
    await global.prisma.$transaction(async (tx) => {
      await tx.colaboradores.update({
        where: { colaborador_id: id },
        data: { status: false }
      });

      await tx.usuarios.updateMany({
        where: { colaborador_id: id },
        data: { status: false }
      });
    });

    res.status(200).json({ message: 'Colaborador e Usuário inativados com sucesso.' });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2025') {
      res.status(404).json({ error: 'Colaborador não encontrado.' });
      return;
    }
    res.status(500).json({ error: 'Erro interno ao excluir colaborador.' });
  }
};

export default {
  getColaboradores,
  getColaboradorByEmail,
  postColaboradores,
  getColaboradorById,
  putColaboradores,
  deleteColaboradores
};
