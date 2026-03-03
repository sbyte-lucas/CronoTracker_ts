import { Request, Response } from 'express';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import prisma from '../prisma';

const JWT_SECRET = process.env.JWT_SECRET || 'sua-chave-secreta-muito-segura';

interface LoginBody {
  nome_usuario: string;
  senha: string;
}

export const login = async (req: Request<{}, {}, LoginBody>, res: Response): Promise<void> => {
  const { nome_usuario, senha } = req.body;

  if (!nome_usuario || !senha) {
    res.status(400).json({ error: "Campos obrigatórios." });
    return;
  }

  try {
    const usuario = await prisma.usuarios.findUnique({ where: { nome_usuario } });

    if (!usuario) {
      res.status(401).json({ error: "Credenciais inválidas." });
      return;
    }

    const senhaValida = await bcrypt.compare(senha, usuario.hash_senha);
    if (!senhaValida) {
      res.status(401).json({ error: "Credenciais inválidas." });
      return;
    }

    const token = jwt.sign(
      {
        usuarioId: usuario.usuario_id,
        cargo: usuario.cargo,
        nomeUsuario: usuario.nome_usuario,
        colaborador_id: usuario.colaborador_id
      },
      JWT_SECRET,
      { expiresIn: '8h' }
    );

    res.json({
      message: "Login bem-sucedido!",
      token,
      user: {
        usuario_id: usuario.usuario_id,
        nome_usuario: usuario.nome_usuario,
        cargo: usuario.cargo,
        nome_completo: usuario.nome_completo,
        colaborador_id: usuario.colaborador_id,
      }
    });
  } catch (error) {
    res.status(500).json({ error: "Erro interno." });
  }
};

export default { login };
