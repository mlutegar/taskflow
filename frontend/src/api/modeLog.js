/**
 * modeLog.js — API client para registros de conclusão de modos.
 */

import { api } from "../lib/apiClient";

export async function saveModeLog(modeId, date) {
  return api.post("/mode-log", { modeId, date });
}

export async function fetchModeLogs() {
  const data = await api.get("/mode-log");
  if (!data || !Array.isArray(data)) return [];
  return data.map((r) => ({ modeId: r.modeId, date: r.date }));
}
