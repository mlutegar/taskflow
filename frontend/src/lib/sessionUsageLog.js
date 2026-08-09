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

  // Sync com backend (fire-and-forget com retry offline)
  import("./syncQueue").then(({ withOfflineFallback }) => {
    withOfflineFallback("POST", "/session-usage-logs", {
      mode_id:         entry.modeId,
      date:            entry.date,
      hour:            entry.hour,
      worked:          entry.worked,
      focused_minutes: entry.focusedMinutes,
      idle_minutes:    entry.idleMinutes,
      idle_reason:     entry.idleReason,
      feeling:         entry.feeling,
    });
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

// ── Blocos de horário ─────────────────────────────────────────────────────────
const HOUR_BLOCKS = [
  { id: "madrugada", label: "madrugada", emoji: "🌙", range: [0,  5]  },
  { id: "manha",     label: "manhã",     emoji: "🌅", range: [6,  11] },
  { id: "tarde",     label: "tarde",     emoji: "☀️", range: [12, 17] },
  { id: "noite",     label: "noite",     emoji: "🌆", range: [18, 23] },
];

function blockForHour(hour) {
  return HOUR_BLOCKS.find((b) => hour >= b.range[0] && hour <= b.range[1]) || HOUR_BLOCKS[3];
}

/** Retorna o bloco de horário atual. */
export function getCurrentHourBlock() {
  return blockForHour(new Date().getHours());
}

/**
 * Melhor horário para um modo específico (mín. 3 registros para recomendar).
 * Retorna: { block, successRate, total } | null
 */
export function getBestHourForMode(modeId, minSessions = 3) {
  const logs = getUsageLogs().filter((e) => e.modeId === modeId);
  if (!logs.length) return null;

  const blockMap = {};
  for (const e of logs) {
    const b = blockForHour(e.hour);
    if (!blockMap[b.id]) blockMap[b.id] = { block: b, total: 0, worked: 0 };
    blockMap[b.id].total++;
    if (e.worked) blockMap[b.id].worked++;
  }

  const candidates = Object.values(blockMap)
    .filter((s) => s.total >= minSessions)
    .map((s) => ({ ...s, successRate: Math.round((s.worked / s.total) * 100) }))
    .sort((a, b) => b.successRate - a.successRate);

  return candidates[0] || null;
}

/**
 * Taxa de sucesso de um modo específico.
 * Retorna: { total, worked, successRate } | null se < minSessions
 */
export function getModeSuccessRate(modeId, minSessions = 3) {
  const logs = getUsageLogs().filter((e) => e.modeId === modeId);
  if (logs.length < minSessions) return null;
  const worked = logs.filter((e) => e.worked).length;
  return { total: logs.length, worked, successRate: Math.round((worked / logs.length) * 100) };
}

/**
 * Tendência temporal: compara últimos 14 dias vs 14 dias anteriores por bloco de horário.
 * Retorna: [{ block, recentRate, prevRate, trend }] onde trend = "up"|"down"|"stable"
 */
export function getTemporalTrend() {
  const now = new Date();
  const fmt = (d) => [d.getFullYear(), String(d.getMonth()+1).padStart(2,"0"), String(d.getDate()).padStart(2,"0")].join("-");

  const d14 = new Date(now); d14.setDate(d14.getDate() - 14);
  const d28 = new Date(now); d28.setDate(d28.getDate() - 28);
  const cutoff14 = fmt(d14);
  const cutoff28 = fmt(d28);

  const recent = getUsageLogs().filter((e) => e.date >= cutoff14);
  const prev   = getUsageLogs().filter((e) => e.date >= cutoff28 && e.date < cutoff14);

  if (!recent.length || !prev.length) return null;

  const calcBlockRates = (logs) => {
    const map = {};
    for (const e of logs) {
      const b = blockForHour(e.hour);
      if (!map[b.id]) map[b.id] = { block: b, total: 0, worked: 0 };
      map[b.id].total++;
      if (e.worked) map[b.id].worked++;
    }
    return map;
  };

  const recentMap = calcBlockRates(recent);
  const prevMap   = calcBlockRates(prev);

  return HOUR_BLOCKS.map((b) => {
    const r = recentMap[b.id];
    const p = prevMap[b.id];
    if (!r || r.total < 2) return null;
    const recentRate = Math.round((r.worked / r.total) * 100);
    const prevRate   = p ? Math.round((p.worked / p.total) * 100) : null;
    const delta = prevRate !== null ? recentRate - prevRate : 0;
    return {
      block: b,
      recentRate,
      prevRate,
      total: r.total,
      trend: delta >= 10 ? "up" : delta <= -10 ? "down" : "stable",
      delta,
    };
  }).filter(Boolean);
}

/**
 * Correlação estado emocional × modo: para cada modo, qual estado teve mais/menos sucesso.
 * Une checkinLog (estadoId + modeId + date) com sessionUsageLog (modeId + date + worked).
 * Retorna: { [modeId]: [{ estadoId, total, successRate }] }
 */
export function getCorrelationByEstado() {
  const logs = getUsageLogs();
  if (!logs.length) return {};

  // Mapa rápido: modeId+date → worked (pega o primeiro de cada dia)
  const usageMap = {};
  for (const e of logs) {
    const key = `${e.modeId}|${e.date}`;
    if (!usageMap[key]) usageMap[key] = e.worked;
  }

  const checkins = storageGet("checkinLog", []);

  const map = {}; // { modeId: { estadoId: { total, worked } } }
  for (const c of checkins) {
    if (!c.estadoId || !c.modeId) continue;
    const key = `${c.modeId}|${c.date}`;
    if (!(key in usageMap)) continue; // sem log de uso nesse dia

    if (!map[c.modeId]) map[c.modeId] = {};
    if (!map[c.modeId][c.estadoId]) map[c.modeId][c.estadoId] = { total: 0, worked: 0 };
    map[c.modeId][c.estadoId].total++;
    if (usageMap[key]) map[c.modeId][c.estadoId].worked++;
  }

  const result = {};
  for (const [modeId, estados] of Object.entries(map)) {
    result[modeId] = Object.entries(estados)
      .filter(([, s]) => s.total >= 2)
      .map(([estadoId, s]) => ({
        estadoId,
        total: s.total,
        successRate: Math.round((s.worked / s.total) * 100),
      }))
      .sort((a, b) => b.successRate - a.successRate);
  }
  return result;
}

// ── Lembretes pendentes ───────────────────────────────────────────────────────
const REMINDER_KEY = "sessionReminders";

export function addPendingReminder(modeId, modeName) {
  try {
    const existing = JSON.parse(localStorage.getItem("taskflow." + REMINDER_KEY) || "[]");
    const already = existing.some((r) => r.modeId === modeId);
    if (already) return;
    existing.push({ modeId, modeName, skippedAt: new Date().toISOString() });
    localStorage.setItem("taskflow." + REMINDER_KEY, JSON.stringify(existing));
  } catch {}
}

export function getPendingReminders() {
  try { return JSON.parse(localStorage.getItem("taskflow." + REMINDER_KEY) || "[]"); }
  catch { return []; }
}

export function clearPendingReminder(modeId) {
  try {
    const existing = JSON.parse(localStorage.getItem("taskflow." + REMINDER_KEY) || "[]");
    localStorage.setItem("taskflow." + REMINDER_KEY, JSON.stringify(existing.filter((r) => r.modeId !== modeId)));
  } catch {}
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
