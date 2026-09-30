import { useCallback, useEffect, useMemo, useState } from "react";
import { TaskRecord } from "../types/tasks";

/* Vibração tátil curta (ignorada se o browser não suportar) */
function haptic(ms: number = 8): void {
  try { if (navigator.vibrate) navigator.vibrate(ms); } catch { /* noop */ }
}

const PARAM = "task";

function readParam(): string | null {
  try { return new URLSearchParams(window.location.search).get(PARAM); } catch { return null; }
}

function writeParam(id: string | null): void {
  try {
    const params = new URLSearchParams(window.location.search);
    if (id) params.set(PARAM, id);
    else params.delete(PARAM);
    const qs = params.toString();
    const url = window.location.pathname + (qs ? `?${qs}` : "") + window.location.hash;
    window.history.replaceState(null, "", url);
  } catch { /* noop */ }
}

export interface UseTaskDetail {
  /** Tarefa atualmente aberta no modal (derivada por id — reflete edições). */
  detailTask: TaskRecord | null;
  /** Abre o modal de detalhes para a tarefa informada. */
  openDetail: (id: number | string) => void;
  /** Fecha o modal. */
  closeDetail: () => void;
}

/**
 * useTaskDetail — estado central do modal de detalhes/edição de tarefa.
 *
 * - Guarda apenas o id e deriva a tarefa de `tasks` (reflete edições em tempo real).
 * - Sincroniza `?task=<id>` na URL (deep-link: recarregar/compartilhar reabre a tarefa).
 * - Dispara vibração tátil ao abrir.
 *
 * Deve viver em um único lugar (ex.: a página) para evitar modais duplicados
 * quando vários painéis apontam para a mesma tarefa.
 */
export function useTaskDetail(tasks: TaskRecord[]): UseTaskDetail {
  const [detailId, setDetailId] = useState<string | null>(() => readParam());

  const detailTask = useMemo<TaskRecord | null>(
    () => (detailId ? tasks.find((t) => String(t.id) === detailId) ?? null : null),
    [detailId, tasks]
  );

  const openDetail = useCallback((id: number | string): void => {
    haptic(8);
    setDetailId(String(id));
  }, []);

  const closeDetail = useCallback((): void => setDetailId(null), []);

  // Mantém a URL em sincronia com o modal aberto.
  useEffect(() => { writeParam(detailId); }, [detailId]);

  return { detailTask, openDetail, closeDetail };
}
