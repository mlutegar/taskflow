/**
 * modeComboLog.js — API client para registros de combinações de modos.
 */

import { api } from "../lib/apiClient";

interface ModeComboLogPayload {
  modeIdA: string;
  modeIdB: string;
  date: string;
  hour: number;
  worked: boolean;
  focusedMinutes: number;
  feeling: string;
}

export async function saveModeComboLog({ modeIdA, modeIdB, date, hour, worked, focusedMinutes, feeling }: ModeComboLogPayload): Promise<unknown> {
  return api.post("/mode-combo-log", { modeIdA, modeIdB, date, hour, worked, focusedMinutes, feeling });
}

export async function fetchModeComboLogs(): Promise<ModeComboLogPayload[]> {
  const data = await api.get("/mode-combo-log");
  if (!data || !Array.isArray(data)) return [];
  return data.map((r: ModeComboLogPayload) => ({
    modeIdA: r.modeIdA,
    modeIdB: r.modeIdB,
    date: r.date,
    hour: r.hour,
    worked: r.worked,
    focusedMinutes: r.focusedMinutes,
    feeling: r.feeling,
  }));
}
