import { Request, Response } from 'express';
import { Prisma } from 'generated/prisma/client';

interface PostProjetoBody {
  cliente_id: number | string;
  nome_projeto: string;
  descricao?: string;
  data_inicio: string;
  data_fim: string;
  status?: string;
  horas_previstas?: number | string;
  colaboradores_ids?: number[];
}

interface PutProjetoBody extends Partial<PostProjetoBody> {}

export const getProjetos = async (req: Request, res: Response): Promise<void> => {
  try {
    const projetos = await global.prisma.projetos.findMany({
      include: {
        clientes: { select: { cliente_id: true, nome_cliente: true } },
        atividades: { select: { atividade_id: true, nome_atividade: true, status: true } },
        projeto_colaboradores: { include: { colaboradores: true } }
      },
      orderBy: { projeto_id: 'desc' }
    });

    const agregacaoHoras = await global.prisma.lancamentos_de_horas.groupBy({
      by: ['projeto_id'],
      _sum: { duracao_total: true }
    });

    const projetosComHoras = projetos.map(projeto => {
      const calculo = agregacaoHoras.find(h => Number(h.projeto_id) === Number(projeto.projeto_id));
      const total = calculo?._sum?.duracao_total || 0;

      return {
        ...projeto,
        horas_gastas: total
      };
    });

    res.status(200).json(projetosComHoras);
  } catch (error) {
    res.status(500).json({ error: 'Erro ao listar projetos.' });
  }
};

export const getProjetoByid = async (
  req: Request<{ id: string }>,
  res: Response
): Promise<void> => {
  const { id } = req.params;
  const projetoId = parseInt(id);

  if (isNaN(projetoId)) {
    res.status(400).json({ error: "ID do projeto inválido." });
    return;
  }

  try {
    const [projeto, somaDespesas, somaHoras] = await Promise.all([
      prisma.projetos.findUnique({
        where: { projeto_id: projetoId },
        include: {
          clientes: { select: { nome_cliente: true } },
          atividades: { orderBy: { atividade_id: 'asc' } },
          projeto_colaboradores: { include: { colaboradores: true } },
          despesas: {
            orderBy: { data_despesa: 'desc' },
            include: { colaborador: { select: { nome_colaborador: true } } }
          }
        }
      }),
      prisma.despesas.aggregate({
        where: { projeto_id: projetoId, status_aprovacao: "Aprovada" },
        _sum: { valor: true }
      }),
      prisma.lancamentos_de_horas.aggregate({
        where: { projeto_id: projetoId },
        _sum: { duracao_total: true }
      })
    ]);

    if (!projeto) {
      res.status(404).json({ error: 'Projeto não encontrado.' });
      return;
    }

    res.status(200).json({
      ...projeto,
      horas_gastas: somaHoras._sum.duracao_total || 0,
      total_despesas: Number(somaDespesas._sum.valor) || 0
    });
  } catch (error) {
    res.status(500).json({ error: 'Erro interno ao buscar detalhes do projeto.' });
  }
};

export const postProjetos = async (
  req: Request<{}, {}, PostProjetoBody>,
  res: Response
): Promise<void> => {
  const { cliente_id, nome_projeto, descricao, data_inicio, data_fim, status, horas_previstas, colaboradores_ids } = req.body;

  if (!cliente_id || !nome_projeto || !data_inicio || !data_fim) {
    res.status(400).json({ error: 'Campos obrigatórios: Cliente, Nome, Data Início, Data Fim.' });
    return;
  }

  try {
    const inicio = new Date(data_inicio);
    const fim = new Date(data_fim);

    if (fim < inicio) {
      res.status(400).json({ error: 'Data Fim não pode ser anterior à Data Início.' });
      return;
    }

    const novoProjeto = await global.prisma.projetos.create({
      data: {
        cliente_id: parseInt(String(cliente_id)),
        nome_projeto,
        descricao: descricao || '',
        data_inicio: inicio,
        data_fim: fim,
        horas_previstas: horas_previstas ? parseInt(String(horas_previstas)) : 0,
        status: status || "Orçando",
        projeto_colaboradores: {
          create: (colaboradores_ids || []).map(id => ({ colaborador_id: id }))
        }
      }
    });

    res.status(201).json(novoProjeto);
  } catch (error) {
    res.status(500).json({ error: 'Erro interno ao criar projeto.' });
  }
};

export const putProjetos = async (
  req: Request<{ id: string }, {}, PutProjetoBody>,
  res: Response
): Promise<void> => {
  const { id } = req.params;
  const { cliente_id, nome_projeto, descricao, data_inicio, data_fim, status, horas_previstas, colaboradores_ids } = req.body;

  try {
    const projetoAtualizado = await global.prisma.projetos.update({
      where: { projeto_id: parseInt(id) },
      data: {
        cliente_id: cliente_id ? parseInt(String(cliente_id)) : undefined,
        nome_projeto,
        descricao,
        data_inicio: data_inicio ? new Date(data_inicio) : undefined,
        data_fim: data_fim ? new Date(data_fim) : undefined,
        horas_previstas: horas_previstas !== undefined ? parseInt(String(horas_previstas)) : undefined,
        status: status,
        projeto_colaboradores: {
          deleteMany: {},
          create: (colaboradores_ids || []).map(idColab => ({ colaborador_id: Number(idColab) }))
        }
      },
      include: { projeto_colaboradores: { include: { colaboradores: true } } }
    });

    res.status(200).json(projetoAtualizado);
  } catch (error) {
    res.status(500).json({ error: 'Erro ao atualizar projeto.' });
  }
};

export const deleteProjetos = async (
  req: Request<{ id: string }>,
  res: Response
): Promise<void> => {
  const { id } = req.params;

  try {
    await global.prisma.projetos.delete({ where: { projeto_id: parseInt(id) } });
    res.status(204).send();
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError) {
      if (error.code === 'P2025') {
        res.status(404).json({ error: 'Projeto não encontrado.' });
        return;
      }
      if (error.code === 'P2003') {
        res.status(400).json({
          error: 'Não é possível excluir: este projeto possui atividades, lançamentos de horas ou despesas vinculadas.'
        });
        return;
      }
    }
    res.status(500).json({ error: 'Erro interno ao excluir projeto.' });
  }
};

export default {
  getProjetos,
  getProjetoByid,
  postProjetos,
  putProjetos,
  deleteProjetos
};
