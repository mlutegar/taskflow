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
  const all = [];
  let cursor = undefined;

  // Pagina até buscar todos os registros
  while (true) {
    const url  = cursor ? `/session-usage-logs?cursor=${cursor}` : "/session-usage-logs";
    const data = await api.get(url);
    if (!data) break;

    // Suporta formato antigo (array) e novo ({ items, nextCursor })
    const items      = Array.isArray(data) ? data : (data.items ?? []);
    const nextCursor = Array.isArray(data) ? null  : data.nextCursor;

    all.push(...items.map((r) => ({
      ...(r.id ? { id: r.id } : {}),
      modeId:         r.mode_id,
      date:           r.date,
      hour:           r.hour,
      worked:         r.worked,
      focusedMinutes: r.focused_minutes,
      idleMinutes:    r.idle_minutes,
      idleReason:     r.idle_reason || [],
      feeling:        r.feeling || [],
    })));

    if (!nextCursor) break;
    cursor = nextCursor;
  }

  return all;
}
