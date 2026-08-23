import { api } from "../lib/apiClient";

export async function saveCheckin(estadoId: string, modeId: string, date: string, hour: number): Promise<void> {
  try {
    await api.post("/daily-focus/checkins", { estadoId, modeId, date, hour });
  } catch {
    // fire-and-forget
  }
}

export async function updateCheckinFeedback(estadoId: string, modeId: string, date: string, rating: number): Promise<void> {
  try {
    await api.patch("/daily-focus/checkins/feedback", { estadoId, modeId, date, rating });
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
