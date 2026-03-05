import 'dotenv/config';
import express, { Application } from "express";
import router from './router';
import { authMiddleware } from './middlewares/auth';
import cors from 'cors'

//types global
import './types';

const PORT = process.env.PORT || 3001;

async function main() {
  try {
    const app: Application = express();
    console.log('Iniciando o servidor...');

    app.use(cors({
      origin: true, // Permite todas as origens em dev
      credentials: true,
    }));

    app.use(express.json({ limit: '10mb' }));

    app.use(authMiddleware); // Middleware de autenticação global

    app.use(router);
    app.listen(PORT, () => {
      console.log(`Servidor rodando na porta ${PORT}`);
      console.log(`Teste em: http://localhost:${PORT}`);
    });

  } catch (error) {
    console.error('Erro ao iniciar o servidor:', error);
    process.exit(1);
  }
}

main();
