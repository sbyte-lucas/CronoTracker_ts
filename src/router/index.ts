import { Router, Request, Response } from 'express';

// Controllers
import * as relatoriosController from '../controllers/relatorios';
import * as lancamentosController from '../controllers/lancamentos';
import * as logController from '../controllers/logs';
import * as dashboardController from '../controllers/dashboard';
import * as usuariosController from '../controllers/usuarios';
import * as despesasController from '../controllers/despesas';
import * as projetosController from '../controllers/projetos';
import * as atividadesController from '../controllers/atividades';
import * as colaboradoresController from '../controllers/colaboradores';
import * as clientesController from '../controllers/clientes';
import * as loginController from '../controllers/login';

const router = Router();

// Clientes
router.get("/clientes", clientesController.getClientes);
router.get("/clientes/cnpj/:cnpj", clientesController.betClienteByCNPJ);
router.post("/clientes", clientesController.postClientes);
router.put("/clientes/:id", clientesController.putClientes);
router.get("/clientes/:id", clientesController.getClienteById);
router.get("/clientes/:id/projetos", clientesController.getClienteProjetos);
router.delete("/clientes/:id", clientesController.deleteClientes);

// Colaboradores
router.get("/colaboradores", colaboradoresController.getColaboradores);
router.get("/colaboradores/:id", colaboradoresController.getColaboradorById);
router.post("/colaboradores", colaboradoresController.postColaboradores);
router.put("/colaboradores/:id", colaboradoresController.putColaboradores);
router.delete("/colaboradores/:id", colaboradoresController.deleteColaboradores);
router.get("/colaboradores/email/:email", colaboradoresController.getColaboradorByEmail);

// Projetos
router.get("/projetos", projetosController.getProjetos);
router.post("/projetos", projetosController.postProjetos);
router.put("/projetos/:id", projetosController.putProjetos);
router.delete("/projetos/:id", projetosController.deleteProjetos);

// Atividades
router.get("/atividades", atividadesController.getAtividades);
router.get("/atividades/:atividade_id", atividadesController.getAtividadeById);
router.post("/atividades", atividadesController.postAtividades);
router.put("/atividades/:atividade_id", atividadesController.putAtividades);
router.delete("/atividades/:atividade_id", atividadesController.deleteAtividades);

// Despesas
router.post("/despesas", despesasController.postDespesas);
router.patch("/despesas/:id/status", despesasController.patchDespesas);
router.get("/despesas", despesasController.getDespesas);

// Usuários
router.get("/usuarios", usuariosController.getUsuarios);
router.post("/usuarios", usuariosController.postUsuarios);
router.put("/usuarios/:id", usuariosController.putUsuarios);
router.delete("/usuarios/:id", usuariosController.deleteUsuarios);

// Dashboard
router.get("/dashboard/stats/:usuario_id", dashboardController.getStats);

// Relatorios
router.get("/relatorios", relatoriosController.getRelatorios);
router.get("/relatorios/despesas", relatoriosController.getRelatoriosDespesas);

// Lançamentos (timesheet)
router.get("/lancamentos", lancamentosController.getLancamentos);
router.post("/lancamentos", lancamentosController.postLancamentos);
router.put("/lancamentos/:id", lancamentosController.putLancamentos);
router.delete("/lancamentos/:id", lancamentosController.deleteLancamentos);
router.patch("/lancamentos/:id/status", lancamentosController.patchLancamentosStatus);

// Logs de segurança
router.post("/logs", logController.postLog);

// Login
router.post("/login", loginController.login);

// Rota de teste
router.get('/', (req: Request, res: Response) => {
  res.send('Servidor ChronoTracker Backend (TypeScript) rodando com Prisma e Neon!');
});

export default router;
