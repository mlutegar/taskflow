import { api } from "../lib/apiClient";
import type { SessionEmotion } from "../types";

export async function saveEmotion(payload: SessionEmotion): Promise<void> {
  try {
    await api.post("/daily-focus/emotions", payload);
  } catch {
    // fire-and-forget
  }
}

export async function fetchEmotions(): Promise<{ emotions: SessionEmotion[] }> {
  try {
    return await api.get("/daily-focus/emotions") ?? { emotions: [] };
  } catch {
    return { emotions: [] };
  }
}
