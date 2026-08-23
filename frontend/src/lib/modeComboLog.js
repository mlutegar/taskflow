/**
 * modeComboLog.js — Registro de combinações de modos testadas.
 * Offline-first: localStorage via storage.js helpers.
 */

import { storageGet, storageAppend, storageSet } from "./storage";
import { syncToBackend } from "./syncToBackend";

const RETAIN_DAYS = 90;

const LS_KEY = "modeComboLogs";
const MAX_ENTRIES = 500;

function localIsoDate() {
  const d = new Date();
  return [
    d.getFullYear(),
    String(d.getMonth() + 1).padStart(2, "0"),
    String(d.getDate()).padStart(2, "0"),
  ].join("-");
}

/**
 * Registra uma sessão de combo de modos.
 * @param {object} entry
 * @param {string} entry.modeIdA
 * @param {string} entry.modeIdB
 * @param {boolean|null} entry.worked  — true=sim, false=não, null=mais ou menos
 * @param {number} entry.focusedMinutes
 * @param {string[]} entry.feeling
 */
export function logCombo({ modeIdA, modeIdB, worked, focusedMinutes, feeling }) {
  if (!modeIdA || !modeIdB) return;
  const date = localIsoDate();
  const hour = new Date().getHours();
  // Normaliza par alfabeticamente para consistência nas análises
  const [idA, idB] = [modeIdA, modeIdB].sort();
  const entry = { modeIdA: idA, modeIdB: idB, date, hour, worked, focusedMinutes, feeling };
  storageAppend(LS_KEY, entry, MAX_ENTRIES);

  syncToBackend("POST", "/mode-combo-log", { modeIdA: idA, modeIdB: idB, date, hour, worked, focusedMinutes, feeling });
}

/** Retorna todos os registros de combos. */
export function getAllCombos() {
  return storageGet(LS_KEY, []);
}

/**
 * Estatísticas agregadas por par de modos.
 * Retorna: [{ key, modeIdA, modeIdB, total, worked, successRate }]
 * Ordenado por total de usos (decrescente).
 */
export function getComboStats() {
  const logs = getAllCombos();
  const map = {};
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
 * @param {string} idA
 * @param {string} idB
 * @returns {{ total, worked, successRate } | null}
 */
export function getComboStatsForPair(idA, idB) {
  const [a, b] = [idA, idB].sort();
  const all = getComboStats();
  return all.find((s) => s.modeIdA === a && s.modeIdB === b) || null;
}

/**
 * Carrega registros do backend e mescla com localStorage.
 * Deduplicação por modeIdA + modeIdB + date + hour.
 * Deve ser chamado no boot do app após login.
 */
export async function loadRemoteModeComboLog() {
  try {
    const { fetchModeComboLogs } = await import("../api/modeComboLog");
    const remote = await fetchModeComboLogs();
    if (!remote || !remote.length) return;

    const local = storageGet(LS_KEY, []);
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
