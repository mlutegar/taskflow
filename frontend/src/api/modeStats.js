import { api } from "../lib/apiClient";

export const modeStatsApi = {
  list: () => api.get("/mode-stats"),

  increment: async (modeId) => {
    const data = await api.post(`/mode-stats/${modeId}/increment`);
    return data?.count ?? 0;
  },
};
