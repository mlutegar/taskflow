/**
 * modeComboLog.js — Registro de combinações de modos testadas.
 * Offline-first: localStorage via storage.js helpers.
 */

import { storageGet, storageAppend, storageSet } from "./storage";
import { syncToBackend } from "./syncToBackend";

const RETAIN_DAYS = 90;

const LS_KEY = "modeComboLogs";
const MAX_ENTRIES = 500;

interface ComboEntry {
  modeIdA: string;
  modeIdB: string;
  date: string;
  hour: number;
  worked: boolean | null;
  focusedMinutes: number;
  feeling: string[];
}

interface ComboStat {
  key: string;
  modeIdA: string;
  modeIdB: string;
  total: number;
  worked: number;
  successRate: number;
}

interface ComboStatAccumulator {
  modeIdA: string;
  modeIdB: string;
  total: number;
  workedCount: number;
}

function localIsoDate(): string {
  const d = new Date();
  return [
    d.getFullYear(),
    String(d.getMonth() + 1).padStart(2, "0"),
    String(d.getDate()).padStart(2, "0"),
  ].join("-");
}

/**
 * Registra uma sessão de combo de modos.
 */
export function logCombo({ modeIdA, modeIdB, worked, focusedMinutes, feeling }: {
  modeIdA: string;
  modeIdB: string;
  worked: boolean | null;
  focusedMinutes: number;
  feeling: string[];
}): void {
  if (!modeIdA || !modeIdB) return;
  const date = localIsoDate();
  const hour = new Date().getHours();
  // Normaliza par alfabeticamente para consistência nas análises
  const [idA, idB] = [modeIdA, modeIdB].sort();
  const entry: ComboEntry = { modeIdA: idA, modeIdB: idB, date, hour, worked, focusedMinutes, feeling };
  storageAppend(LS_KEY, entry, MAX_ENTRIES);

  syncToBackend("POST", "/mode-combo-log", { modeIdA: idA, modeIdB: idB, date, hour, worked, focusedMinutes, feeling });
}

/** Retorna todos os registros de combos. */
export function getAllCombos(): ComboEntry[] {
  return storageGet(LS_KEY, []);
}

/**
 * Estatísticas agregadas por par de modos.
 * Retorna: [{ key, modeIdA, modeIdB, total, worked, successRate }]
 * Ordenado por total de usos (decrescente).
 */
export function getComboStats(): ComboStat[] {
  const logs = getAllCombos();
  const map: Record<string, ComboStatAccumulator> = {};
  for (const e of logs) {
    const key = `${e.modeIdA}+${e.modeIdB}`;
    if (!map[key]) map[key] = { modeIdA: e.modeIdA, modeIdB: e.modeIdB, total: 0, workedCount: 0 };
    map[key].total++;
    if (e.worked === true) map[key].workedCount++;
  }
  return Object.entries(map)
    .map(([key, s]) => ({
      key,
      modeIdA: s.modeIdA,
      modeIdB: s.modeIdB,
      total: s.total,
      worked: s.workedCount,
      successRate: s.total > 0 ? Math.round((s.workedCount / s.total) * 100) : 0,
    }))
    .sort((a, b) => b.total - a.total);
}

/**
 * Stats de um par específico.
 */
export function getComboStatsForPair(idA: string, idB: string): ComboStat | null {
  const [a, b] = [idA, idB].sort();
  const all = getComboStats();
  return all.find((s) => s.modeIdA === a && s.modeIdB === b) || null;
}

/**
 * Carrega registros do backend e mescla com localStorage.
 * Deduplicação por modeIdA + modeIdB + date + hour.
 * Deve ser chamado no boot do app após login.
 */
export async function loadRemoteModeComboLog(): Promise<void> {
  try {
    const { fetchModeComboLogs } = await import("../api/modeComboLog");
    const remote: ComboEntry[] = await fetchModeComboLogs();
    if (!remote || !remote.length) return;

    const local: ComboEntry[] = storageGet(LS_KEY, []);
    const seen = new Set(local.map((e) => `${e.modeIdA}|${e.modeIdB}|${e.date}|${e.hour}`));
    const fresh = remote.filter((e) => !seen.has(`${e.modeIdA}|${e.modeIdB}|${e.date}|${e.hour}`));
    if (!fresh.length) return;

    // Mantém retenção de 90 dias
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - RETAIN_DAYS);
    const cutoffIso = cutoff.toISOString().slice(0, 10);

    const merged = [...local, ...fresh].filter((e) => e.date >= cutoffIso);
    storageSet(LS_KEY, merged);
  } catch {
    // Falha silenciosa — app funciona com dados locais
  }
}
