import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useCallback } from "react";
import { tasksApi } from "../api/tasks";

/**
 * Hook para tarefas usando React Query.
 * - Cache automático com staleTime de 30s
 * - Optimistic updates via setQueryData
 * - Mutations tipadas com callbacks onSuccess
 */
export function useTasks(taskFilter, taskSort) {
  const queryClient = useQueryClient();
  const queryKey    = ["tasks", taskFilter, taskSort];
  const todayKey    = ["tasks", "completed-today"];

  // ── Queries ────────────────────────────────────────────────────────────────

  const { data: rawTasks = [], isLoading: tasksLoading, error: tasksErrorObj } = useQuery({
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
      return new Date(a.due_date) - new Date(b.due_date);
    });
  }, [rawTasks, taskSort])();

  const { data: completedToday = 0 } = useQuery({
    queryKey: todayKey,
    queryFn: tasksApi.countCompletedToday,
    staleTime: 60_000,
  });

  const tasksError = tasksErrorObj?.message ?? null;

  // ── Helpers de cache (para delete otimista + undo em App.jsx) ─────────────

  const removeTask = useCallback(
    (id) => queryClient.setQueryData(queryKey, (old = []) => old.filter((t) => t.id !== id)),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [queryClient, JSON.stringify(queryKey)]
  );

  const restoreTask = useCallback(
    (task) => queryClient.setQueryData(queryKey, (old = []) => [task, ...old]),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [queryClient, JSON.stringify(queryKey)]
  );

  // ── Helpers internos ───────────────────────────────────────────────────────

  const updateCache = useCallback(
    (updated) =>
      queryClient.setQueryData(queryKey, (old = []) =>
        old.map((t) => (t.id === updated.id ? updated : t))
      ),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [queryClient, JSON.stringify(queryKey)]
  );

  // ── Mutations ──────────────────────────────────────────────────────────────

  const createMutation = useMutation({
    mutationFn: (data) => tasksApi.create(data),
    onSuccess: (task) =>
      queryClient.setQueryData(queryKey, (old = []) => [task, ...old]),
  });

  const completeMutation = useMutation({
    mutationFn: (id) => tasksApi.complete(id),
    onSuccess: (task) => {
      updateCache(task);
      queryClient.invalidateQueries({ queryKey: todayKey });
    },
  });

  const reopenMutation = useMutation({
    mutationFn: (id) => tasksApi.reopen(id),
    onSuccess: (task) => {
      updateCache(task);
      queryClient.invalidateQueries({ queryKey: todayKey });
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }) => tasksApi.update(id, data),
    onSuccess: updateCache,
  });

  const addChecklistMutation = useMutation({
    mutationFn: ({ taskId, description, parentId }) =>
      tasksApi.addChecklistItem(taskId, description, parentId),
    onSuccess: (item, { taskId }) =>
      queryClient.setQueryData(queryKey, (old = []) =>
        old.map((t) =>
          t.id === taskId
            ? { ...t, checklist: [...t.checklist, item], checklist_count: t.checklist_count + 1 }
            : t
        )
      ),
  });

  const toggleChecklistMutation = useMutation({
    mutationFn: ({ taskId, itemId }) => tasksApi.toggleChecklistItem(taskId, itemId),
    onSuccess: (item, { taskId, itemId }) =>
      queryClient.setQueryData(queryKey, (old = []) =>
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

  const updateChecklistMutation = useMutation({
    mutationFn: ({ taskId, itemId, fields }) =>
      tasksApi.updateChecklistItem(taskId, itemId, fields),
    onSuccess: (item, { taskId, itemId }) =>
      queryClient.setQueryData(queryKey, (old = []) =>
        old.map((t) => {
          if (t.id !== taskId) return t;
          return { ...t, checklist: t.checklist.map((c) => (c.id === itemId ? item : c)) };
        })
      ),
  });

  const deleteChecklistMutation = useMutation({
    mutationFn: ({ taskId, itemId }) => tasksApi.deleteChecklistItem(taskId, itemId),
    onSuccess: (_, { taskId, itemId }) =>
      queryClient.setQueryData(queryKey, (old = []) =>
        old.map((t) => {
          if (t.id !== taskId) return t;
          const toRemove = new Set([itemId]);
          let changed = true;
          while (changed) {
            changed = false;
            for (const c of t.checklist) {
              if (c.parent_id != null && toRemove.has(c.parent_id) && !toRemove.has(c.id)) {
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
    handleCreateTask:          (data)                       => createMutation.mutateAsync(data),
    handleCompleteTask:        (id)                         => completeMutation.mutateAsync(id),
    handleReopenTask:          (id)                         => reopenMutation.mutateAsync(id),
    handleUpdateTask:          (id, data)                   => updateMutation.mutateAsync({ id, data }),
    handleAddTaskChecklist:    (taskId, description, parentId = null) =>
      addChecklistMutation.mutateAsync({ taskId, description, parentId }),
    handleToggleTaskChecklist: (taskId, itemId)             => toggleChecklistMutation.mutateAsync({ taskId, itemId }),
    handleUpdateTaskChecklist: (taskId, itemId, fields)     => updateChecklistMutation.mutateAsync({ taskId, itemId, fields }),
    handleDeleteTaskChecklist: (taskId, itemId)             => deleteChecklistMutation.mutateAsync({ taskId, itemId }),
  };
}
