import { api } from "../lib/apiClient";

export const modeStatsApi = {
  list: (): Promise<unknown> => api.get("/mode-stats"),

  increment: async (modeId: string | number): Promise<number> => {
    const data = await api.post(`/mode-stats/${modeId}/increment`) as { count?: number } | null | undefined;
    return data?.count ?? 0;
  },
};
