import { useState, useCallback, useRef } from "react";

/**
 * Hook centralizado para chamadas de API com estado de loading, erro e retry.
 *
 * @param {Function} asyncFn - Função assíncrona que executa a chamada de API.
 *   Pode ser passada no momento do hook ou sobrescrita no execute().
 * @param {Object} options
 * @param {boolean} options.retryable - Se true, tenta novamente até 3x em erro de rede.
 * @param {any} options.initialData - Valor inicial para data.
 *
 * @returns {{ data, error, loading, execute, reset }}
 *
 * @example
 * const { data: tasks, loading, error, execute: fetchTasks } = useApiCall(tasksApi.list);
 * useEffect(() => { fetchTasks(); }, []);
 */

interface UseApiCallOptions<T> {
  retryable?: boolean;
  initialData?: T | null;
}

export function useApiCall<T = unknown>(
  asyncFn: ((...args: unknown[]) => Promise<T>) | undefined,
  options: UseApiCallOptions<T> = {}
): {
  data: T | null;
  error: string | null;
  loading: boolean;
  execute: (...args: unknown[]) => Promise<T | undefined>;
  reset: () => void;
} {
  const { retryable = false, initialData = null } = options;
  const [data, setData] = useState<T | null>(initialData);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState<boolean>(false);
  const retryCountRef = useRef<number>(0);
  const MAX_RETRIES = 3;

  const execute = useCallback(
    async (...args: unknown[]): Promise<T | undefined> => {
      const fn = asyncFn;
      if (!fn) return;

      setLoading(true);
      setError(null);

      const attempt = async (): Promise<T> => {
        try {
          const result = await fn(...args);
          setData(result);
          retryCountRef.current = 0;
          return result;
        } catch (e: any) {
          const isNetwork = e.name === "TypeError" || e.message === "Failed to fetch";
          if (retryable && isNetwork && retryCountRef.current < MAX_RETRIES) {
            retryCountRef.current += 1;
            const delay = 1000 * retryCountRef.current;
            await new Promise((res) => setTimeout(res, delay));
            return attempt();
          }
          setError(e.message ?? "Erro desconhecido.");
          console.error("[useApiCall]", e);
          throw e;
        } finally {
          setLoading(false);
        }
      };

      return attempt();
    },
    [asyncFn, retryable]
  );

  const reset = useCallback((): void => {
    setData(initialData);
    setError(null);
    setLoading(false);
    retryCountRef.current = 0;
  }, [initialData]);

  return { data, error, loading, execute, reset };
}
