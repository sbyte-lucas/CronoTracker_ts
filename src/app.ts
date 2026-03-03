import express, { Application, Request, Response } from 'express';
import cors from 'cors';
import router from './router';

const app: Application = express();

app.use(cors({
  origin: true, // Permite todas as origens em dev
  credentials: true,
}));

app.use(express.json({ limit: '10mb' }));

app.use(router);

export default app;
