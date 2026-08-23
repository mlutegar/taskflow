/**
 * modeLog.js — API client para registros de conclusão de modos.
 */

import { api } from "../lib/apiClient";

export async function saveModeLog(modeId: string, date: string): Promise<unknown> {
  return api.post("/mode-log", { modeId, date });
}

export async function fetchModeLogs(): Promise<{ modeId: string; date: string }[]> {
  const data = await api.get("/mode-log");
  if (!data || !Array.isArray(data)) return [];
  return data.map((r: { modeId: string; date: string }) => ({ modeId: r.modeId, date: r.date }));
}
