import { api } from "../lib/apiClient";

function todayDate() {
  return new Date().toISOString().split("T")[0];
}

export const dailyTasksApi = {
  load: (date = todayDate()) => api.get(`/daily-tasks/${date}`),

  add: (taskId, date = todayDate()) => api.post(`/daily-tasks/${date}/${taskId}`),

  remove: (taskId, date = todayDate()) => api.delete(`/daily-tasks/${date}/${taskId}`),
};
