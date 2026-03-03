import { Request, Response } from 'express';
import prisma from '../prisma';

interface PostLogBody {
  usuario_id: string | number;
  evento: string;
  tela_acessada?: string;
}

export const postLog = async (req: Request<{}, {}, PostLogBody>, res: Response): Promise<void> => {
  const { usuario_id, evento, tela_acessada } = req.body;

  const parsedId = parseInt(String(usuario_id));

  if (isNaN(parsedId)) {
    console.error("Tentativa de log com usuario_id INVÁLIDO:", usuario_id);
    res.status(400).json({ error: "usuario_id é obrigatório e deve ser um número" });
    return;
  }

  try {
    const novoLog = await prisma.logs_acesso.create({
      data: {
        usuario_id: parsedId,
        evento: evento,
        tela_acessada: tela_acessada || null,
      }
    });
    res.status(201).json(novoLog);
  } catch (error) {
    res.status(500).json({ error: "Erro ao salvar log" });
  }
};

export default { postLog };
