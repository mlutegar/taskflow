import { api } from "../lib/apiClient";

export async function saveSession(session) {
  try {
    await api.post("/daily-focus/sessions", session);
  } catch {
    // fire-and-forget — falha silenciosa
  }
}

export async function fetchSessions() {
  try {
    return await api.get("/daily-focus/sessions") ?? [];
  } catch {
    return [];
  }
}
