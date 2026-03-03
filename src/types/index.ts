import { Request } from 'express';

// Payload do JWT após decodificação
export interface JwtPayload {
  usuarioId: number;
  cargo: string;
  nomeUsuario: string;
  colaborador_id: number | null;
  iat?: number;
  exp?: number;
}

// Request com usuário autenticado
export interface AuthenticatedRequest extends Request {
  user?: JwtPayload;
}

// DTOs para requests
export interface PaginationQuery {
  page?: string;
  limit?: string;
}

export interface DateRangeQuery {
  data_inicio?: string;
  data_fim?: string;
}

// Response padrão para erros
export interface ErrorResponse {
  error: string;
  details?: string;
}

// Response padrão para sucesso
export interface SuccessResponse<T = unknown> {
  data: T;
  message?: string;
}

// Tipo para status de aprovação
export type StatusAprovacao = 'pendente' | 'aprovado' | 'reprovado';

// Tipo para prioridade de atividade
export type Prioridade = 'baixa' | 'normal' | 'alta' | 'urgente';

// Tipo para status de projeto
export type StatusProjeto = 'Orçando' | 'Em andamento' | 'Concluído' | 'Cancelado' | 'Pausado';

// Tipo para status de atividade
export type StatusAtividade = 'Pendente' | 'Em andamento' | 'Concluída' | 'Cancelada';

// Tipo para cargo de usuário
export type CargoUsuario = 'admin' | 'gerente' | 'colaborador';
