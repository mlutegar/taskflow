/**
 * sessionUsageLogs.js — API client para registros de uso pós-sessão.
 */

import { api } from "../lib/apiClient";

interface UsageLogEntry {
  modeId: string;
  date: string;
  hour: number;
  worked: boolean;
  focusedMinutes: number;
  idleMinutes: number;
  idleReason: unknown;
  feeling: unknown;
}

interface UsageLogRaw {
  id?: unknown;
  mode_id: string;
  date: string;
  hour: number;
  worked: boolean;
  focused_minutes: number;
  idle_minutes: number;
  idle_reason?: unknown;
  feeling?: unknown;
}

interface UsageLogPage {
  items?: UsageLogRaw[];
  nextCursor?: string | null;
}

export async function saveUsageLog(entry: UsageLogEntry): Promise<unknown> {
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

export async function fetchUsageLogs(): Promise<UsageLogEntry[]> {
  const all: UsageLogEntry[] = [];
  let cursor: string | undefined = undefined;

  // Pagina até buscar todos os registros
  while (true) {
    const url  = cursor ? `/session-usage-logs?cursor=${cursor}` : "/session-usage-logs";
    const data: UsageLogRaw[] | UsageLogPage | null = await api.get(url);
    if (!data) break;

    // Suporta formato antigo (array) e novo ({ items, nextCursor })
    const items      = Array.isArray(data) ? data : ((data as UsageLogPage).items ?? []);
    const nextCursor = Array.isArray(data) ? null  : (data as UsageLogPage).nextCursor;

    all.push(...items.map((r: UsageLogRaw) => ({
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
