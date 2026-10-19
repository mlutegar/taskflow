/**
 * useRoutineConsistency — dados do heatmap de consistência das rotinas.
 *
 * Uma única query agregada por período (nada de uma query por célula) e
 * cálculos memoizados. O período escolhido persiste em localStorage.
 *
 * O filtro por rotina é 100% client-side: a resposta já traz, por dia, os
 * índices das rotinas agendadas/concluídas, então trocar o filtro não dispara
 * refetch nenhum.
 */

import { useCallback, useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";

import { tasksApi, type RoutineConsistencyResponse } from "../api/tasks";
import { taskKeys } from "../lib/taskKeys";
import {
  buildHeatmapGrid,
  computeStats,
  monthLabels,
  projectDays,
  rangeBounds,
  toISO,
  DEFAULT_RANGE,
  type HeatmapRange,
} from "../lib/routineConsistency";

const RANGE_KEY = "routineHeatmap_range";
const VALID_RANGES: HeatmapRange[] = ["30d", "3m", "6m", "1y"];

function loadRange(): HeatmapRange {
  try {
    const raw = localStorage.getItem(RANGE_KEY) as HeatmapRange | null;
    return raw && VALID_RANGES.includes(raw) ? raw : DEFAULT_RANGE;
  } catch {
    return DEFAULT_RANGE;
  }
}

/** Chave base da query (ver `taskKeys.routineConsistency`). */
const ROUTINE_CONSISTENCY_KEY = taskKeys.routineConsistency();

/** `null` = todas as rotinas. */
export type RoutineFilter = string | null;

export function useRoutineConsistency() {
  const [range, setRangeState] = useState<HeatmapRange>(loadRange);
  const [routineId, setRoutineId] = useState<RoutineFilter>(null);

  const today = useMemo(() => toISO(new Date()), []);
  const { from, to } = useMemo(() => rangeBounds(range, today), [range, today]);

  const setRange = useCallback((next: HeatmapRange) => {
    setRangeState(next);
    try { localStorage.setItem(RANGE_KEY, next); } catch { /* noop */ }
  }, []);

  const query = useQuery<RoutineConsistencyResponse>({
    queryKey: [...ROUTINE_CONSISTENCY_KEY, from, to],
    queryFn: () => tasksApi.routineConsistency(from, to),
    staleTime: 5 * 60_000,
  });

  const routines = useMemo(() => query.data?.routines ?? [], [query.data?.routines]);

  // Índice da rotina filtrada; se ela sumiu (excluída), volta para "todas".
  const routineIndex = useMemo(() => {
    if (!routineId) return null;
    const i = routines.findIndex((r) => r.id === routineId);
    return i >= 0 ? i : null;
  }, [routineId, routines]);

  const days = useMemo(
    () => projectDays(query.data?.days ?? [], routineIndex),
    [query.data?.days, routineIndex],
  );

  // `from` ancora a grade: o período inteiro é desenhado mesmo quando a API
  // devolve poucos dias (rotina recém-criada, cache antigo, offline).
  const weeks = useMemo(() => buildHeatmapGrid(days, today, from), [days, today, from]);
  const labels = useMemo(() => monthLabels(weeks), [weeks]);

  // Com filtro ativo, o recorde histórico é o daquela rotina.
  const backendBest = routineIndex === null
    ? query.data?.best_streak
    : query.data?.best_streak_by_routine?.[routineIndex];

  const stats = useMemo(
    () => computeStats(days, today, backendBest),
    [days, today, backendBest],
  );

  return {
    range,
    setRange,
    routines,
    routineId,
    setRoutineId,
    today,
    weeks,
    monthLabels: labels,
    stats,
    isLoading: query.isLoading,
    // "Vazio" = não há rotina nenhuma. A grade em si nunca fica vazia: ela
    // desenha o período inteiro em cinza.
    isEmpty: !query.isLoading && routines.length === 0,
  };
}

/**
 * Ajusta o dia de HOJE no cache após marcar/desmarcar uma rotina, para a
 * célula e as estatísticas atualizarem na hora, sem refetch.
 */
export function bumpTodayConsistency(
  queryClient: ReturnType<typeof useQueryClient>,
  taskId: string,
  done: boolean,
): void {
  const today = toISO(new Date());
  queryClient.setQueriesData<RoutineConsistencyResponse>(
    { queryKey: ROUTINE_CONSISTENCY_KEY },
    (old) => {
      if (!old?.days?.length) return old;
      const index = old.routines?.findIndex((r) => r.id === taskId) ?? -1;
      if (index < 0) return old; // rotina ainda não está na resposta em cache
      let touched = false;
      const days = old.days.map((day) => {
        if (day.date !== today) return day;
        const has = day.completed.includes(index);
        if (has === done) return day;
        touched = true;
        return {
          ...day,
          completed: done
            ? [...day.completed, index]
            : day.completed.filter((i) => i !== index),
        };
      });
      return touched ? { ...old, days } : old;
    },
  );
}
