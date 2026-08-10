/**
 * modeComboLog.js — API client para registros de combinações de modos.
 */

import { api } from "../lib/apiClient";

export async function saveModeComboLog({ modeIdA, modeIdB, date, hour, worked, focusedMinutes, feeling }) {
  return api.post("/mode-combo-log", { modeIdA, modeIdB, date, hour, worked, focusedMinutes, feeling });
}

export async function fetchModeComboLogs() {
  const data = await api.get("/mode-combo-log");
  if (!data || !Array.isArray(data)) return [];
  return data.map((r) => ({
    modeIdA: r.modeIdA,
    modeIdB: r.modeIdB,
    date: r.date,
    hour: r.hour,
    worked: r.worked,
    focusedMinutes: r.focusedMinutes,
    feeling: r.feeling,
  }));
}
