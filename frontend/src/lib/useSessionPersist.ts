/**
 * useSessionPersist — persiste o estado de uma sessão de modo no localStorage.
 *
 * Uso:
 *   const { saved, persist, clearSaved } = useSessionPersist("tiktok");
 *
 *   // No useState, inicializa do estado salvo:
 *   const [cycle, setCycle] = useState(saved?.cycle ?? 1);
 *
 *   // No useEffect, salva toda vez que o estado mudar:
 *   useEffect(() => {
 *     persist({ step, cycle, ... });
 *   }, [step, cycle, ...]);
 *
 *   // Ao encerrar a sessão, limpa:
 *   clearSaved();
 */
import { useRef } from "react";

export function useSessionPersist(key: string): {
  saved: unknown;
  persist: (state: unknown) => void;
  clearSaved: () => void;
} {
  const storageKey = `taskflow_sess_${key}`;

  // Lê uma única vez (sincrono, no momento do hook init)
  const savedRef = useRef<unknown>(null);
  if (savedRef.current === null) {
    try {
      const raw = localStorage.getItem(storageKey);
      savedRef.current = raw ? JSON.parse(raw) : undefined;
    } catch {
      savedRef.current = undefined;
    }
  }

  const persist = (state: unknown): void => {
    try {
      localStorage.setItem(storageKey, JSON.stringify(state));
    } catch {}
  };

  const clearSaved = (): void => {
    try {
      localStorage.removeItem(storageKey);
    } catch {}
  };

  return {
    /** Estado salvo anteriormente (undefined se não havia nada). */
    saved: savedRef.current,
    persist,
    clearSaved,
  };
}
