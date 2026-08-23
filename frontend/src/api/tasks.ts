import { api } from "../lib/apiClient";

const RECURRENCE_DAYS: Record<string, number> = { daily: 1, weekly: 7, biweekly: 14 };

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
  list: (params: { status?: string; sort?: string } = {}) => {
    const qs = new URLSearchParams();
    if (params.status) qs.set("status", params.status);
    if (params.sort) qs.set("sort", params.sort);
    return api.get(`/tasks?${qs}`);
  },

  create: (data: unknown) => api.post("/tasks", data),

  update: (id: string | number, data: unknown) => api.patch(`/tasks/${id}`, data),

  delete: (id: string | number) => api.delete(`/tasks/${id}`),

  complete: (id: string | number, currentTask: unknown) => api.post(`/tasks/${id}/complete`),

  reopen: (id: string | number) => api.post(`/tasks/${id}/reopen`),

  listDueToday: () => api.get("/tasks/due-today"),

  countCompletedToday: async (): Promise<number> => {
    const data = await api.get("/tasks/completed-today-count");
    return (data as { count?: number })?.count ?? 0;
  },

  addChecklistItem: (taskId: string | number, description: string, parentId: string | number | null = null) =>
    api.post(`/tasks/${taskId}/checklist`, { description, parent_id: parentId }),

  updateChecklistItem: (_taskId: string | number, itemId: string | number, fields: string | Record<string, unknown>) => {
    const updates = typeof fields === "string" ? { description: fields } : fields;
    return api.patch(`/tasks/${_taskId}/checklist/${itemId}`, updates);
  },

  toggleChecklistItem: (_taskId: string | number, itemId: string | number) =>
    api.patch(`/tasks/${_taskId}/checklist/${itemId}/toggle`),

  deleteChecklistItem: (_taskId: string | number, itemId: string | number) =>
    api.delete(`/tasks/${_taskId}/checklist/${itemId}`),

  /** Restaura uma tarefa soft-deletada (desfaz delete permanente). */
  restore: (id: string | number) => api.post(`/tasks/${id}/restore`),
};
