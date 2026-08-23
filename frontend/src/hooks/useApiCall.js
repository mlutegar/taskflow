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
export function useApiCall(asyncFn, options = {}) {
  const { retryable = false, initialData = null } = options;
  const [data, setData] = useState(initialData);
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(false);
  const retryCountRef = useRef(0);
  const MAX_RETRIES = 3;

  const execute = useCallback(
    async (...args) => {
      const fn = asyncFn;
      if (!fn) return;

      setLoading(true);
      setError(null);

      const attempt = async () => {
        try {
          const result = await fn(...args);
          setData(result);
          retryCountRef.current = 0;
          return result;
        } catch (e) {
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

  const reset = useCallback(() => {
    setData(initialData);
    setError(null);
    setLoading(false);
    retryCountRef.current = 0;
  }, [initialData]);

  return { data, error, loading, execute, reset };
}
