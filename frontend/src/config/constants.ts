/**
 * constants.js — Constantes centralizadas do TaskFlow.
 * Importe daqui em vez de hardcodar valores espalhados no código.
 */

/** Timeout por requisição HTTP (ms). Usado em apiClient.js via AbortController. */
export const API_TIMEOUT_MS: number = 9_000;

/** Número máximo de tentativas extras em queries React Query após falha. */
export const MAX_RETRIES: number = 1;

/** Tamanho máximo da fila de sincronização offline (syncQueue.js). */
export const SYNC_QUEUE_MAX: number = 200;

/** Tempo (ms) durante o qual o usuário pode desfazer uma exclusão de tarefa. */
export const UNDO_TIMEOUT_MS: number = 5_000;

/** Prefixo usado em todas as chaves de localStorage do TaskFlow. */
export const STORAGE_PREFIX: string = "taskflow.";

/**
 * Tamanho de página para listagens de tarefas.
 * Atualmente as tarefas são carregadas sem paginação; ajuste conforme necessário.
 */
export const TASK_PAGE_SIZE: number = 50;
