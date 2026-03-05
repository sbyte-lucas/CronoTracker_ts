import { NextFunction } from 'express';
import jwt, { JwtPayload } from 'jsonwebtoken';

const JWT_SECRET = process.env.JWT_SECRET as string;
const pathsToIgnore = [
  '/login', 
  '/refresh-token'
];

/**
 * Middleware de autenticação JWT
 * Verifica o token no header Authorization e adiciona o usuário ao request
 */
export const authMiddleware = (req: request, res: response, next: NextFunction): void => {
  try {
    console.log(`Path: ${req.path}, method: ${req.method}`);
    if (pathsToIgnore.includes(req.path)) return next();

    const token = req.headers.authorization;

    if (!token) {
      res.status(401).json({ error: 'Token não fornecido' });
      return;
    }

    const decoded = jwt.verify(token, JWT_SECRET) as JwtPayload;
    if (!decoded || !decoded.usuarioId) {
      res.status(401).json({ error: 'Token inválido' });
      return
    }

    // Adiciona os dados do usuário decodificados ao request
    req.user = decoded;
    next();
  } catch (error) {
    if (error instanceof jwt.TokenExpiredError) {
      res.status(401).json({ error: 'Token expirado' });
      return;
    }
    if (error instanceof jwt.JsonWebTokenError) {
      res.status(401).json({ error: 'Token inválido' });
      return;
    }
    res.status(500).json({ error: 'Erro na autenticação' });
    return;
  }
};

export default authMiddleware;
