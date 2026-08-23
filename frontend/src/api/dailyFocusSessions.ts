import { api } from "../lib/apiClient";

export async function saveSession(session: Record<string, unknown>): Promise<void> {
  try {
    await api.post("/daily-focus/sessions", session);
  } catch {
    // fire-and-forget — falha silenciosa
  }
}

export async function fetchSessions(): Promise<unknown[]> {
  try {
    return await api.get("/daily-focus/sessions") ?? [];
  } catch {
    return [];
  }
}
