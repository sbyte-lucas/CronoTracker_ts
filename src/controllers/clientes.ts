import { Request, Response } from 'express';
import { Prisma } from 'generated/prisma/client';

interface PostClienteBody {
  cnpj: string;
  nome_cliente: string;
  nome_contato?: string;
  cep?: string;
  endereco?: string;
  cidade?: string;
  estado?: string;
  status?: boolean;
}

interface PutClienteBody extends Partial<PostClienteBody> {}

export const getClientes = async (req: Request, res: Response): Promise<void> => {
  try {
    const todosClientes = await global.prisma.clientes.findMany({
      orderBy: { cliente_id: 'asc' },
    });
    res.status(200).json(todosClientes);
  } catch (error) {
    res.status(500).json({ error: 'Erro interno ao listar clientes.' });
  }
};

export const getClienteByCNPJ = async (
  req: Request<{ cnpj: string }>,
  res: Response
): Promise<void> => {
  const cnpjLimpo = req.params.cnpj.replace(/[^\d]/g, '');

  if (cnpjLimpo.length !== 14) {
    res.status(400).json({ error: 'formato de CNPJ inválido. Deve ter 14 dígitos.' });
    return;
  }

  try {
    const cliente = await global.prisma.clientes.findUnique({
      where: { cnpj: cnpjLimpo },
      include: {
        projetos: {
          include: {
            despesas: true,
            lancamentos_de_horas: true
          }
        }
      }
    });

    if (cliente) {
      res.status(200).json({ existe: true, cliente: cliente });
    } else {
      res.status(200).json({ existe: false });
    }
  } catch (error) {
    res.status(500).json({ error: 'Erro interno do servidor.' });
  }
};

export const postClientes = async (
  req: Request<{}, {}, PostClienteBody>,
  res: Response
): Promise<void> => {
  const { cnpj, nome_cliente, nome_contato, cep, endereco, cidade, estado, status } = req.body;

  if (!cnpj || !nome_cliente) {
    res.status(400).json({ error: 'CNPJ e Nome da Empresa são obrigatórios.' });
    return;
  }

  const cnpjLimpo = cnpj.replace(/[^\d]/g, '');

  try {
    const novoCliente = await global.prisma.clientes.create({
      data: {
        cnpj: cnpjLimpo,
        nome_cliente,
        nome_contato: nome_contato || '',
        cep,
        endereco,
        cidade,
        estado,
        status: status !== undefined ? status : true,
      }
    });
    res.status(201).json(novoCliente);
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
      res.status(409).json({
        error: 'CNPJ já existente',
        message: 'Este CNPJ já está cadastrado no sistema.'
      });
      return;
    }
    res.status(500).json({ error: 'Erro interno do servidor.' });
  }
};

export const putClientes = async (
  req: Request<{ id: string }, {}, PutClienteBody>,
  res: Response
): Promise<void> => {
  const clienteId = Number(req.params.id);
  const { cnpj, nome_cliente, nome_contato, cep, endereco, cidade, estado, status } = req.body;

  try {
    const cnpjLimpo = cnpj ? cnpj.replace(/\D/g, '') : null;

    if (cnpjLimpo) {
      const duplicado = await global.prisma.clientes.findFirst({
        where: {
          cnpj: cnpjLimpo,
          cliente_id: { not: clienteId }
        }
      });

      if (duplicado) {
        res.status(409).json({ code: 'CNPJ_DUPLICADO', message: 'CNPJ já existente' });
        return;
      }
    }

    const clienteAtualizado = await global.prisma.clientes.update({
      where: { cliente_id: clienteId },
      data: { cnpj: cnpjLimpo, nome_cliente, nome_contato, cep, endereco, cidade, estado, status }
    });

    res.status(200).json(clienteAtualizado);
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
      res.status(409).json({ code: 'CNPJ_DUPLICADO', message: 'CNPJ já existente' });
      return;
    }
    res.status(500).json({ message: 'Erro interno' });
  }
};

export const getClienteById = async (
  req: Request<{ id: string }>,
  res: Response
): Promise<void> => {
  const clienteId = parseInt(req.params.id);

  if (isNaN(clienteId)) {
    res.status(400).json({ error: 'ID inválido' });
    return;
  }

  try {
    const cliente = await global.prisma.clientes.findUnique({
      where: { cliente_id: clienteId },
      include: {
        projetos: {
          orderBy: { projeto_id: 'desc' }
        }
      }
    });

    if (!cliente) {
      res.status(404).json({ error: 'Cliente não encontrado' });
      return;
    }

    res.status(200).json(cliente);
  } catch (err) {
    res.status(500).json({ error: 'Erro interno' });
  }
};

export const deleteClientes = async (
  req: Request<{ id: string }>,
  res: Response
): Promise<void> => {
  const clienteId = parseInt(req.params.id);

  if (isNaN(clienteId)) {
    res.status(400).json({ error: 'ID do cliente inválido.' });
    return;
  }

  try {
    const clienteDeletado = await global.prisma.clientes.delete({
      where: { cliente_id: clienteId },
    });
    res.status(200).json({ message: 'Cliente excluido com sucesso.', cliente: clienteDeletado });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError) {
      if (error.code === 'P2025') {
        res.status(404).json({ error: `Cliente com ID ${clienteId} não encontrado` });
        return;
      }
      if (error.code === 'P2003') {
        res.status(400).json({ error: 'Este cliente não pode ser excluído porque possui projetos ou horas.' });
        return;
      }
    }
    res.status(500).json({ error: 'Erro interno do servidor.' });
  }
};

export const getClienteProjetos = async (
  req: Request<{ id: string }>,
  res: Response
): Promise<void> => {
  const clienteId = parseInt(req.params.id);

  if (isNaN(clienteId)) {
    res.status(400).json({ error: 'ID do cliente inválido.' });
    return;
  }

  try {
    const projetosDoCliente = await global.prisma.projetos.findMany({
      where: { cliente_id: clienteId },
      orderBy: { projeto_id: 'desc' },
    });
    res.status(200).json(projetosDoCliente);
  } catch (error) {
    res.status(500).json({ error: 'Erro interno ao buscar projetos.' });
  }
};

export default {
  getClientes,
  getClienteByCNPJ,
  postClientes,
  putClientes,
  getClienteById,
  deleteClientes,
  getClienteProjetos
};
