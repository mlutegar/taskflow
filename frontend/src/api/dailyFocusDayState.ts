import { api } from "../lib/apiClient";

export async function fetchTodayState(): Promise<unknown> {
  try {
    return await api.get("/daily-focus/day-state");
  } catch {
    return null;
  }
}

export async function upsertTodayState(level: unknown, usedModes: unknown): Promise<void> {
  try {
    await api.put("/daily-focus/day-state", { level, usedModes });
  } catch {
    // fire-and-forget
  }
}
