import { api } from "../lib/apiClient";

export async function saveCheckin(estadoId: string, modeId: string, date: string, hour: number): Promise<void> {
  try {
    await api.post("/daily-focus/checkins", { estadoId, modeId, date, hour });
  } catch {
    // fire-and-forget
  }
}

export async function updateCheckinFeedback(estadoId: string, modeId: string, date: string, rating: number, estadoAfter?: string): Promise<void> {
  try {
    const body: Record<string, unknown> = { estadoId, modeId, date, rating };
    if (estadoAfter) body.estadoAfter = estadoAfter;
    await api.patch("/daily-focus/checkins/feedback", body);
  } catch {
    // fire-and-forget
  }
}

export async function fetchCheckins(): Promise<{ checkins: unknown[]; feedbacks: unknown[] }> {
  try {
    return await api.get("/daily-focus/checkins") ?? { checkins: [], feedbacks: [] };
  } catch {
    return { checkins: [], feedbacks: [] };
  }
}
