import { api } from "../lib/apiClient";
import { queueableTaskMutation } from "../lib/taskOfflineQueue";
import type { TaskChecklistItem, TaskCreateInput, TaskRecord, TaskUpdateInput } from "../types/tasks";

const RECURRENCE_DAYS: Record<string, number> = { daily: 1, weekly: 7, biweekly: 14 };

/** Rotina listada pelo heatmap (usada no tooltip e no filtro). */
export interface RoutineConsistencyRoutine {
  id: string;
  title: string;
  recurrence: string | null;
}

/**
 * Um dia do heatmap, vindo de GET /tasks/routines/consistency.
 * `expected`/`completed` são ÍNDICES na lista `routines` da resposta — assim o
 * tooltip sabe QUAIS rotinas e o filtro por rotina roda sem refetch.
 */
export interface RoutineConsistencyDay {
  date: string;        // YYYY-MM-DD
  expected: number[];  // rotinas agendadas naquele dia
  completed: number[]; // rotinas efetivamente concluídas
}

export interface RoutineConsistencyResponse {
  from: string;
  to: string;
  routines: RoutineConsistencyRoutine[];
  days: RoutineConsistencyDay[];
  /** Melhor sequência (todas as rotinas) considerando todo o histórico. */
  best_streak: number;
  /** Melhor sequência de cada rotina isolada, no mesmo índice de `routines`. */
  best_streak_by_routine: number[];
}

function computeNextDueDate(currentDueDate: string | null | undefined, recurrence: string): string {
  const base = currentDueDate
    ? new Date(currentDueDate + "T12:00:00")
    : new Date();
  if (recurrence === "monthly") {
    base.setMonth(base.getMonth() + 1);
  } else {
    base.setDate(base.getDate() + (RECURRENCE_DAYS[recurrence] ?? 7));
  }
  return base.toISOString().split("T")[0];
}

export const tasksApi = {
  list: (params: {
    status?: string;
    sort?: string;
    projectId?: string;
    time?: string;
    assignedTo?: string;
    priorities?: string;
    dueFilter?: string;
  } = {}): Promise<TaskRecord[]> => {
    const qs = new URLSearchParams();
    if (params.status) qs.set("status", params.status);
    if (params.sort) qs.set("sort", params.sort);
    if (params.projectId) qs.set("project_id", params.projectId);
    if (params.time) qs.set("time", params.time);
    if (params.assignedTo) qs.set("assigned_to", params.assignedTo);
    if (params.priorities) qs.set("priorities", params.priorities);
    if (params.dueFilter) qs.set("due_filter", params.dueFilter);
    return api.get(`/tasks?${qs}`) as Promise<TaskRecord[]>;
  },

  get: (id: string | number) => api.get(`/tasks/${id}`) as Promise<TaskRecord>,

  create: (data: TaskCreateInput) => queueableTaskMutation<TaskRecord>("POST", "/tasks", data),

  update: (id: string | number, data: TaskUpdateInput) => queueableTaskMutation<TaskRecord>("PATCH", `/tasks/${id}`, data),

  delete: (id: string | number) => queueableTaskMutation<null>("DELETE", `/tasks/${id}`),

  complete: (id: string | number) => queueableTaskMutation<TaskRecord>("POST", `/tasks/${id}/complete`),

  undoComplete: (id: string | number, completionId: string) =>
    queueableTaskMutation<TaskRecord>("POST", `/tasks/${id}/undo-complete`, { completion_id: completionId }),

  history: (id: string | number) => api.get(`/tasks/${id}/history`),

  /** Heatmap de consistência das rotinas: uma query agregada por dia. */
  routineConsistency: (from: string, to: string): Promise<RoutineConsistencyResponse> =>
    api.get(`/tasks/routines/consistency?from=${from}&to=${to}`) as Promise<RoutineConsistencyResponse>,

  changes: (id: string | number) => api.get(`/tasks/${id}/changes`),

  undoChange: (changeId: string | number) => queueableTaskMutation<TaskRecord>("POST", `/tasks/changes/${changeId}/undo`),

  reopen: (id: string | number) => queueableTaskMutation<TaskRecord>("POST", `/tasks/${id}/reopen`),

  listDueToday: () => api.get("/tasks/due-today"),

  countCompletedToday: async (): Promise<number> => {
    const data = await api.get("/tasks/completed-today-count");
    return (data as { count?: number })?.count ?? 0;
  },

  addChecklistItem: (taskId: string | number, description: string, parentId: string | number | null = null) =>
    queueableTaskMutation<TaskChecklistItem>("POST", `/tasks/${taskId}/checklist`, { description, parent_id: parentId }),

  addChecklistBatch: (taskId: string | number, items: Array<{ description: string; parent_id?: string | number | null; order?: number }>) =>
    queueableTaskMutation<TaskChecklistItem[]>("POST", `/tasks/${taskId}/checklist/batch`, { items }),

  updateChecklistItem: (_taskId: string | number, itemId: string | number, fields: string | Record<string, unknown>) => {
    const updates = typeof fields === "string" ? { description: fields } : fields;
    return queueableTaskMutation<TaskChecklistItem>("PATCH", `/tasks/${_taskId}/checklist/${itemId}`, updates);
  },

  reorderChecklistItem: (taskId: string | number, itemId: string | number, newOrder: number) =>
    queueableTaskMutation<TaskChecklistItem>("PATCH", `/tasks/${taskId}/checklist/${itemId}/order`, { newOrder }),

  toggleChecklistItem: (_taskId: string | number, itemId: string | number) =>
    queueableTaskMutation<TaskChecklistItem>("PATCH", `/tasks/${_taskId}/checklist/${itemId}/toggle`),

  deleteChecklistItem: (_taskId: string | number, itemId: string | number) =>
    queueableTaskMutation<null>("DELETE", `/tasks/${_taskId}/checklist/${itemId}`),

  /** Restaura uma tarefa soft-deletada (desfaz delete permanente). */
  restore: (id: string | number) => queueableTaskMutation<TaskRecord>("POST", `/tasks/${id}/restore`),
};
