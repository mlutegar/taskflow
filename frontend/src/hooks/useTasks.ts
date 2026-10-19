import { useQuery, useMutation, useQueryClient, useIsMutating } from "@tanstack/react-query";
import { useCallback, useEffect, useRef, useState } from "react";
import { tasksApi } from "../api/tasks";
import { taskKeys } from "../lib/taskKeys";
import { broadcastTasksChanged, subscribeToTaskChanges } from "../lib/taskSync";
import { ApiError } from "../lib/apiClient";
import { subscribeRemoteTaskEvents } from "../lib/taskEventStream";
import {
  flushTaskMutationQueue,
  isQueuedOfflineError,
  subscribeTaskQueue,
} from "../lib/taskOfflineQueue";
import { bumpTodayConsistency } from "./useRoutineConsistency";
import { DAILY_RECURRENCES } from "../lib/dailyRoutine";
import type { TaskChecklistItem, TaskCreateInput, TaskRecord, TaskSyncState, TaskUpdateInput } from "../types/tasks";

type TaskItem = TaskRecord;

/** Só tarefas diárias/dias úteis entram no heatmap de consistência. */
function isRoutineTask(task: TaskItem | undefined): boolean {
  return Boolean(task?.recurrence && DAILY_RECURRENCES.has(task.recurrence));
}
type ChecklistItemFull = TaskChecklistItem;

/**
 * Evita que uma leitura mais antiga sobrescreva um valor mais novo já no cache.
 * O `version` de cada tarefa é monotonicamente incremental no backend (todo
 * update/undo/reopen faz `version: { increment: 1 }`). Logo após um save, três
 * leituras podem reescrever o cache — o refetch do `onSettled`, o eco via SSE
 * (`tasksApi.get`) e o polling de 20s. Se qualquer uma chegar com dado stale
 * (corrida read-after-write, comum em produção), ela revertia a mudança recém
 * salva e a UI só voltava ao certo após um reload. Este guard descarta a
 * escrita quando a versão recebida é MENOR que a já conhecida.
 */
function keepNewer(existing: TaskItem | undefined, incoming: TaskItem): TaskItem {
  if (!existing) return incoming;
  const a = existing.version;
  const b = incoming.version;
  if (typeof a === "number" && typeof b === "number" && b < a) return existing;
  return incoming;
}

/**
 * Hook para tarefas usando React Query.
 * - Cache automático com staleTime de 30s
 * - Optimistic updates via setQueryData
 * - Mutations tipadas com callbacks onSuccess
 */
export function useTasks(
  taskFilter: string | undefined,
  taskSort: string | undefined,
  projectId?: string,
  timeFilter?: string,
  assignedTo?: string,
  priorities?: string,
  dueFilter?: string
) {
  const queryClient = useQueryClient();
  const [completingIds, setCompletingIds] = useState<Set<string>>(new Set());
  const [mutationError, setMutationError] = useState<string | null>(null);
  const [lastSavedAt, setLastSavedAt] = useState<number | null>(null);
  const [online, setOnline] = useState<boolean>(() => navigator.onLine);
  const [pendingOffline, setPendingOffline] = useState(0);
  const [conflict, setConflict] = useState<null | {
    id: string;
    attempted: TaskUpdateInput;
    server: TaskItem;
  }>(null);
  const lastRetryRef = useRef<(() => Promise<unknown>) | null>(null);
  // Tarefas com mutação de update em voo — leituras stale (refetch/SSE/polling)
  // não podem sobrescrever o valor otimista enquanto o servidor não confirmar.
  const inFlightTaskIds = useRef<Set<string>>(new Set());
  // Fila por taskId: serializa updates da MESMA tarefa para evitar 409 quando o
  // usuário edita rápido (a 2ª edição usaria a versão antiga antes do 1º save).
  const updateChains = useRef<Map<string, Promise<unknown>>>(new Map());
  // Enquanto o stream SSE está conectado, o polling pode ser mais espaçado.
  const [sseConnected, setSseConnected] = useState(false);
  const clearMutationError = useCallback(() => setMutationError(null), []);

  const runSerialUpdate = useCallback((id: string, op: () => Promise<unknown>): Promise<unknown> => {
    const prev = updateChains.current.get(id) ?? Promise.resolve();
    const next = prev.catch(() => {}).then(op);
    updateChains.current.set(id, next);
    // Ramo separado só para limpar a fila — engole a rejeição (o chamador já
    // trata a de `next`) para não gerar unhandled rejection.
    next.catch(() => {}).then(() => {
      if (updateChains.current.get(id) === next) updateChains.current.delete(id);
    });
    return next;
  }, []);

  // Campos que podem mudar filtro/ordenação da lista → exigem revalidação.
  const affectsListShape = useCallback((data: TaskUpdateInput): boolean =>
    ["due_date", "priority", "completed", "recurrence", "project_id", "assigned_to"].some((k) => k in (data as object)), []);
  const queryKey    = taskKeys.list(taskFilter, taskSort, projectId, timeFilter, assignedTo, priorities, dueFilter);
  const todayKey    = taskKeys.completedToday();
  const pendingMutations = useIsMutating({ mutationKey: taskKeys.mutations() });

  // ── Queries ────────────────────────────────────────────────────────────────

  const { data: rawTasks = [], isLoading: tasksLoading, error: tasksErrorObj, refetch: refetchTasksQuery } = useQuery<TaskItem[]>({
    queryKey,
    queryFn: async () => {
      const fresh = await tasksApi.list({
        status: taskFilter,
        sort: taskSort,
        projectId,
        time: timeFilter,
        assignedTo,
        priorities,
        dueFilter,
      });
      // Mescla por versão: um refetch/polling que chegue com dado antigo logo
      // após um save não pode reverter a tarefa recém atualizada no cache.
      const prev = queryClient.getQueryData<TaskItem[]>(queryKey);
      if (!prev?.length) return fresh;
      const prevById = new Map(prev.map((t) => [t.id, t]));
      return fresh.map((t) => {
        // Update local em voo: preserva o valor otimista até o servidor confirmar.
        if (inFlightTaskIds.current.has(t.id)) return prevById.get(t.id) ?? t;
        return keepNewer(prevById.get(t.id), t);
      });
    },
    // Com SSE ativo, converge por eventos → polling espaçado (economiza rede/bateria
    // no PWA). Sem SSE, cai para 15s como fallback de convergência.
    refetchInterval: sseConnected ? 60_000 : 15_000,
    refetchIntervalInBackground: false,
    refetchOnWindowFocus: true,
    // Voltar para a aba sempre revalida — torna determinístico o caso em que o
    // primeiro carregamento falhou/expirou e o usuário navega de volta.
    refetchOnMount: "always",
  });

  // Outra aba avisa imediatamente; outro dispositivo converge pelo polling e
  // também ao voltar o foco para a janela.
  useEffect(() => subscribeToTaskChanges(() => {
    queryClient.invalidateQueries({ queryKey: taskKeys.lists() });
    queryClient.invalidateQueries({ queryKey: taskKeys.completedToday() });
  }), [queryClient]);

  // Eventos do servidor atualizam somente a tarefa afetada. Listas completas
  // só são revalidadas quando a tarefa ainda não existe no cache (criação).
  useEffect(() => subscribeRemoteTaskEvents(async (event) => {
    if (!event.taskId) return;
    if (event.type === "task-deleted") {
      queryClient.setQueriesData<TaskItem[]>({ queryKey: taskKeys.lists() }, (old = []) =>
        old.filter((task) => task.id !== event.taskId));
      return;
    }
    // Não sobrescreve uma tarefa cuja mutação local ainda está em voo.
    if (inFlightTaskIds.current.has(event.taskId)) return;
    try {
      // O evento já traz o payload da tarefa (ações de nível de tarefa) — evita
      // um GET extra e a corrida read-after-write. Cai para GET quando ausente
      // (ex.: eventos de checklist, que não anexam a tarefa).
      const task = event.task ?? await tasksApi.get(event.taskId);
      if (inFlightTaskIds.current.has(task.id)) return;
      let found = false;
      queryClient.setQueriesData<TaskItem[]>({ queryKey: taskKeys.lists() }, (old = []) => {
        if (!old.some((item) => item.id === task.id)) return old;
        found = true;
        // Eco do próprio save pode chegar com leitura stale — só aplica se for mais novo.
        return old.map((item) => item.id === task.id ? keepNewer(item, task) : item);
      });
      if (!found) queryClient.invalidateQueries({ queryKey: taskKeys.lists() });
      queryClient.invalidateQueries({ queryKey: todayKey });
    } catch { /* polling/foco continuam como fallback */ }
  }, (connected) => setSseConnected(connected)), [queryClient]);

  useEffect(() => {
    const unsubscribe = subscribeTaskQueue(setPendingOffline);
    const synced = () => {
      queryClient.invalidateQueries({ queryKey: taskKeys.lists() });
      queryClient.invalidateQueries({ queryKey: todayKey });
    };
    window.addEventListener("taskflow:queued-mutation-synced", synced);
    if (navigator.onLine) flushTaskMutationQueue().catch(() => {});
    return () => {
      unsubscribe();
      window.removeEventListener("taskflow:queued-mutation-synced", synced);
    };
  }, [queryClient]);

  useEffect(() => {
    const onOnline = () => setOnline(true);
    const onOffline = () => setOnline(false);
    window.addEventListener("online", onOnline);
    window.addEventListener("offline", onOffline);
    return () => {
      window.removeEventListener("online", onOnline);
      window.removeEventListener("offline", onOffline);
    };
  }, []);

  // Ordenação "overdue" é client-side (não suportada pelo backend)
  const tasks = useCallback(() => {
    if (taskSort !== "overdue") return rawTasks;
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    return [...rawTasks].sort((a, b) => {
      const aO = a.due_date && new Date(a.due_date) < today;
      const bO = b.due_date && new Date(b.due_date) < today;
      if (aO && !bO) return -1;
      if (!aO && bO) return 1;
      if (!a.due_date && !b.due_date) return (a.priority ?? 99) - (b.priority ?? 99);
      if (!a.due_date) return 1;
      if (!b.due_date) return -1;
      return new Date(a.due_date).getTime() - new Date(b.due_date).getTime();
    });
  }, [rawTasks, taskSort])();

  const { data: completedToday = 0 } = useQuery<number>({
    queryKey: todayKey,
    queryFn: tasksApi.countCompletedToday,
    staleTime: 60_000,
  });

  const tasksError: string | null = (tasksErrorObj as Error | null)?.message ?? null;
  // Revalidação manual (botão "Tentar novamente" na UI de erro/timeout).
  const refetchTasks = useCallback((): void => { void refetchTasksQuery(); }, [refetchTasksQuery]);

  // ── Helpers de cache (para delete otimista + undo em App.jsx) ─────────────

  /**
   * A lista que alimenta os painéis da aba Tarefas (`todayPanelAll`) e o
   * heatmap de rotinas vivem FORA de `taskKeys.lists()`. Sem invalidá-las
   * explicitamente, uma tarefa criada/removida só aparecia (ou sumia) depois de
   * recarregar a página.
   */
  const invalidatePanelViews = useCallback((affectsRoutines: boolean) => {
    queryClient.invalidateQueries({ queryKey: taskKeys.todayPanelAll() });
    if (affectsRoutines) queryClient.invalidateQueries({ queryKey: taskKeys.routineConsistency() });
  }, [queryClient]);

  const removeTask = useCallback(
    (id: string) => {
      const cached = queryClient.getQueryData<TaskItem[]>(queryKey)?.find((t) => t.id === id);
      queryClient.setQueryData<TaskItem[]>(queryKey, (old = []) => old.filter((t) => t.id !== id));
      invalidatePanelViews(isRoutineTask(cached));
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [queryClient, invalidatePanelViews, JSON.stringify(queryKey)]
  );

  const restoreTask = useCallback(
    (task: TaskItem) => {
      queryClient.setQueryData<TaskItem[]>(queryKey, (old = []) => [task, ...old]);
      invalidatePanelViews(isRoutineTask(task));
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [queryClient, invalidatePanelViews, JSON.stringify(queryKey)]
  );

  // ── Helpers internos ───────────────────────────────────────────────────────

  const updateCache = useCallback(
    (updated: TaskItem) =>
      queryClient.setQueryData<TaskItem[]>(queryKey, (old = []) =>
        old.map((t) => (t.id === updated.id ? keepNewer(t, updated) : t))
      ),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [queryClient, JSON.stringify(queryKey)]
  );

  // ── Mutations ──────────────────────────────────────────────────────────────

  // Snapshot da lista atual para permitir rollback em caso de falha.
  const snapshot = useCallback(
    () => queryClient.getQueryData<TaskItem[]>(queryKey),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [queryClient, JSON.stringify(queryKey)]
  );
  const reportError = useCallback((err: Error) => {
    if (isQueuedOfflineError(err)) return;
    setMutationError(
      navigator.onLine
        ? (err.message || "Não foi possível salvar. Tente novamente.")
        : "Sem conexão — a alteração não foi salva. Reconecte e tente novamente."
    );
  }, []);
  const rollback = useCallback(
    (previous: TaskItem[] | undefined, err: Error) => {
      if (isQueuedOfflineError(err)) return;
      if (previous) queryClient.setQueryData(queryKey, previous);
      reportError(err);
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [queryClient, reportError, JSON.stringify(queryKey)]
  );

  const markSynced = useCallback(() => {
    setMutationError(null);
    setLastSavedAt(Date.now());
    broadcastTasksChanged();
  }, []);

  const remember = useCallback(<T,>(operation: () => Promise<T>): Promise<T> => {
    const attempt = () => operation().then((result) => {
      lastRetryRef.current = null;
      return result;
    });
    lastRetryRef.current = attempt;
    setMutationError(null);
    return attempt().catch((error) => {
      if (isQueuedOfflineError(error)) return undefined as T;
      throw error;
    });
  }, []);

  const retryLastMutation = useCallback((): Promise<unknown> => {
    setMutationError(null);
    return lastRetryRef.current?.() ?? Promise.resolve();
  }, []);

  const createMutation = useMutation<TaskItem, Error, TaskCreateInput, { previous?: TaskItem[]; tempId: string }>({
    mutationKey: taskKeys.mutation("create"),
    mutationFn: (data) => tasksApi.create(data),
    onMutate: async (data) => {
      await queryClient.cancelQueries({ queryKey });
      const previous = snapshot();
      const tempId = data.client_id ?? `temp-${Date.now()}-${Math.random().toString(36).slice(2)}`;
      const optimistic = {
        checklist: [],
        checklist_count: 0,
        checklist_completed_count: 0,
        ...(data as object),
        id: tempId,
      } as TaskItem;
      queryClient.setQueryData<TaskItem[]>(queryKey, (old = []) => [optimistic, ...old]);
      return { previous, tempId };
    },
    onSuccess: (task, _data, ctx) => {
      // Troca a tarefa temporária pela real assim que o servidor confirma.
      queryClient.setQueryData<TaskItem[]>(queryKey, (old = []) =>
        old.map((t) => (t.id === ctx?.tempId ? task : t))
      );
      markSynced();
    },
    onError: (err, _data, ctx) => rollback(ctx?.previous, err),
    onSettled: (task, _err, variables) => {
      queryClient.invalidateQueries({ queryKey: taskKeys.lists() });
      // A recorrência vem do payload enviado; o retorno confirma (offline → só o payload).
      const recurrence = task?.recurrence ?? (variables as TaskCreateInput)?.recurrence;
      invalidatePanelViews(Boolean(recurrence && DAILY_RECURRENCES.has(recurrence)));
    },
  });

  const completeMutation = useMutation<TaskItem, Error, string>({
    mutationKey: taskKeys.mutation("complete"),
    mutationFn: (id) => tasksApi.complete(id),
    onMutate: (id) => setCompletingIds((old) => new Set(old).add(String(id))),
    onSuccess: (task) => {
      updateCache(task);
      markSynced();
      // Heatmap de consistência: célula de hoje + estatísticas na hora.
      if (isRoutineTask(task)) bumpTodayConsistency(queryClient, String(task.id), true);
      // Mantém os caches de Todas/Hoje/Ativas/Concluídas coerentes depois
      // que uma recorrência passa o restante do dia como concluída.
      queryClient.invalidateQueries({ queryKey: taskKeys.lists() });
      queryClient.invalidateQueries({ queryKey: todayKey });
    },
    onError: reportError,
    onSettled: (_data, _error, id) => setCompletingIds((old) => {
      const next = new Set(old); next.delete(String(id)); return next;
    }),
  });

  const undoCompleteMutation = useMutation<TaskItem, Error, { id: string; completionId: string }>({
    mutationKey: taskKeys.mutation("undo-complete"),
    mutationFn: ({ id, completionId }) => tasksApi.undoComplete(id, completionId),
    onSuccess: (task) => {
      updateCache(task);
      markSynced();
      if (isRoutineTask(task)) bumpTodayConsistency(queryClient, String(task.id), false);
      queryClient.invalidateQueries({ queryKey: taskKeys.lists() });
    },
    onError: reportError,
  });

  const reopenMutation = useMutation<TaskItem, Error, string>({
    mutationKey: taskKeys.mutation("reopen"),
    mutationFn: (id) => tasksApi.reopen(id),
    onSuccess: (task) => {
      updateCache(task);
      markSynced();
      if (isRoutineTask(task)) bumpTodayConsistency(queryClient, String(task.id), false);
      queryClient.invalidateQueries({ queryKey: todayKey });
    },
    onError: reportError,
  });

  const updateMutation = useMutation<TaskItem, Error, { id: string; data: TaskUpdateInput }, { previous?: TaskItem[] }>({
    mutationKey: taskKeys.mutation("update"),
    mutationFn: ({ id, data }) => {
      // Anexa a versão atual em cache para detecção de conflito no servidor.
      const current = (snapshot() ?? []).find((t) => t.id === id);
      const payload =
        current && typeof current.version === "number"
          ? { ...(data as object), version: current.version }
          : data;
      return tasksApi.update(id, payload);
    },
    onMutate: async ({ id, data }) => {
      await queryClient.cancelQueries({ queryKey });
      inFlightTaskIds.current.add(id);
      const previous = snapshot();
      queryClient.setQueryData<TaskItem[]>(queryKey, (old = []) =>
        old.map((t) => (t.id === id ? { ...t, ...(data as object) } : t))
      );
      return { previous };
    },
    onSuccess: (task) => { updateCache(task); markSynced(); },
    onError: (err, variables, ctx) => {
      if (err instanceof ApiError && err.status === 409) {
        const server = (err.data as { task?: TaskItem } | null)?.task;
        if (server) setConflict({ id: variables.id, attempted: variables.data, server });
      }
      rollback(ctx?.previous, err);
    },
    onSettled: (_data, _err, variables) => {
      inFlightTaskIds.current.delete(variables.id);
      // Só revalida a lista quando o campo alterado pode mudar filtro/ordenação
      // (prazo, prioridade, conclusão, recorrência, projeto). Para o resto, o
      // `updateCache` já é a fonte de verdade — evita refetch a cada tecla.
      if (affectsListShape(variables.data)) {
        queryClient.invalidateQueries({ queryKey: taskKeys.lists() });
        // Editar a recorrência promove/rebaixa a tarefa a rotina: os painéis e o
        // heatmap precisam reavaliar quem entra.
        invalidatePanelViews("recurrence" in (variables.data as object));
      }
    },
  });

  const addChecklistMutation = useMutation<
    ChecklistItemFull,
    Error,
    { taskId: string; description: string; parentId: string | null },
    { previous?: TaskItem[]; tempId: string }
  >({
    mutationKey: taskKeys.mutation("checklist-add"),
    mutationFn: ({ taskId, description, parentId }) =>
      tasksApi.addChecklistItem(taskId, description, parentId),
    onMutate: async ({ taskId, description, parentId }) => {
      await queryClient.cancelQueries({ queryKey });
      const previous = snapshot();
      const tempId = `temp-${Date.now()}-${Math.random().toString(36).slice(2)}`;
      const optimistic = { id: tempId, description, parent_id: parentId, completed: false } as ChecklistItemFull;
      queryClient.setQueryData<TaskItem[]>(queryKey, (old = []) =>
        old.map((t) =>
          t.id === taskId
            ? { ...t, checklist: [...t.checklist, optimistic], checklist_count: t.checklist_count + 1 }
            : t
        )
      );
      return { previous, tempId };
    },
    onSuccess: (item, { taskId }, ctx) => {
      queryClient.setQueryData<TaskItem[]>(queryKey, (old = []) =>
        old.map((t) =>
          t.id === taskId
            ? { ...t, checklist: t.checklist.map((c) => (c.id === ctx?.tempId ? item : c)) }
            : t
        )
      );
      markSynced();
    },
    onError: (err, _v, ctx) => rollback(ctx?.previous, err),
    // Add de subtarefa só muda contagem do checklist (não afeta ordem/filtro da
    // lista): o cache otimista já basta, sem refetch da lista inteira.
  });

  const toggleChecklistMutation = useMutation<
    ChecklistItemFull,
    Error,
    { taskId: string; itemId: string },
    { previous?: TaskItem[] }
  >({
    mutationKey: taskKeys.mutation("checklist-toggle"),
    mutationFn: ({ taskId, itemId }) => tasksApi.toggleChecklistItem(taskId, itemId),
    onMutate: async ({ taskId, itemId }) => {
      await queryClient.cancelQueries({ queryKey });
      const previous = snapshot();
      queryClient.setQueryData<TaskItem[]>(queryKey, (old = []) =>
        old.map((t) => {
          if (t.id !== taskId) return t;
          const newChecklist = t.checklist.map((c) =>
            c.id === itemId ? { ...c, completed: !c.completed } : c
          );
          return {
            ...t,
            checklist: newChecklist,
            checklist_completed_count: newChecklist.filter((c) => c.completed).length,
          };
        })
      );
      return { previous };
    },
    onSuccess: (item, { taskId, itemId }) => {
      queryClient.setQueryData<TaskItem[]>(queryKey, (old = []) =>
        old.map((t) => {
          if (t.id !== taskId) return t;
          const newChecklist = t.checklist.map((c) => (c.id === itemId ? item : c));
          return {
            ...t,
            checklist: newChecklist,
            checklist_completed_count: newChecklist.filter((c) => c.completed).length,
          };
        })
      );
      markSynced();
    },
    onError: (err, _v, ctx) => rollback(ctx?.previous, err),
  });

  const updateChecklistMutation = useMutation<
    ChecklistItemFull,
    Error,
    { taskId: string; itemId: string; fields: unknown },
    { previous?: TaskItem[] }
  >({
    mutationKey: taskKeys.mutation("checklist-update"),
    mutationFn: ({ taskId, itemId, fields }) =>
      tasksApi.updateChecklistItem(taskId, itemId, fields),
    onMutate: async ({ taskId, itemId, fields }) => {
      await queryClient.cancelQueries({ queryKey });
      const previous = snapshot();
      const patch = typeof fields === "string" ? { description: fields } : (fields as object);
      queryClient.setQueryData<TaskItem[]>(queryKey, (old = []) =>
        old.map((t) =>
          t.id === taskId
            ? { ...t, checklist: t.checklist.map((c) => (c.id === itemId ? { ...c, ...patch } : c)) }
            : t
        )
      );
      return { previous };
    },
    onSuccess: (item, { taskId, itemId }) => {
      queryClient.setQueryData<TaskItem[]>(queryKey, (old = []) =>
        old.map((t) => {
          if (t.id !== taskId) return t;
          return { ...t, checklist: t.checklist.map((c) => (c.id === itemId ? item : c)) };
        })
      );
      markSynced();
    },
    onError: (err, _v, ctx) => rollback(ctx?.previous, err),
  });

  const addChecklistBatchMutation = useMutation<
    ChecklistItemFull[],
    Error,
    { taskId: string; items: Array<{ description: string; parent_id?: string | number | null; order?: number }> },
    { previous?: TaskItem[]; tempIds: string[] }
  >({
    mutationKey: taskKeys.mutation("checklist-batch-add"),
    mutationFn: ({ taskId, items }) => tasksApi.addChecklistBatch(taskId, items),
    onMutate: async ({ taskId, items }) => {
      await queryClient.cancelQueries({ queryKey });
      const previous = snapshot();
      const tempIds = items.map((_, i) => `temp-batch-${Date.now()}-${i}`);
      const optimisticItems = items.map((item, i) => ({
        id: tempIds[i],
        description: item.description,
        parent_id: item.parent_id,
        completed: false,
        order: item.order ?? i,
      } as ChecklistItemFull));

      queryClient.setQueryData<TaskItem[]>(queryKey, (old = []) =>
        old.map((t) =>
          t.id === taskId
            ? {
                ...t,
                checklist: [...t.checklist, ...optimisticItems],
                checklist_count: t.checklist_count + optimisticItems.length,
              }
            : t
        )
      );
      return { previous, tempIds };
    },
    onSuccess: (newItems, { taskId }, ctx) => {
      queryClient.setQueryData<TaskItem[]>(queryKey, (old = []) =>
        old.map((t) => {
          if (t.id !== taskId) return t;
          let checklist = [...t.checklist];
          // Substituir tempIds pelos IDs reais
          ctx?.tempIds.forEach((tempId, index) => {
            const realItem = newItems[index];
            if (realItem) {
              checklist = checklist.map(c => c.id === tempId ? realItem : c);
            }
          });
          return { ...t, checklist };
        })
      );
      markSynced();
    },
    onError: (err, _v, ctx) => rollback(ctx?.previous, err),
  });

  const reorderChecklistMutation = useMutation<
    ChecklistItemFull,
    Error,
    { taskId: string; itemId: string; newOrder: number },
    { previous?: TaskItem[] }
  >({
    mutationKey: taskKeys.mutation("checklist-reorder"),
    mutationFn: ({ taskId, itemId, newOrder }) =>
      tasksApi.reorderChecklistItem(taskId, itemId, newOrder),
    onMutate: async ({ taskId, itemId, newOrder }) => {
      await queryClient.cancelQueries({ queryKey });
      const previous = snapshot();
      queryClient.setQueryData<TaskItem[]>(queryKey, (old = []) =>
        old.map((t) =>
          t.id === taskId
            ? { ...t, checklist: t.checklist.map((c) => (c.id === itemId ? { ...c, order: newOrder } : c)) }
            : t
        )
      );
      return { previous };
    },
    onSuccess: (item, { taskId, itemId }) => {
      queryClient.setQueryData<TaskItem[]>(queryKey, (old = []) =>
        old.map((t) => {
          if (t.id !== taskId) return t;
          return { ...t, checklist: t.checklist.map((c) => (c.id === itemId ? item : c)) };
        })
      );
      markSynced();
    },
    onError: (err, _v, ctx) => rollback(ctx?.previous, err),
  });

  const removeChecklistSubtree = (checklist: ChecklistItemFull[], itemId: string) => {
    const toRemove = new Set([itemId]);
    let changed = true;
    while (changed) {
      changed = false;
      for (const c of checklist) {
        if (c.parent_id != null && toRemove.has(c.parent_id as string) && !toRemove.has(c.id)) {
          toRemove.add(c.id);
          changed = true;
        }
      }
    }
    return checklist.filter((c) => !toRemove.has(c.id));
  };

  const deleteChecklistMutation = useMutation<
    unknown,
    Error,
    { taskId: string; itemId: string },
    { previous?: TaskItem[] }
  >({
    mutationKey: taskKeys.mutation("checklist-delete"),
    mutationFn: ({ taskId, itemId }) => tasksApi.deleteChecklistItem(taskId, itemId),
    onMutate: async ({ taskId, itemId }) => {
      await queryClient.cancelQueries({ queryKey });
      const previous = snapshot();
      queryClient.setQueryData<TaskItem[]>(queryKey, (old = []) =>
        old.map((t) => {
          if (t.id !== taskId) return t;
          const newChecklist = removeChecklistSubtree(t.checklist, itemId);
          return {
            ...t,
            checklist: newChecklist,
            checklist_count: newChecklist.length,
            checklist_completed_count: newChecklist.filter((c) => c.completed).length,
          };
        })
      );
      return { previous };
    },
    onError: (err, _v, ctx) => rollback(ctx?.previous, err),
    onSuccess: markSynced,
    // Delete de subtarefa só muda contagem do checklist — sem refetch da lista.
  });

  const resolveConflict = useCallback(async (choice: "mine" | "server" | "merge") => {
    if (!conflict) return;
    if (choice === "server") {
      updateCache(conflict.server);
      setConflict(null);
      return;
    }
    let patch: TaskUpdateInput = { ...conflict.attempted, version: conflict.server.version };
    if (choice === "merge" && typeof conflict.attempted.description === "string") {
      const serverDescription = conflict.server.description?.trim() ?? "";
      const mine = conflict.attempted.description.trim();
      if (serverDescription && mine && serverDescription !== mine) {
        patch = { ...patch, description: `${serverDescription}\n\n${mine}` };
      }
    }
    const updated = await tasksApi.update(conflict.id, patch);
    updateCache(updated);
    setConflict(null);
    markSynced();
  }, [conflict, markSynced, updateCache]);

  // ── Interface pública ──────────────────────────────────────────────────────

  return {
    tasks,
    tasksLoading,
    tasksError,
    refetchTasks,
    completedToday,
    completingIds,
    // Feedback de sincronização/erro das mutations otimistas
    mutationError,
    clearMutationError,
    retryLastMutation,
    lastSavedAt,
    pendingOffline,
    conflict,
    resolveConflict,
    syncState: (
      pendingMutations > 0
        ? "saving"
          : pendingOffline > 0
            ? "pending"
          : mutationError
          ? (online ? "error" : "offline")
          : lastSavedAt
            ? "saved"
            : "idle"
    ) as TaskSyncState,
    isSyncing: pendingMutations > 0,
    // Para delete otimista + undo (App.jsx)
    removeTask,
    restoreTask,
    // Handlers
    handleCreateTask:          (data: TaskCreateInput)               => {
      const withClientId = { ...data, client_id: data.client_id ?? crypto.randomUUID() };
      return remember(() => createMutation.mutateAsync(withClientId));
    },
    handleCompleteTask:        (id: string)                          => remember(() => completeMutation.mutateAsync(id)),
    handleUndoCompleteTask:    (id: string, completionId: string)    => remember(() => undoCompleteMutation.mutateAsync({ id, completionId })),
    handleReopenTask:          (id: string)                          => remember(() => reopenMutation.mutateAsync(id)),
    handleUpdateTask:          (id: string, data: TaskUpdateInput)   => remember(() => runSerialUpdate(id, () => updateMutation.mutateAsync({ id, data }))),
    handleAddTaskChecklist:    (taskId: string, description: string, parentId: string | null = null) =>
      remember(() => addChecklistMutation.mutateAsync({ taskId, description, parentId })),
    handleAddTaskChecklistBatch: (taskId: string, items: Array<{ description: string; parent_id?: string | number | null; order?: number }>) =>
      remember(() => addChecklistBatchMutation.mutateAsync({ taskId, items })),
    handleToggleTaskChecklist: (taskId: string, itemId: string)      => remember(() => toggleChecklistMutation.mutateAsync({ taskId, itemId })),
    handleUpdateTaskChecklist: (taskId: string, itemId: string, fields: unknown) => remember(() => updateChecklistMutation.mutateAsync({ taskId, itemId, fields })),
    handleReorderTaskChecklist: (taskId: string, itemId: string, newOrder: number) => remember(() => reorderChecklistMutation.mutateAsync({ taskId, itemId, newOrder })),
    handleDeleteTaskChecklist: (taskId: string, itemId: string)      => remember(() => deleteChecklistMutation.mutateAsync({ taskId, itemId })),
    // Mutations para acesso direto (ChecklistInFocus)
    addChecklistMutation,
    addChecklistBatchMutation,
    toggleChecklistMutation,
    updateChecklistMutation,
    reorderChecklistMutation,
    deleteChecklistMutation,
  };
}
