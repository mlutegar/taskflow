import { api } from "../lib/apiClient";

export async function fetchAchievements() {
  try {
    return await api.get("/daily-focus/achievements") ?? [];
  } catch {
    return [];
  }
}

export async function upsertAchievement(id) {
  try {
    await api.post(`/daily-focus/achievements/${id}`);
  } catch {
    // fire-and-forget
  }
}
