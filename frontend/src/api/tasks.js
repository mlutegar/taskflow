import { api } from "../lib/apiClient";

const RECURRENCE_DAYS = { daily: 1, weekly: 7, biweekly: 14 };

function computeNextDueDate(currentDueDate, recurrence) {
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
  list: (params = {}) => {
    const qs = new URLSearchParams();
    if (params.status) qs.set("status", params.status);
    if (params.sort) qs.set("sort", params.sort);
    return api.get(`/tasks?${qs}`);
  },

  create: (data) => api.post("/tasks", data),

  update: (id, data) => api.patch(`/tasks/${id}`, data),

  delete: (id) => api.delete(`/tasks/${id}`),

  complete: (id, currentTask) => api.post(`/tasks/${id}/complete`),

  reopen: (id) => api.post(`/tasks/${id}/reopen`),

  listDueToday: () => api.get("/tasks/due-today"),

  countCompletedToday: async () => {
    const data = await api.get("/tasks/completed-today-count");
    return data?.count ?? 0;
  },

  addChecklistItem: (taskId, description, parentId = null) =>
    api.post(`/tasks/${taskId}/checklist`, { description, parent_id: parentId }),

  updateChecklistItem: (_taskId, itemId, fields) => {
    const updates = typeof fields === "string" ? { description: fields } : fields;
    return api.patch(`/tasks/${_taskId}/checklist/${itemId}`, updates);
  },

  toggleChecklistItem: (_taskId, itemId) =>
    api.patch(`/tasks/${_taskId}/checklist/${itemId}/toggle`),

  deleteChecklistItem: (_taskId, itemId) =>
    api.delete(`/tasks/${_taskId}/checklist/${itemId}`),
};
