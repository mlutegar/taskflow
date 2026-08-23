import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useCallback } from "react";
import { routinesApi } from "../api/routines";

/**
 * Hook para rotinas usando React Query.
 * - Cache automático com staleTime de 30s
 * - Optimistic updates via setQueryData
 */
export function useRoutines(routineFilter) {
  const queryClient = useQueryClient();
  const queryKey    = ["routines", routineFilter];

  // ── Query ──────────────────────────────────────────────────────────────────

  const { data: routines = [], isLoading: routinesLoading, error: routinesErrorObj } = useQuery({
    queryKey,
    queryFn: () => routinesApi.list({ status: routineFilter }),
  });

  const routinesError = routinesErrorObj?.message ?? null;

  // ── Helpers de cache (para delete otimista + undo em App.jsx) ─────────────

  const removeRoutine = useCallback(
    (id) => queryClient.setQueryData(queryKey, (old = []) => old.filter((r) => r.id !== id)),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [queryClient, JSON.stringify(queryKey)]
  );

  const restoreRoutine = useCallback(
    (routine) => queryClient.setQueryData(queryKey, (old = []) => [...old, routine]),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [queryClient, JSON.stringify(queryKey)]
  );

  // ── Helpers internos ───────────────────────────────────────────────────────

  const updateCache = useCallback(
    (updated) =>
      queryClient.setQueryData(queryKey, (old = []) =>
        old.map((r) => (r.id === updated.id ? updated : r))
      ),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [queryClient, JSON.stringify(queryKey)]
  );

  // ── Mutations ──────────────────────────────────────────────────────────────

  const createMutation = useMutation({
    mutationFn: (data) => routinesApi.create(data),
    onSuccess: (routine) =>
      queryClient.setQueryData(queryKey, (old = []) => [...old, routine]),
  });

  const completeMutation = useMutation({
    mutationFn: (id) => routinesApi.complete(id),
    onSuccess: updateCache,
  });

  const uncompleteMutation = useMutation({
    mutationFn: (id) => routinesApi.uncomplete(id),
    onSuccess: updateCache,
  });

  const deleteMutation = useMutation({
    mutationFn: (id) => routinesApi.delete(id),
    onSuccess: (_, id) =>
      queryClient.setQueryData(queryKey, (old = []) => old.filter((r) => r.id !== id)),
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }) => routinesApi.update(id, data),
    onSuccess: updateCache,
  });

  const completeForDateMutation = useMutation({
    mutationFn: ({ id, dateStr }) => routinesApi.completeForDate(id, dateStr),
    onSuccess: updateCache,
  });

  const addProgressMutation = useMutation({
    mutationFn: ({ id, amount }) => routinesApi.addProgress(id, amount),
    onSuccess: updateCache,
  });

  const addChecklistMutation = useMutation({
    mutationFn: ({ routineId, description }) => routinesApi.addChecklistItem(routineId, description),
    onSuccess: (item, { routineId }) =>
      queryClient.setQueryData(queryKey, (old = []) =>
        old.map((r) =>
          r.id === routineId
            ? { ...r, checklist: [...r.checklist, item], checklist_count: r.checklist_count + 1 }
            : r
        )
      ),
  });

  const toggleChecklistMutation = useMutation({
    mutationFn: ({ routineId, itemId }) => routinesApi.toggleChecklistItem(routineId, itemId),
    onSuccess: (item, { routineId, itemId }) => {
      queryClient.setQueryData(queryKey, (old = []) =>
        old.map((r) => {
          if (r.id !== routineId) return r;
          const newChecklist = r.checklist.map((c) => (c.id === itemId ? item : c));
          return {
            ...r,
            checklist: newChecklist,
            checklist_completed_count: newChecklist.filter((c) => c.completed).length,
          };
        })
      );
      // Re-fetch para garantir is_completed_today calculado pelo backend
      queryClient.invalidateQueries({ queryKey });
    },
  });

  const deleteChecklistMutation = useMutation({
    mutationFn: ({ routineId, itemId }) => routinesApi.deleteChecklistItem(routineId, itemId),
    onSuccess: (_, { routineId, itemId }) =>
      queryClient.setQueryData(queryKey, (old = []) =>
        old.map((r) => {
          if (r.id !== routineId) return r;
          const newChecklist = r.checklist.filter((c) => c.id !== itemId);
          return { ...r, checklist: newChecklist, checklist_count: newChecklist.length };
        })
      ),
  });

  // ── Interface pública ──────────────────────────────────────────────────────

  return {
    routines,
    routinesLoading,
    routinesError,
    // Para delete otimista + undo (App.jsx)
    removeRoutine,
    restoreRoutine,
    // Handlers
    handleCreateRoutine:           (data)            => createMutation.mutateAsync(data),
    handleCompleteRoutine:         (id)              => completeMutation.mutateAsync(id),
    handleUncompleteRoutine:       (id)              => uncompleteMutation.mutateAsync(id),
    handleDeleteRoutine:           (id)              => deleteMutation.mutateAsync(id),
    handleUpdateRoutine:           (id, data)        => updateMutation.mutateAsync({ id, data }),
    handleCompleteRoutineForDate:  (id, dateStr)     => completeForDateMutation.mutateAsync({ id, dateStr }),
    handleAddProgress:             (id, amount)      => addProgressMutation.mutateAsync({ id, amount }),
    handleAddRoutineChecklist:     (routineId, description) =>
      addChecklistMutation.mutateAsync({ routineId, description }),
    handleToggleRoutineChecklist:  (routineId, itemId) =>
      toggleChecklistMutation.mutateAsync({ routineId, itemId }),
    handleDeleteRoutineChecklist:  (routineId, itemId) =>
      deleteChecklistMutation.mutateAsync({ routineId, itemId }),
  };
}
