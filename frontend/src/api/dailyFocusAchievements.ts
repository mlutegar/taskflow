import { api } from "../lib/apiClient";

export async function fetchAchievements(): Promise<unknown[]> {
  try {
    return await api.get("/daily-focus/achievements") ?? [];
  } catch {
    return [];
  }
}

export async function upsertAchievement(id: string | number): Promise<void> {
  try {
    await api.post(`/daily-focus/achievements/${id}`);
  } catch {
    // fire-and-forget
  }
}
