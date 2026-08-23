import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useCallback } from "react";
import { routinesApi } from "../api/routines";

/**
 * Hook para rotinas usando React Query.
 * - Cache automático com staleTime de 30s
 * - Optimistic updates via setQueryData
 */
export function useRoutines(routineFilter: string | undefined) {
  const queryClient = useQueryClient();
  const queryKey    = ["routines", routineFilter];

  // ── Query ──────────────────────────────────────────────────────────────────

  const { data: routines = [], isLoading: routinesLoading, error: routinesErrorObj } = useQuery<any[], Error>({
    queryKey,
    queryFn: () => routinesApi.list({ status: routineFilter }),
  });

  const routinesError: string | null = (routinesErrorObj as Error | null)?.message ?? null;

  // ── Helpers de cache (para delete otimista + undo em App.jsx) ─────────────

  const removeRoutine = useCallback(
    (id: unknown) => queryClient.setQueryData(queryKey, (old: any[] = []) => old.filter((r) => r.id !== id)),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [queryClient, JSON.stringify(queryKey)]
  );

  const restoreRoutine = useCallback(
    (routine: any) => queryClient.setQueryData(queryKey, (old: any[] = []) => [...old, routine]),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [queryClient, JSON.stringify(queryKey)]
  );

  // ── Helpers internos ───────────────────────────────────────────────────────

  const updateCache = useCallback(
    (updated: any) =>
      queryClient.setQueryData(queryKey, (old: any[] = []) =>
        old.map((r) => (r.id === updated.id ? updated : r))
      ),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [queryClient, JSON.stringify(queryKey)]
  );

  // ── Mutations ──────────────────────────────────────────────────────────────

  const createMutation = useMutation({
    mutationFn: (data: any) => routinesApi.create(data),
    onSuccess: (routine: any) =>
      queryClient.setQueryData(queryKey, (old: any[] = []) => [...old, routine]),
  });

  const completeMutation = useMutation({
    mutationFn: (id: unknown) => routinesApi.complete(id),
    onSuccess: updateCache,
  });

  const uncompleteMutation = useMutation({
    mutationFn: (id: unknown) => routinesApi.uncomplete(id),
    onSuccess: updateCache,
  });

  const deleteMutation = useMutation({
    mutationFn: (id: unknown) => routinesApi.delete(id),
    onSuccess: (_: any, id: unknown) =>
      queryClient.setQueryData(queryKey, (old: any[] = []) => old.filter((r) => r.id !== id)),
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: unknown; data: any }) => routinesApi.update(id, data),
    onSuccess: updateCache,
  });

  const completeForDateMutation = useMutation({
    mutationFn: ({ id, dateStr }: { id: unknown; dateStr: string }) => routinesApi.completeForDate(id, dateStr),
    onSuccess: updateCache,
  });

  const addProgressMutation = useMutation({
    mutationFn: ({ id, amount }: { id: unknown; amount: number }) => routinesApi.addProgress(id, amount),
    onSuccess: updateCache,
  });

  const addChecklistMutation = useMutation({
    mutationFn: ({ routineId, description }: { routineId: unknown; description: string }) =>
      routinesApi.addChecklistItem(routineId, description),
    onSuccess: (item: any, { routineId }: { routineId: unknown; description: string }) =>
      queryClient.setQueryData(queryKey, (old: any[] = []) =>
        old.map((r) =>
          r.id === routineId
            ? { ...r, checklist: [...r.checklist, item], checklist_count: r.checklist_count + 1 }
            : r
        )
      ),
  });

  const toggleChecklistMutation = useMutation({
    mutationFn: ({ routineId, itemId }: { routineId: unknown; itemId: unknown }) =>
      routinesApi.toggleChecklistItem(routineId, itemId),
    onSuccess: (item: any, { routineId, itemId }: { routineId: unknown; itemId: unknown }) => {
      queryClient.setQueryData(queryKey, (old: any[] = []) =>
        old.map((r) => {
          if (r.id !== routineId) return r;
          const newChecklist = r.checklist.map((c: any) => (c.id === itemId ? item : c));
          return {
            ...r,
            checklist: newChecklist,
            checklist_completed_count: newChecklist.filter((c: any) => c.completed).length,
          };
        })
      );
      // Re-fetch para garantir is_completed_today calculado pelo backend
      queryClient.invalidateQueries({ queryKey });
    },
  });

  const deleteChecklistMutation = useMutation({
    mutationFn: ({ routineId, itemId }: { routineId: unknown; itemId: unknown }) =>
      routinesApi.deleteChecklistItem(routineId, itemId),
    onSuccess: (_: any, { routineId, itemId }: { routineId: unknown; itemId: unknown }) =>
      queryClient.setQueryData(queryKey, (old: any[] = []) =>
        old.map((r) => {
          if (r.id !== routineId) return r;
          const newChecklist = r.checklist.filter((c: any) => c.id !== itemId);
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
    handleCreateRoutine:           (data: any)                          => createMutation.mutateAsync(data),
    handleCompleteRoutine:         (id: unknown)                        => completeMutation.mutateAsync(id),
    handleUncompleteRoutine:       (id: unknown)                        => uncompleteMutation.mutateAsync(id),
    handleDeleteRoutine:           (id: unknown)                        => deleteMutation.mutateAsync(id),
    handleUpdateRoutine:           (id: unknown, data: any)             => updateMutation.mutateAsync({ id, data }),
    handleCompleteRoutineForDate:  (id: unknown, dateStr: string)       => completeForDateMutation.mutateAsync({ id, dateStr }),
    handleAddProgress:             (id: unknown, amount: number)        => addProgressMutation.mutateAsync({ id, amount }),
    handleAddRoutineChecklist:     (routineId: unknown, description: string) =>
      addChecklistMutation.mutateAsync({ routineId, description }),
    handleToggleRoutineChecklist:  (routineId: unknown, itemId: unknown) =>
      toggleChecklistMutation.mutateAsync({ routineId, itemId }),
    handleDeleteRoutineChecklist:  (routineId: unknown, itemId: unknown) =>
      deleteChecklistMutation.mutateAsync({ routineId, itemId }),
  };
}
