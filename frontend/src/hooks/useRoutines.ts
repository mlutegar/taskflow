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
    (id: string | number) => queryClient.setQueryData(queryKey, (old: any[] = []) => old.filter((r) => r.id !== id)),
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
    mutationFn: (id: string | number) => routinesApi.complete(id),
    onSuccess: updateCache,
  });

  const uncompleteMutation = useMutation({
    mutationFn: (id: string | number) => routinesApi.uncomplete(id),
    onSuccess: updateCache,
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string | number) => routinesApi.delete(id),
    onSuccess: (_: any, id: string | number) =>
      queryClient.setQueryData(queryKey, (old: any[] = []) => old.filter((r) => r.id !== id)),
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: string | number; data: any }) => routinesApi.update(id, data),
    onSuccess: updateCache,
  });

  const completeForDateMutation = useMutation({
    mutationFn: ({ id, dateStr }: { id: string | number; dateStr: string }) => routinesApi.completeForDate(id, dateStr),
    onSuccess: updateCache,
  });

  const addProgressMutation = useMutation({
    mutationFn: ({ id, amount }: { id: string | number; amount: number }) => routinesApi.addProgress(id, amount),
    onSuccess: updateCache,
  });

  const addChecklistMutation = useMutation({
    mutationFn: ({ routineId, description }: { routineId: string | number; description: string }) =>
      routinesApi.addChecklistItem(routineId, description),
    onSuccess: (item: any, { routineId }: { routineId: string | number; description: string }) =>
      queryClient.setQueryData(queryKey, (old: any[] = []) =>
        old.map((r) =>
          r.id === routineId
            ? { ...r, checklist: [...r.checklist, item], checklist_count: r.checklist_count + 1 }
            : r
        )
      ),
  });

  const toggleChecklistMutation = useMutation({
    mutationFn: ({ routineId, itemId }: { routineId: string | number; itemId: string | number }) =>
      routinesApi.toggleChecklistItem(routineId, itemId),
    onSuccess: (item: any, { routineId, itemId }: { routineId: string | number; itemId: string | number }) => {
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
    mutationFn: ({ routineId, itemId }: { routineId: string | number; itemId: string | number }) =>
      routinesApi.deleteChecklistItem(routineId, itemId),
    onSuccess: (_: any, { routineId, itemId }: { routineId: string | number; itemId: string | number }) =>
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
    handleCompleteRoutine:         (id: string | number)                        => completeMutation.mutateAsync(id),
    handleUncompleteRoutine:       (id: string | number)                        => uncompleteMutation.mutateAsync(id),
    handleDeleteRoutine:           (id: string | number)                        => deleteMutation.mutateAsync(id),
    handleUpdateRoutine:           (id: string | number, data: any)             => updateMutation.mutateAsync({ id, data }),
    handleCompleteRoutineForDate:  (id: string | number, dateStr: string)       => completeForDateMutation.mutateAsync({ id, dateStr }),
    handleAddProgress:             (id: string | number, amount: number)        => addProgressMutation.mutateAsync({ id, amount }),
    handleAddRoutineChecklist:     (routineId: string | number, description: string) =>
      addChecklistMutation.mutateAsync({ routineId, description }),
    handleToggleRoutineChecklist:  (routineId: string | number, itemId: string | number) =>
      toggleChecklistMutation.mutateAsync({ routineId, itemId }),
    handleDeleteRoutineChecklist:  (routineId: string | number, itemId: string | number) =>
      deleteChecklistMutation.mutateAsync({ routineId, itemId }),
  };
}
