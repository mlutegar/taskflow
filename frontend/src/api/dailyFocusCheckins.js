import { api } from "../lib/apiClient";

export async function saveCheckin(estadoId, modeId, date, hour) {
  try {
    await api.post("/daily-focus/checkins", { estadoId, modeId, date, hour });
  } catch {
    // fire-and-forget
  }
}

export async function updateCheckinFeedback(estadoId, modeId, date, rating) {
  try {
    await api.patch("/daily-focus/checkins/feedback", { estadoId, modeId, date, rating });
  } catch {
    // fire-and-forget
  }
}

export async function fetchCheckins() {
  try {
    return await api.get("/daily-focus/checkins") ?? { checkins: [], feedbacks: [] };
  } catch {
    return { checkins: [], feedbacks: [] };
  }
}
