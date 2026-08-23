/**
 * queryClient.js — Instância centralizada do QueryClient do React Query.
 *
 * Usa MutationCache com um notificador de erros plugável. O handler é registrado
 * de dentro da árvore React (via QueryErrorHandler) assim que o ToastProvider
 * estiver disponível, sem usar variáveis globais em window.
 */

import { QueryClient, MutationCache } from "@tanstack/react-query";

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
      retry: 1,
    },
  },
});
