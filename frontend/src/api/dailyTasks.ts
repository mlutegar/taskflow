import { api } from "../lib/apiClient";
import { todayISO } from "../lib/dateUtils";

// Usa data LOCAL (todayISO) — nunca UTC — para bater com a chave de cache do
// TodayPanel (todayTasks_<todayISO>) e evitar bug de fuso na virada do dia.
export const dailyTasksApi = {
  load: (date: string = todayISO()) => api.get(`/daily-tasks/${date}`),

  add: (taskId: string | number, date: string = todayISO()) => api.post(`/daily-tasks/${date}/${taskId}`),

  remove: (taskId: string | number, date: string = todayISO()) => api.delete(`/daily-tasks/${date}/${taskId}`),

  reorder: (taskIds: (string | number)[], date: string = todayISO()) =>
    api.put(`/daily-tasks/${date}/reorder`, { taskIds: taskIds.map(String) }),
};
