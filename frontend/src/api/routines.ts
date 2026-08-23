import { api } from "../lib/apiClient";

interface ListParams {
  status?: string;
}

export const routinesApi = {
  list: (params: ListParams = {}) => {
    const qs = new URLSearchParams();
    if (params.status) qs.set("status", params.status);
    return api.get(`/routines?${qs}`);
  },

  create: (data: unknown) => api.post("/routines", data),

  update: (id: string | number, data: unknown) => api.patch(`/routines/${id}`, data),

  delete: (id: string | number) => api.delete(`/routines/${id}`),

  complete: (id: string | number) => api.post(`/routines/${id}/complete`),

  uncomplete: (id: string | number) => api.post(`/routines/${id}/uncomplete`),

  completeForDate: (id: string | number, dateStr: string) => api.post(`/routines/${id}/complete-date`, { date: dateStr }),

  addProgress: (id: string | number, amount: number) => api.post(`/routines/${id}/progress`, { amount }),

  addChecklistItem: (routineId: string | number, description: string) =>
    api.post(`/routines/${routineId}/checklist`, { description }),

  toggleChecklistItem: (routineId: string | number, itemId: string | number) =>
    api.patch(`/routines/${routineId}/checklist/${itemId}/toggle`),

  deleteChecklistItem: (routineId: string | number, itemId: string | number) =>
    api.delete(`/routines/${routineId}/checklist/${itemId}`),
};
