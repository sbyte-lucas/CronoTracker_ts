import { Request, Response } from 'express';

interface PostDespesasBody {
  projeto_id: number | string;
  colaborador_id: number | string;
  tipo_despesa: string;
  data_despesa: string;
  valor: number | string;
  descricao: string;
  anexo: string;
}

interface PatchDespesasBody {
  status: string;
  motivo_reprovacao?: string;
  cargo: string;
}

interface DespesasQuery {
  status?: string;
}

export const postDespesas = async (
  req: Request<{}, {}, PostDespesasBody>,
  res: Response
): Promise<void> => {
  const { projeto_id, colaborador_id, tipo_despesa, data_despesa, valor, descricao, anexo } = req.body;

  if (!projeto_id || !colaborador_id || !tipo_despesa || !data_despesa || !valor || !descricao || !anexo) {
    res.status(400).json({ error: "Todos os campos são obrigatórios." });
    return;
  }

  const valorNumerico = parseFloat(String(valor));
  if (isNaN(valorNumerico) || valorNumerico <= 0) {
    res.status(400).json({ error: "Valor inválido." });
    return;
  }

  try {
    const projeto = await global.prisma.projetos.findUnique({ where: { projeto_id: Number(projeto_id) } });
    if (!projeto) {
      res.status(404).json({ error: "Projeto não encontrado." });
      return;
    }
    if (projeto.status === "Cancelado") {
      res.status(400).json({ error: "Não é permitido lançar despesas em projetos cancelados." });
      return;
    }

    const novaDespesa = await global.prisma.despesas.create({
      data: {
        projeto_id: Number(projeto_id),
        colaborador_id: Number(colaborador_id),
        tipo_despesa,
        data_despesa: new Date(data_despesa),
        valor: valorNumerico,
        descricao,
        anexo,
        status_aprovacao: "Pendente"
      }
    });
    res.status(201).json(novaDespesa);
  } catch (error) {
    res.status(500).json({ error: "Erro interno." });
  }
};

export const patchDespesas = async (
  req: Request<{ id: string }, {}, PatchDespesasBody>,
  res: Response
): Promise<void> => {
  const { id } = req.params;
  const { status, motivo_reprovacao, cargo } = req.body;

  if (!cargo || cargo.toLowerCase() !== 'gerente') {
    res.status(403).json({ error: "Apenas gerentes podem aprovar." });
    return;
  }

  try {
    const despesaAtualizada = await global.prisma.despesas.update({
      where: { despesa_id: parseInt(id) },
      data: {
        status_aprovacao: status,
        motivo_reprovacao: status === "Reprovada" ? motivo_reprovacao : null
      }
    });
    res.status(200).json(despesaAtualizada);
  } catch (error) {
    res.status(500).json({ error: 'Erro interno.' });
  }
};

export const getDespesas = async (
  req: Request<{}, {}, {}, DespesasQuery>,
  res: Response
): Promise<void> => {
  const { status } = req.query;

  try {
    const despesas = await global.prisma.despesas.findMany({
      where: status ? { status_aprovacao: status } : {},
      include: {
        colaborador: { select: { nome_colaborador: true } },
        projeto: { select: { nome_projeto: true } }
      },
      orderBy: { data_despesa: 'desc' }
    });
    res.status(200).json(despesas);
  } catch (error) {
    res.status(500).json({ error: "Erro interno." });
  }
};

export default { postDespesas, patchDespesas, getDespesas };
