import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useCallback } from "react";
import { tasksApi } from "../api/tasks";

interface TaskItem {
  id: string;
  due_date?: string | null;
  priority?: number | null;
  checklist: ChecklistItemFull[];
  checklist_count: number;
  checklist_completed_count: number;
  [key: string]: unknown;
}

interface ChecklistItemFull {
  id: string;
  completed: boolean;
  parent_id?: string | null;
  [key: string]: unknown;
}

/**
 * Hook para tarefas usando React Query.
 * - Cache automático com staleTime de 30s
 * - Optimistic updates via setQueryData
 * - Mutations tipadas com callbacks onSuccess
 */
export function useTasks(taskFilter: string | undefined, taskSort: string | undefined) {
  const queryClient = useQueryClient();
  const queryKey    = ["tasks", taskFilter, taskSort];
  const todayKey    = ["tasks", "completed-today"];

  // ── Queries ────────────────────────────────────────────────────────────────

  const { data: rawTasks = [], isLoading: tasksLoading, error: tasksErrorObj } = useQuery<TaskItem[]>({
    queryKey,
    queryFn: () => tasksApi.list({ status: taskFilter, sort: taskSort }),
  });

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

  // ── Helpers de cache (para delete otimista + undo em App.jsx) ─────────────

  const removeTask = useCallback(
    (id: string) => queryClient.setQueryData<TaskItem[]>(queryKey, (old = []) => old.filter((t) => t.id !== id)),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [queryClient, JSON.stringify(queryKey)]
  );

  const restoreTask = useCallback(
    (task: TaskItem) => queryClient.setQueryData<TaskItem[]>(queryKey, (old = []) => [task, ...old]),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [queryClient, JSON.stringify(queryKey)]
  );

  // ── Helpers internos ───────────────────────────────────────────────────────

  const updateCache = useCallback(
    (updated: TaskItem) =>
      queryClient.setQueryData<TaskItem[]>(queryKey, (old = []) =>
        old.map((t) => (t.id === updated.id ? updated : t))
      ),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [queryClient, JSON.stringify(queryKey)]
  );

  // ── Mutations ──────────────────────────────────────────────────────────────

  const createMutation = useMutation<TaskItem, Error, unknown>({
    mutationFn: (data) => tasksApi.create(data),
    onSuccess: (task) =>
      queryClient.setQueryData<TaskItem[]>(queryKey, (old = []) => [task, ...old]),
  });

  const completeMutation = useMutation<TaskItem, Error, string>({
    mutationFn: (id) => tasksApi.complete(id),
    onSuccess: (task) => {
      updateCache(task);
      queryClient.invalidateQueries({ queryKey: todayKey });
    },
  });

  const reopenMutation = useMutation<TaskItem, Error, string>({
    mutationFn: (id) => tasksApi.reopen(id),
    onSuccess: (task) => {
      updateCache(task);
      queryClient.invalidateQueries({ queryKey: todayKey });
    },
  });

  const updateMutation = useMutation<TaskItem, Error, { id: string; data: unknown }>({
    mutationFn: ({ id, data }) => tasksApi.update(id, data),
    onSuccess: updateCache,
  });

  const addChecklistMutation = useMutation<
    ChecklistItemFull,
    Error,
    { taskId: string; description: string; parentId: string | null }
  >({
    mutationFn: ({ taskId, description, parentId }) =>
      tasksApi.addChecklistItem(taskId, description, parentId),
    onSuccess: (item, { taskId }) =>
      queryClient.setQueryData<TaskItem[]>(queryKey, (old = []) =>
        old.map((t) =>
          t.id === taskId
            ? { ...t, checklist: [...t.checklist, item], checklist_count: t.checklist_count + 1 }
            : t
        )
      ),
  });

  const toggleChecklistMutation = useMutation<
    ChecklistItemFull,
    Error,
    { taskId: string; itemId: string }
  >({
    mutationFn: ({ taskId, itemId }) => tasksApi.toggleChecklistItem(taskId, itemId),
    onSuccess: (item, { taskId, itemId }) =>
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
      ),
  });

  const updateChecklistMutation = useMutation<
    ChecklistItemFull,
    Error,
    { taskId: string; itemId: string; fields: unknown }
  >({
    mutationFn: ({ taskId, itemId, fields }) =>
      tasksApi.updateChecklistItem(taskId, itemId, fields),
    onSuccess: (item, { taskId, itemId }) =>
      queryClient.setQueryData<TaskItem[]>(queryKey, (old = []) =>
        old.map((t) => {
          if (t.id !== taskId) return t;
          return { ...t, checklist: t.checklist.map((c) => (c.id === itemId ? item : c)) };
        })
      ),
  });

  const deleteChecklistMutation = useMutation<
    unknown,
    Error,
    { taskId: string; itemId: string }
  >({
    mutationFn: ({ taskId, itemId }) => tasksApi.deleteChecklistItem(taskId, itemId),
    onSuccess: (_, { taskId, itemId }) =>
      queryClient.setQueryData<TaskItem[]>(queryKey, (old = []) =>
        old.map((t) => {
          if (t.id !== taskId) return t;
          const toRemove = new Set([itemId]);
          let changed = true;
          while (changed) {
            changed = false;
            for (const c of t.checklist) {
              if (c.parent_id != null && toRemove.has(c.parent_id as string) && !toRemove.has(c.id)) {
                toRemove.add(c.id);
                changed = true;
              }
            }
          }
          const newChecklist = t.checklist.filter((c) => !toRemove.has(c.id));
          return {
            ...t,
            checklist: newChecklist,
            checklist_count: newChecklist.length,
            checklist_completed_count: newChecklist.filter((c) => c.completed).length,
          };
        })
      ),
  });

  // ── Interface pública ──────────────────────────────────────────────────────

  return {
    tasks,
    tasksLoading,
    tasksError,
    completedToday,
    // Para delete otimista + undo (App.jsx)
    removeTask,
    restoreTask,
    // Handlers
    handleCreateTask:          (data: unknown)                       => createMutation.mutateAsync(data),
    handleCompleteTask:        (id: string)                          => completeMutation.mutateAsync(id),
    handleReopenTask:          (id: string)                          => reopenMutation.mutateAsync(id),
    handleUpdateTask:          (id: string, data: unknown)           => updateMutation.mutateAsync({ id, data }),
    handleAddTaskChecklist:    (taskId: string, description: string, parentId: string | null = null) =>
      addChecklistMutation.mutateAsync({ taskId, description, parentId }),
    handleToggleTaskChecklist: (taskId: string, itemId: string)      => toggleChecklistMutation.mutateAsync({ taskId, itemId }),
    handleUpdateTaskChecklist: (taskId: string, itemId: string, fields: unknown) => updateChecklistMutation.mutateAsync({ taskId, itemId, fields }),
    handleDeleteTaskChecklist: (taskId: string, itemId: string)      => deleteChecklistMutation.mutateAsync({ taskId, itemId }),
  };
}
