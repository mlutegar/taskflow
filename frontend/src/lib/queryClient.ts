/**
 * queryClient.js — Instância centralizada do QueryClient do React Query.
 *
 * Usa MutationCache com um notificador de erros plugável. O handler é registrado
 * de dentro da árvore React (via QueryErrorHandler) assim que o ToastProvider
 * estiver disponível, sem usar variáveis globais em window.
 */

import { QueryClient, MutationCache } from "@tanstack/react-query";
import { ApiError } from "./apiClient";

// Status HTTP "definitivos" (erro de negócio/permissão): repetir não ajuda.
const NON_RETRYABLE_STATUS = new Set([400, 401, 403, 404, 409, 422]);

/** Função de notificação de erros, registrada via setMutationErrorHandler(). */
let _errorHandler: ((message: string, type: string) => void) | null = null;

/**
 * Registra o handler de erro para mutações falhas.
 * Chamado uma vez dentro do componente QueryErrorHandler.
 */
export function setMutationErrorHandler(fn: ((message: string, type: string) => void) | null): void {
  _errorHandler = fn;
}

export const queryClient = new QueryClient({
  mutationCache: new MutationCache({
    onError: (error: unknown) => {
      const message = (error as Error)?.message || "Ocorreu um erro inesperado.";
      _errorHandler?.(message, "error");
    },
  }),
  defaultOptions: {
    queries: {
      staleTime: 30_000,
      // Backend "frio"/renovação de token na primeira conexão: retries com
      // backoff dão tempo do servidor aquecer e do refresh concluir antes de
      // desistir. Erros definitivos (negócio/auth) falham na hora — não adianta
      // repetir um 404/422/401 já resolvido pelo fluxo de refresh.
      retry: (count, error) => {
        if (error instanceof ApiError && NON_RETRYABLE_STATUS.has(error.status)) return false;
        return count < 2;
      },
      retryDelay: (attempt) => Math.min(1000 * 2 ** attempt, 8000),
    },
  },
});
