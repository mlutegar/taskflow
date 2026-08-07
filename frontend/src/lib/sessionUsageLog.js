/**
 * sessionUsageLog.js — Registro de uso pós-sessão de modos.
 * Captura dados qualitativos: funcionou, tempo de foco, ociosidade, sentimento.
 * Padrão offline-first: localStorage + sync Supabase (fire-and-forget).
 */

import { storageGet, storageAppend, storageSet } from "./storage";

const LS_KEY = "sessionUsageLog";
const MAX_ENTRIES = 365;

function localIsoDate() {
  const d = new Date();
  return [d.getFullYear(), String(d.getMonth() + 1).padStart(2, "0"), String(d.getDate()).padStart(2, "0")].join("-");
}

/**
 * Salva um registro de uso pós-sessão.
 * @param {object} entry
 * @param {string} entry.modeId
 * @param {boolean} entry.worked
 * @param {number} entry.focusedMinutes
 * @param {number} entry.idleMinutes
 * @param {string[]} entry.idleReason
 * @param {string[]} entry.feeling
 */
export function logUsage({ modeId, worked, focusedMinutes, idleMinutes, idleReason, feeling }) {
  if (!modeId) return;
  const date = localIsoDate();
  const hour = new Date().getHours();
  const entry = { modeId, date, hour, worked, focusedMinutes, idleMinutes, idleReason, feeling };
  storageAppend(LS_KEY, entry, MAX_ENTRIES);

  // Sync com Supabase (fire-and-forget)
  import("../api/sessionUsageLogs").then(({ saveUsageLog }) => {
    saveUsageLog(entry).catch(() => {});
  });
}

/** Retorna todos os registros salvos. */
export function getUsageLogs() {
  return storageGet(LS_KEY, []);
}

/**
 * Estatísticas por modo para um período de N dias.
 * Retorna: [{ modeId, total, worked, successRate, avgFocusMin, avgIdleMin }]
 */
export function getUsageStatsByMode(days = 30) {
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - days);
  const cutoffStr = [cutoff.getFullYear(), String(cutoff.getMonth() + 1).padStart(2, "0"), String(cutoff.getDate()).padStart(2, "0")].join("-");

  const logs = getUsageLogs().filter((e) => e.date >= cutoffStr);
  const byMode = {};
  for (const e of logs) {
    if (!byMode[e.modeId]) byMode[e.modeId] = { total: 0, worked: 0, focusSum: 0, idleSum: 0 };
    byMode[e.modeId].total++;
    if (e.worked) byMode[e.modeId].worked++;
    byMode[e.modeId].focusSum += e.focusedMinutes || 0;
    byMode[e.modeId].idleSum += e.idleMinutes || 0;
  }
  return Object.entries(byMode).map(([modeId, s]) => ({
    modeId,
    total: s.total,
    worked: s.worked,
    successRate: s.total > 0 ? Math.round((s.worked / s.total) * 100) : 0,
    avgFocusMin: s.total > 0 ? Math.round(s.focusSum / s.total) : 0,
    avgIdleMin:  s.total > 0 ? Math.round(s.idleSum  / s.total) : 0,
  }));
}

/**
 * Mapa hora-do-dia × taxa de sucesso por modeId.
 * Retorna: { [modeId]: { [hour: 0-23]: { total, worked, successRate } } }
 */
export function getHourlySuccessMap() {
  const logs = getUsageLogs();
  const map = {};
  for (const e of logs) {
    if (!map[e.modeId]) map[e.modeId] = {};
    if (!map[e.modeId][e.hour]) map[e.modeId][e.hour] = { total: 0, worked: 0 };
    map[e.modeId][e.hour].total++;
    if (e.worked) map[e.modeId][e.hour].worked++;
  }
  // Calcula taxas
  for (const modeId of Object.keys(map)) {
    for (const hour of Object.keys(map[modeId])) {
      const s = map[modeId][hour];
      s.successRate = s.total > 0 ? Math.round((s.worked / s.total) * 100) : 0;
    }
  }
  return map;
}

/**
 * Sentimentos que mais aparecem nas sessões que funcionaram vs. não funcionaram.
 * Retorna: [{ feeling, workedCount, notWorkedCount, successRate }]
 */
export function getFeelingStats() {
  const logs = getUsageLogs();
  const map = {};
  for (const e of logs) {
    for (const f of (e.feeling || [])) {
      if (!map[f]) map[f] = { workedCount: 0, notWorkedCount: 0 };
      if (e.worked) map[f].workedCount++;
      else map[f].notWorkedCount++;
    }
  }
  return Object.entries(map).map(([feeling, s]) => {
    const total = s.workedCount + s.notWorkedCount;
    return {
      feeling,
      workedCount: s.workedCount,
      notWorkedCount: s.notWorkedCount,
      successRate: total > 0 ? Math.round((s.workedCount / total) * 100) : 0,
    };
  }).sort((a, b) => b.successRate - a.successRate);
}

/**
 * Carrega registros do Supabase e mescla com localStorage.
 */
export async function loadRemoteUsageLogs() {
  try {
    const { fetchUsageLogs } = await import("../api/sessionUsageLogs");
    const remote = await fetchUsageLogs();
    if (remote && remote.length) {
      const local = storageGet(LS_KEY, []);
      const seen = new Set(local.map((e) => `${e.modeId}|${e.date}|${e.hour}`));
      const fresh = remote.filter((e) => !seen.has(`${e.modeId}|${e.date}|${e.hour}`));
      if (fresh.length) {
        const merged = [...local, ...fresh].slice(-MAX_ENTRIES);
        storageSet(LS_KEY, merged);
      }
    }
  } catch {
    // Falha silenciosa
  }
}
