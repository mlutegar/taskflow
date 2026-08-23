import { api } from "../lib/apiClient";

function todayDate(): string {
  return new Date().toISOString().split("T")[0];
}

export const dailyTasksApi = {
  load: (date: string = todayDate()) => api.get(`/daily-tasks/${date}`),

  add: (taskId: string | number, date: string = todayDate()) => api.post(`/daily-tasks/${date}/${taskId}`),

  remove: (taskId: string | number, date: string = todayDate()) => api.delete(`/daily-tasks/${date}/${taskId}`),
};
