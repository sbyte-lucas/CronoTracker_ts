import 'dotenv/config';
import express, { Application } from "express";
// import router from './router';
// import { authMiddleware } from '@/middlewares/auth';
import cors from 'cors'

//types global
import './types';
//init prisma 
// import './prisma';

const PORT = process.env.PORT || 3001;
const app = express();

app.use(cors());
app.use(express.json({ limit: '10mb' }));

// app.use(authMiddleware); // Middleware de autenticação global
// app.use(router);

const server = app.listen(PORT, () => {
  console.log(`Teste em: http://localhost:${PORT}`);
});
console.log(server.listening)