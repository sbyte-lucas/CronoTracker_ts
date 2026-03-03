import { Request, Response } from 'express';
import prisma from '../prisma';
import { Prisma } from '@prisma/client';

interface PostAtividadeBody {
  projeto_id: number | string;
  nome_atividade: string;
  descr_atividade?: string;
  prioridade?: string;
  data_prevista_inicio: string;
  data_prevista_fim?: string;
  status?: string;
  horas_previstas?: number | string;
  colaborador_ids?: number[];
}

interface PutAtividadeBody extends PostAtividadeBody {}

export const postAtividades = async (
  req: Request<{}, {}, PostAtividadeBody>,
  res: Response
): Promise<void> => {
  const {
    status, nome_atividade, prioridade, descr_atividade,
    data_prevista_inicio, data_prevista_fim, projeto_id,
    colaborador_ids, horas_previstas
  } = req.body;

  if (!projeto_id) {
    res.status(400).json({ error: 'O ID do projeto é obrigatório para vincular a atividade.' });
    return;
  }

  try {
    const projetoIdNumerico = Number(projeto_id);
    const dataInicio = new Date(data_prevista_inicio + 'T00:00:00Z');
    const dataFim = (data_prevista_fim && data_prevista_fim !== "")
      ? new Date(data_prevista_fim + 'T00:00:00Z')
      : null;
    const hPrevistasSolicitadas = Number(horas_previstas) || 0;

    const projeto = await prisma.projetos.findUnique({
      where: { projeto_id: projetoIdNumerico },
      select: { horas_previstas: true }
    });

    if (!projeto) {
      res.status(404).json({ error: `O Projeto ID ${projeto_id} não existe.` });
      return;
    }

    const somaAtividades = await prisma.atividades.aggregate({
      where: { projeto_id: projetoIdNumerico },
      _sum: { horas_previstas: true }
    });

    const totalPrevistoJaAlocado = somaAtividades._sum.horas_previstas || 0;

    if ((totalPrevistoJaAlocado + hPrevistasSolicitadas) > (projeto.horas_previstas || 0)) {
      res.status(400).json({
        error: `Limite de horas excedido. O projeto permite ${projeto.horas_previstas}h e o total ficaria em ${totalPrevistoJaAlocado + hPrevistasSolicitadas}h.`
      });
      return;
    }

    const novaAtividade = await prisma.atividades.create({
      data: {
        nome_atividade,
        prioridade: prioridade || "normal",
        descr_atividade: descr_atividade || "",
        data_prevista_inicio: dataInicio,
        data_prevista_fim: dataFim,
        horas_previstas: hPrevistasSolicitadas,
        horas_gastas: 0,
        status: status || "Pendente",
        projetos: {
          connect: { projeto_id: projetoIdNumerico }
        },
        colaboradores_atividades: {
          create: (colaborador_ids || []).map(id => ({
            colaborador_id: Number(id)
          }))
        }
      }
    });

    // RECALCULA AS HORAS DO PROJETO
    const soma = await prisma.atividades.aggregate({
      where: { projeto_id: projetoIdNumerico },
      _sum: { horas_gastas: true }
    });

    // ATUALIZA O PROJETO
    await prisma.projetos.update({
      where: { projeto_id: projetoIdNumerico },
      data: { horas_gastas: soma._sum.horas_gastas || 0 }
    });

    res.status(201).json(novaAtividade);
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2003') {
      res.status(404).json({ error: `O Projeto ID ${projeto_id} não existe.` });
      return;
    }
    res.status(500).json({ error: 'Erro interno.' });
  }
};

export const putAtividades = async (
  req: Request<{ atividade_id: string }, {}, PutAtividadeBody>,
  res: Response
): Promise<void> => {
  const { atividade_id } = req.params;
  const {
    nome_atividade, prioridade, descr_atividade,
    data_prevista_inicio, data_prevista_fim,
    horas_previstas, status, projeto_id, colaborador_ids
  } = req.body;

  try {
    const idAtv = Number(atividade_id);
    const idProj = Number(projeto_id);
    const hPrevistasNovas = Number(horas_previstas) || 0;

    const projeto = await prisma.projetos.findUnique({
      where: { projeto_id: idProj },
      select: { horas_previstas: true }
    });

    if (!projeto) {
      res.status(404).json({ error: "Projeto não encontrado." });
      return;
    }

    const somaOutrasAtividades = await prisma.atividades.aggregate({
      where: {
        projeto_id: idProj,
        NOT: { atividade_id: idAtv }
      },
      _sum: { horas_previstas: true }
    });

    const totalComEdicao = (somaOutrasAtividades._sum.horas_previstas || 0) + hPrevistasNovas;

    if (totalComEdicao > (projeto.horas_previstas || 0)) {
      res.status(400).json({
        error: `Limite excedido. O projeto tem ${projeto.horas_previstas}h e o total planejado seria ${totalComEdicao}h.`
      });
      return;
    }

    const dataInicio = data_prevista_inicio ? new Date(data_prevista_inicio + 'T12:00:00Z') : null;
    const dataFim = data_prevista_fim ? new Date(data_prevista_fim + 'T12:00:00Z') : null;

    const atividadeAtualizada = await prisma.atividades.update({
      where: { atividade_id: idAtv },
      data: {
        nome_atividade,
        prioridade,
        descr_atividade: descr_atividade || "",
        data_prevista_inicio: dataInicio,
        data_prevista_fim: dataFim,
        horas_previstas: hPrevistasNovas,
        status: status,
        projetos: { connect: { projeto_id: idProj } },
        colaboradores_atividades: {
          deleteMany: {},
          create: (colaborador_ids || []).map(id => ({
            colaborador_id: Number(id)
          }))
        }
      },
      include: {
        colaboradores_atividades: {
          include: { colaboradores: true }
        },
        projetos: true,
      }
    });

    const soma = await prisma.atividades.aggregate({
      where: { projeto_id: idProj },
      _sum: { horas_gastas: true }
    });

    await prisma.projetos.update({
      where: { projeto_id: idProj },
      data: { horas_gastas: soma._sum.horas_gastas || 0 }
    });

    res.status(200).json(atividadeAtualizada);
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2025') {
      res.status(404).json({ error: "Atividade não encontrada." });
      return;
    }
    res.status(500).json({ error: "Erro interno." });
  }
};

export const deleteAtividades = async (
  req: Request<{ atividade_id: string }>,
  res: Response
): Promise<void> => {
  const atividadeId = Number(req.params.atividade_id);

  if (!Number.isInteger(atividadeId)) {
    res.status(400).json({ error: "ID inválido." });
    return;
  }

  try {
    const existe = await prisma.atividades.findUnique({ where: { atividade_id: atividadeId } });
    if (!existe) {
      res.status(404).json({ error: `Atividade não existe.` });
      return;
    }

    await prisma.atividades.delete({ where: { atividade_id: atividadeId } });
    res.sendStatus(204);
  } catch (error) {
    res.status(500).json({ error: "Não é possível excluir uma atividade que possui horas lançadas." });
  }
};

export const getAtividades = async (req: Request, res: Response): Promise<void> => {
  try {
    const atividades = await prisma.atividades.findMany({
      include: {
        colaboradores_atividades: {
          include: { colaboradores: true }
        },
        projetos: {
          select: { nome_projeto: true }
        }
      },
      orderBy: { atividade_id: 'asc' },
    });

    const somaHorasAtividades = await prisma.lancamentos_de_horas.groupBy({
      by: ['atividade_id'],
      _sum: { duracao_total: true }
    });

    const atividadesComHorasReais = atividades.map(atv => {
      const lancamento = somaHorasAtividades.find(l => l.atividade_id === atv.atividade_id);
      return {
        ...atv,
        horas_gastas: lancamento?._sum?.duracao_total || 0
      };
    });

    res.status(200).json(atividadesComHorasReais);
  } catch (error) {
    res.status(500).json({ error: 'Erro interno ao listar atividades.' });
  }
};

export const getAtividadeById = async (
  req: Request<{ atividade_id: string }>,
  res: Response
): Promise<void> => {
  const atividadeId = Number(req.params.atividade_id);

  if (!Number.isInteger(atividadeId)) {
    res.status(400).json({ error: "ID inválido." });
    return;
  }

  try {
    const atividade = await prisma.atividades.findUnique({
      where: { atividade_id: atividadeId },
      include: {
        colaboradores_atividades: {
          include: { colaboradores: true }
        },
        projetos: true,
        lancamentos_de_horas: {
          include: {
            colaboradores: {
              select: { nome_colaborador: true }
            }
          },
          orderBy: { data_lancamento: 'desc' }
        }
      }
    });

    if (!atividade) {
      res.status(404).json({ error: "Atividade não encontrada." });
      return;
    }

    res.json(atividade);
  } catch (error) {
    res.status(500).json({ error: "Erro ao buscar atividade." });
  }
};

export default {
  postAtividades,
  putAtividades,
  deleteAtividades,
  getAtividades,
  getAtividadeById
};
