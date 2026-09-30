import { api } from "../lib/apiClient";

export interface RemoteDayState {
  date: string;
  level: number;
  usedModes: Record<string, number>;
  continuousActivity: unknown | null;
  continuousCompleted?: unknown[] | null;
}

export async function fetchTodayState(): Promise<RemoteDayState | null> {
  try {
    return (await api.get("/daily-focus/day-state")) as RemoteDayState | null;
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

/** Sincroniza apenas a atividade contínua do dia (sem tocar em level/usedModes). */
export async function upsertContinuousActivity(activity: unknown | null): Promise<void> {
  try {
    await api.put("/daily-focus/day-state", { continuousActivity: activity });
  } catch {
    // fire-and-forget
  }
}

/** Sincroniza o log de atividades contínuas concluídas hoje (sem tocar nos demais campos). */
export async function upsertContinuousCompleted(completed: unknown[] | null): Promise<void> {
  try {
    await api.put("/daily-focus/day-state", { continuousCompleted: completed });
  } catch {
    // fire-and-forget
  }
}
