import { api } from "../lib/apiClient";

export const routinesApi = {
  list: (params = {}) => {
    const qs = new URLSearchParams();
    if (params.status) qs.set("status", params.status);
    return api.get(`/routines?${qs}`);
  },

  create: (data) => api.post("/routines", data),

  update: (id, data) => api.patch(`/routines/${id}`, data),

  delete: (id) => api.delete(`/routines/${id}`),

  complete: (id) => api.post(`/routines/${id}/complete`),

  uncomplete: (id) => api.post(`/routines/${id}/uncomplete`),

  completeForDate: (id, dateStr) => api.post(`/routines/${id}/complete-date`, { date: dateStr }),

  addProgress: (id, amount) => api.post(`/routines/${id}/progress`, { amount }),

  addChecklistItem: (routineId, description) =>
    api.post(`/routines/${routineId}/checklist`, { description }),

  toggleChecklistItem: (routineId, itemId) =>
    api.patch(`/routines/${routineId}/checklist/${itemId}/toggle`),

  deleteChecklistItem: (routineId, itemId) =>
    api.delete(`/routines/${routineId}/checklist/${itemId}`),
};
