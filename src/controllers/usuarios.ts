import { Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import { Prisma } from 'generated/prisma/client';

interface PostUsuariosBody {
  nome_usuario: string;
  senha: string;
  nome_completo: string;
  email: string;
  cargo?: string;
}

interface PutUsuariosBody {
  nome_completo?: string;
  email?: string;
  cargo?: string;
  status?: boolean;
  senha?: string;
  nome_usuario?: string;
}

export const getUsuarios = async (req: Request, res: Response): Promise<void> => {
  try {
    const usuarios = await global.prisma.usuarios.findMany({
      select: {
        usuario_id: true,
        nome_usuario: true,
        nome_completo: true,
        email: true,
        cargo: true,
        status: true,
        colaborador_id: true,
      },
      orderBy: { nome_completo: 'asc' }
    });
    res.status(200).json(usuarios);
  } catch (error) {
    res.status(500).json({ error: 'Erro interno.' });
  }
};

export const postUsuarios = async (
  req: Request<{}, {}, PostUsuariosBody>,
  res: Response
): Promise<void> => {
  const { nome_usuario, senha, nome_completo, email, cargo } = req.body;

  try {
    const salt = await bcrypt.genSalt(10);
    const hash_senha = await bcrypt.hash(senha, salt);

    const novoUsuario = await global.prisma.$transaction(async (tx) => {
      const colaborador = await tx.colaboradores.create({
        data: {
          nome_colaborador: nome_completo,
          email,
          cargo: cargo || 'Colaborador',
          data_admissao: new Date(),
          status: true
        }
      });

      const usuario = await tx.usuarios.create({
        data: {
          nome_usuario,
          hash_senha,
          nome_completo,
          email,
          cargo: cargo || 'Colaborador',
          status: true,
          colaborador_id: colaborador.colaborador_id
        }
      });

      return usuario;
    });

    const { hash_senha: _, ...userSemSenha } = novoUsuario;
    res.status(201).json({ message: "Usuário criado!", userSemSenha });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
      res.status(409).json({ error: 'Usuário ou E-mail já cadastrados.' });
      return;
    }
    res.status(500).json({ error: 'Erro ao criar usuário.' });
  }
};

export const putUsuarios = async (
  req: Request<{ id: string }, {}, PutUsuariosBody>,
  res: Response
): Promise<void> => {
  const { id } = req.params;
  const { nome_completo, email, cargo, status, senha, nome_usuario } = req.body;

  try {
    const dadosParaAtualizar: Prisma.usuariosUpdateInput = {
      nome_completo,
      email,
      cargo,
      status,
      nome_usuario
    };

    if (senha && senha.trim() !== "") {
      const salt = await bcrypt.genSalt(10);
      dadosParaAtualizar.hash_senha = await bcrypt.hash(senha, salt);
    }

    const resultado = await global.prisma.$transaction(async (tx) => {
      const usuarioOriginal = await tx.usuarios.findUnique({
        where: { usuario_id: parseInt(id) }
      });

      if (!usuarioOriginal) throw new Error("P2025");

      const usuarioAtualizado = await tx.usuarios.update({
        where: { usuario_id: parseInt(id) },
        data: dadosParaAtualizar
      });

      if (status !== undefined && usuarioOriginal.colaborador_id) {
        await tx.colaboradores.update({
          where: { colaborador_id: usuarioOriginal.colaborador_id },
          data: { status: status }
        });
      }

      return usuarioAtualizado;
    });

    const { hash_senha: _, ...userSemSenha } = resultado;
    res.status(200).json(userSemSenha);
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
      res.status(409).json({ error: 'Conflito: Usuário ou E-mail já existem.' });
      return;
    }
    if (error instanceof Error && error.message === "P2025") {
      res.status(404).json({ error: 'Usuário não encontrado.' });
      return;
    }
    res.status(500).json({ error: 'Erro ao atualizar.' });
  }
};

export const deleteUsuarios = async (
  req: Request<{ id: string }>,
  res: Response
): Promise<void> => {
  const { id } = req.params;

  try {
    await global.prisma.$transaction(async (tx) => {
      const usuario = await tx.usuarios.findUnique({
        where: { usuario_id: parseInt(id) }
      });

      if (!usuario) throw new Error("Usuário não encontrado");

      await tx.usuarios.update({
        where: { usuario_id: parseInt(id) },
        data: { status: false }
      });

      if (usuario.colaborador_id) {
        await tx.colaboradores.update({
          where: { colaborador_id: usuario.colaborador_id },
          data: { status: false }
        });
      }
    });

    res.status(200).json({ message: 'Inativado com sucesso.' });
  } catch (error) {
    res.status(500).json({ error: 'Erro ao inativar usuário.' });
  }
};

export default { getUsuarios, postUsuarios, putUsuarios, deleteUsuarios };
