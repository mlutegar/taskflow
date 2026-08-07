/**
 * sessionUsageLogs.js — API client para registros de uso pós-sessão.
 */

import { api } from "../lib/apiClient";

export async function saveUsageLog(entry) {
  return api.post("/session-usage-logs", {
    mode_id:          entry.modeId,
    date:             entry.date,
    hour:             entry.hour,
    worked:           entry.worked,
    focused_minutes:  entry.focusedMinutes,
    idle_minutes:     entry.idleMinutes,
    idle_reason:      entry.idleReason,
    feeling:          entry.feeling,
  });
}

export async function fetchUsageLogs() {
  const data = await api.get("/session-usage-logs");
  if (!data || !Array.isArray(data)) return [];
  return data.map((r) => ({
    modeId:         r.mode_id,
    date:           r.date,
    hour:           r.hour,
    worked:         r.worked,
    focusedMinutes: r.focused_minutes,
    idleMinutes:    r.idle_minutes,
    idleReason:     r.idle_reason || [],
    feeling:        r.feeling || [],
  }));
}
