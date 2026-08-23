/**
 * sessionUsageLog.ts — Registro de uso pós-sessão de modos.
 * Captura dados qualitativos: funcionou, tempo de foco, ociosidade, sentimento.
 * Padrão offline-first: localStorage + sync Supabase (fire-and-forget).
 */

import { storageGet, storageAppend, storageSet } from "./storage";
import { syncToBackend } from "./syncToBackend";

const LS_KEY = "sessionUsageLog";
const MAX_ENTRIES = 500; // ~500 sessions ≈ ~1 session/day for 1.5 years
const RETAIN_DAYS = 90;  // prune entries older than 90 days, same as modeLog

interface SessionUsageEntry {
  id: string;
  modeId: string;
  date: string;
  hour: number;
  worked: boolean;
  focusedMinutes: number;
  idleMinutes: number;
  idleReason: string[];
  feeling: string[];
  comboWith?: string;
}

interface HourBlock {
  id: string;
  label: string;
  emoji: string;
  range: [number, number];
}

interface UsageStatsByMode {
  modeId: string;
  total: number;
  worked: number;
  successRate: number;
  avgFocusMin: number;
  avgIdleMin: number;
}

interface HourSlotStats {
  total: number;
  worked: number;
  successRate?: number;
}

interface HourlySuccessMap {
  [modeId: string]: {
    [hour: string]: HourSlotStats;
  };
}

interface FeelingStats {
  feeling: string;
  workedCount: number;
  notWorkedCount: number;
  successRate: number;
}

interface BestHourResult {
  block: HourBlock;
  total: number;
  worked: number;
  successRate: number;
}

interface ModeSuccessRate {
  total: number;
  worked: number;
  successRate: number;
}

interface TemporalTrendItem {
  block: HourBlock;
  recentRate: number;
  prevRate: number | null;
  total: number;
  trend: "up" | "down" | "stable";
  delta: number;
}

interface CorrelationByEstado {
  [modeId: string]: Array<{
    estadoId: string;
    total: number;
    successRate: number;
  }>;
}

interface FocusedMinutesByMode {
  modeId: string;
  totalFocusMin: number;
  totalIdleMin: number;
  sessions: number;
}

interface BestDayOfWeek {
  dayIndex: number;
  dayName: string;
  avgFocusMin: number;
  totalSessions: number;
}

interface WeeklyFocusComparison {
  thisWeekMin: number;
  lastWeekMin: number;
  diff: number;
  pct: number | null;
}

interface FocusByDay {
  date: string;
  label: string;
  focusedMinutes: number;
  idleMinutes: number;
}

interface PendingReminder {
  modeId: string;
  modeName: string;
  skippedAt: string;
}

interface ComboPartner {
  modeId: string;
  total: number;
  successRate: number;
}

interface ComboVsSoloRate {
  soloRate: number;
  comboRate: number;
  delta: number;
}

function localIsoDate(): string {
  const d = new Date();
  return [d.getFullYear(), String(d.getMonth() + 1).padStart(2, "0"), String(d.getDate()).padStart(2, "0")].join("-");
}

/**
 * Salva um registro de uso pós-sessão.
 */
/** Gera um UUID v4 simples sem dependências externas. */
function generateId(): string {
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    return (c === "x" ? r : (r & 0x3) | 0x8).toString(16);
  });
}

export function logUsage({ modeId, worked, focusedMinutes, idleMinutes, idleReason, feeling, comboWith }: {
  modeId: string;
  worked: boolean;
  focusedMinutes: number;
  idleMinutes: number;
  idleReason: string[];
  feeling: string[];
  comboWith?: string;
}): unknown {
  if (!modeId) return false;
  const date = localIsoDate();
  const hour = new Date().getHours();
  const id = generateId();
  const entry: SessionUsageEntry = { id, modeId, date, hour, worked, focusedMinutes, idleMinutes, idleReason, feeling, ...(comboWith ? { comboWith } : {}) };
  const saved = storageAppend(LS_KEY, entry, MAX_ENTRIES);

  syncToBackend("POST", "/session-usage-logs", {
    id:              entry.id,
    mode_id:         entry.modeId,
    date:            entry.date,
    hour:            entry.hour,
    worked:          entry.worked,
    focused_minutes: entry.focusedMinutes,
    idle_minutes:    entry.idleMinutes,
    idle_reason:     entry.idleReason,
    feeling:         entry.feeling,
    ...(entry.comboWith ? { combo_with: entry.comboWith } : {}),
  });

  return saved;
}

/** Retorna todos os registros salvos (entradas dos últimos 90 dias). */
export function getUsageLogs(): SessionUsageEntry[] {
  const all: SessionUsageEntry[] = storageGet(LS_KEY, []);
  const cutoff = (() => {
    const d = new Date();
    d.setDate(d.getDate() - RETAIN_DAYS);
    return [d.getFullYear(), String(d.getMonth() + 1).padStart(2, "0"), String(d.getDate()).padStart(2, "0")].join("-");
  })();
  return all.filter((e) => !e.date || e.date >= cutoff);
}

/**
 * Estatísticas por modo para um período de N dias.
 * Retorna: [{ modeId, total, worked, successRate, avgFocusMin, avgIdleMin }]
 */
export function getUsageStatsByMode(days = 30): UsageStatsByMode[] {
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - days);
  const cutoffStr = [cutoff.getFullYear(), String(cutoff.getMonth() + 1).padStart(2, "0"), String(cutoff.getDate()).padStart(2, "0")].join("-");

  const logs = getUsageLogs().filter((e) => e.date >= cutoffStr);
  const byMode: Record<string, { total: number; worked: number; focusSum: number; idleSum: number }> = {};
  for (const e of logs) {
    if (!byMode[e.modeId]) byMode[e.modeId] = { total: 0, worked: 0, focusSum: 0, idleSum: 0 };
    byMode[e.modeId].total++;
    if (e.worked === true) byMode[e.modeId].worked++;
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
export function getHourlySuccessMap(): HourlySuccessMap {
  const logs = getUsageLogs();
  const map: HourlySuccessMap = {};
  for (const e of logs) {
    if (!map[e.modeId]) map[e.modeId] = {};
    if (!map[e.modeId][e.hour]) map[e.modeId][e.hour] = { total: 0, worked: 0 };
    map[e.modeId][e.hour].total++;
    if (e.worked === true) map[e.modeId][e.hour].worked++;
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
export function getFeelingStats(): FeelingStats[] {
  const logs = getUsageLogs();
  const map: Record<string, { workedCount: number; notWorkedCount: number }> = {};
  for (const e of logs) {
    for (const f of (e.feeling || [])) {
      if (!map[f]) map[f] = { workedCount: 0, notWorkedCount: 0 };
      if (e.worked === true) map[f].workedCount++;
      else if (e.worked === false) map[f].notWorkedCount++;
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
const HOUR_BLOCKS: HourBlock[] = [
  { id: "madrugada", label: "madrugada", emoji: "🌙", range: [0,  5]  },
  { id: "manha",     label: "manhã",     emoji: "🌅", range: [6,  11] },
  { id: "tarde",     label: "tarde",     emoji: "☀️", range: [12, 17] },
  { id: "noite",     label: "noite",     emoji: "🌆", range: [18, 23] },
];

function blockForHour(hour: number): HourBlock {
  return HOUR_BLOCKS.find((b) => hour >= b.range[0] && hour <= b.range[1]) || HOUR_BLOCKS[3];
}

/** Retorna o bloco de horário atual. */
export function getCurrentHourBlock(): HourBlock {
  return blockForHour(new Date().getHours());
}

/**
 * Melhor horário para um modo específico (mín. 3 registros para recomendar).
 * Retorna: { block, successRate, total } | null
 */
export function getBestHourForMode(modeId: string, minSessions = 3): BestHourResult | null {
  const logs = getUsageLogs().filter((e) => e.modeId === modeId);
  if (!logs.length) return null;

  const blockMap: Record<string, { block: HourBlock; total: number; worked: number }> = {};
  for (const e of logs) {
    const b = blockForHour(e.hour);
    if (!blockMap[b.id]) blockMap[b.id] = { block: b, total: 0, worked: 0 };
    blockMap[b.id].total++;
    if (e.worked === true) blockMap[b.id].worked++;
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
export function getModeSuccessRate(modeId: string, minSessions = 3): ModeSuccessRate | null {
  const logs = getUsageLogs().filter((e) => e.modeId === modeId);
  if (logs.length < minSessions) return null;
  const worked = logs.filter((e) => e.worked === true).length;
  return { total: logs.length, worked, successRate: Math.round((worked / logs.length) * 100) };
}

/**
 * Tendência temporal: compara últimos 14 dias vs 14 dias anteriores por bloco de horário.
 * Retorna: [{ block, recentRate, prevRate, trend }] onde trend = "up"|"down"|"stable"
 */
export function getTemporalTrend(): TemporalTrendItem[] | null {
  const now = new Date();
  const fmt = (d: Date): string => [d.getFullYear(), String(d.getMonth()+1).padStart(2,"0"), String(d.getDate()).padStart(2,"0")].join("-");

  const d14 = new Date(now); d14.setDate(d14.getDate() - 14);
  const d28 = new Date(now); d28.setDate(d28.getDate() - 28);
  const cutoff14 = fmt(d14);
  const cutoff28 = fmt(d28);

  const recent = getUsageLogs().filter((e) => e.date >= cutoff14);
  const prev   = getUsageLogs().filter((e) => e.date >= cutoff28 && e.date < cutoff14);

  if (!recent.length || !prev.length) return null;

  const calcBlockRates = (logs: SessionUsageEntry[]): Record<string, { block: HourBlock; total: number; worked: number }> => {
    const map: Record<string, { block: HourBlock; total: number; worked: number }> = {};
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
      trend: (delta >= 10 ? "up" : delta <= -10 ? "down" : "stable") as "up" | "down" | "stable",
      delta,
    };
  }).filter((item): item is TemporalTrendItem => item !== null);
}

/**
 * Correlação estado emocional × modo: para cada modo, qual estado teve mais/menos sucesso.
 * Une checkinLog (estadoId + modeId + date) com sessionUsageLog (modeId + date + worked).
 * Retorna: { [modeId]: [{ estadoId, total, successRate }] }
 */
export function getCorrelationByEstado(): CorrelationByEstado {
  const logs = getUsageLogs();
  if (!logs.length) return {};

  // Mapa rápido: modeId+date → worked (pega o primeiro de cada dia)
  const usageMap: Record<string, boolean> = {};
  for (const e of logs) {
    const key = `${e.modeId}|${e.date}`;
    if (!usageMap[key]) usageMap[key] = e.worked;
  }

  const checkins: Array<{ estadoId?: string; modeId?: string; date?: string }> = storageGet("checkinLog", []);

  const map: Record<string, Record<string, { total: number; worked: number }>> = {};
  for (const c of checkins) {
    if (!c.estadoId || !c.modeId) continue;
    const key = `${c.modeId}|${c.date}`;
    if (!(key in usageMap)) continue; // sem log de uso nesse dia

    if (!map[c.modeId]) map[c.modeId] = {};
    if (!map[c.modeId][c.estadoId]) map[c.modeId][c.estadoId] = { total: 0, worked: 0 };
    map[c.modeId][c.estadoId].total++;
    if (usageMap[key]) map[c.modeId][c.estadoId].worked++;
  }

  const result: CorrelationByEstado = {};
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

/**
 * Minutos focados totais por modo para os últimos N dias.
 * Retorna: [{ modeId, totalFocusMin, totalIdleMin, sessions }] ordenado por totalFocusMin desc.
 */
export function getFocusedMinutesByMode(days = 30): FocusedMinutesByMode[] {
  const cutoff = (() => {
    const d = new Date();
    d.setDate(d.getDate() - days);
    return [d.getFullYear(), String(d.getMonth() + 1).padStart(2, "0"), String(d.getDate()).padStart(2, "0")].join("-");
  })();
  const map: Record<string, { totalFocusMin: number; totalIdleMin: number; sessions: number }> = {};
  for (const e of getUsageLogs().filter((e) => e.date >= cutoff)) {
    if (!map[e.modeId]) map[e.modeId] = { totalFocusMin: 0, totalIdleMin: 0, sessions: 0 };
    map[e.modeId].totalFocusMin += e.focusedMinutes || 0;
    map[e.modeId].totalIdleMin  += e.idleMinutes    || 0;
    map[e.modeId].sessions++;
  }
  return Object.entries(map)
    .map(([modeId, s]) => ({ modeId, ...s }))
    .sort((a, b) => b.totalFocusMin - a.totalFocusMin);
}

/**
 * Melhor dia da semana para foco (domingo=0 … sábado=6).
 * Retorna: { dayIndex, dayName, avgFocusMin, totalSessions } | null
 */
export function getBestDayOfWeek(): BestDayOfWeek | null {
  const PT_DAYS = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];
  const map: Record<number, { focus: number; sessions: number }> = {};
  for (const e of getUsageLogs()) {
    const [y, m, d] = e.date.split("-").map(Number);
    const dow = new Date(y, m - 1, d).getDay();
    if (!map[dow]) map[dow] = { focus: 0, sessions: 0 };
    map[dow].focus += e.focusedMinutes || 0;
    map[dow].sessions++;
  }
  const entries = Object.entries(map) as [string, { focus: number; sessions: number }][];
  if (!entries.length) return null;
  const [dayIndex, stats] = entries.sort((a, b) => b[1].focus - a[1].focus)[0];
  return {
    dayIndex: Number(dayIndex),
    dayName: PT_DAYS[dayIndex],
    avgFocusMin: stats.sessions > 0 ? Math.round(stats.focus / stats.sessions) : 0,
    totalSessions: stats.sessions,
  };
}

/**
 * Comparação semana atual vs semana anterior em minutos focados.
 * Retorna: { thisWeekMin, lastWeekMin, diff, pct }
 */
export function getWeeklyFocusComparison(): WeeklyFocusComparison {
  const now = new Date();
  const dayOfWeek = now.getDay();
  const pad = (n: number): string => String(n).padStart(2, "0");
  const fmt = (d: Date): string => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;

  const startThis = new Date(now);
  startThis.setDate(now.getDate() - dayOfWeek);
  startThis.setHours(0, 0, 0, 0);

  const startLast = new Date(startThis);
  startLast.setDate(startThis.getDate() - 7);

  const thisWeekStart = fmt(startThis);
  const lastWeekStart = fmt(startLast);

  let thisWeekMin = 0, lastWeekMin = 0;
  for (const e of getUsageLogs()) {
    if (e.date >= thisWeekStart) thisWeekMin += e.focusedMinutes || 0;
    else if (e.date >= lastWeekStart) lastWeekMin += e.focusedMinutes || 0;
  }
  const diff = thisWeekMin - lastWeekMin;
  const pct  = lastWeekMin > 0 ? Math.round((diff / lastWeekMin) * 100) : null;
  return { thisWeekMin, lastWeekMin, diff, pct };
}

/**
 * Minutos focados e ociosos agrupados por dia para os últimos N dias.
 * Retorna: [{ date, label, focusedMinutes, idleMinutes }] — um item por dia,
 * mesmo que não haja registros naquele dia (valor 0).
 */
export function getFocusedMinutesByDay(days = 30): FocusByDay[] {
  const logs = getUsageLogs();
  const map: Record<string, { focusedMinutes: number; idleMinutes: number }> = {};
  for (const e of logs) {
    if (!map[e.date]) map[e.date] = { focusedMinutes: 0, idleMinutes: 0 };
    map[e.date].focusedMinutes += e.focusedMinutes || 0;
    map[e.date].idleMinutes   += e.idleMinutes   || 0;
  }

  const result: FocusByDay[] = [];
  for (let i = days - 1; i >= 0; i--) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    const iso   = [d.getFullYear(), String(d.getMonth() + 1).padStart(2, "0"), String(d.getDate()).padStart(2, "0")].join("-");
    const label = d.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" });
    result.push({ date: iso, label, ...(map[iso] || { focusedMinutes: 0, idleMinutes: 0 }) });
  }
  return result;
}

/**
 * Total de minutos focados nos últimos N dias.
 */
export function getTotalFocusedMinutes(days = 7): number {
  const cutoff = (() => {
    const d = new Date();
    d.setDate(d.getDate() - days);
    return [d.getFullYear(), String(d.getMonth() + 1).padStart(2, "0"), String(d.getDate()).padStart(2, "0")].join("-");
  })();
  return getUsageLogs()
    .filter((e) => e.date >= cutoff)
    .reduce((sum, e) => sum + (e.focusedMinutes || 0), 0);
}

// ── Lembretes pendentes ───────────────────────────────────────────────────────
const REMINDER_KEY = "sessionReminders";

export function addPendingReminder(modeId: string, modeName: string): void {
  try {
    const existing: PendingReminder[] = JSON.parse(localStorage.getItem("taskflow." + REMINDER_KEY) || "[]");
    const already = existing.some((r) => r.modeId === modeId);
    if (already) return;
    existing.push({ modeId, modeName, skippedAt: new Date().toISOString() });
    localStorage.setItem("taskflow." + REMINDER_KEY, JSON.stringify(existing));
  } catch {}
}

export function getPendingReminders(): PendingReminder[] {
  try { return JSON.parse(localStorage.getItem("taskflow." + REMINDER_KEY) || "[]"); }
  catch { return []; }
}

export function clearPendingReminder(modeId: string): void {
  try {
    const existing: PendingReminder[] = JSON.parse(localStorage.getItem("taskflow." + REMINDER_KEY) || "[]");
    localStorage.setItem("taskflow." + REMINDER_KEY, JSON.stringify(existing.filter((r) => r.modeId !== modeId)));
  } catch {}
}

/**
 * Melhor parceiro de combo para um modo (baseado no campo comboWith).
 * Retorna: { modeId, total, successRate } | null  (mín. 2 sessões juntos)
 */
export function getBestComboPartner(modeId: string, minSessions = 2): ComboPartner | null {
  const logs = getUsageLogs().filter((e) => e.modeId === modeId && e.comboWith);
  if (!logs.length) return null;

  const byPartner: Record<string, { total: number; worked: number }> = {};
  for (const e of logs) {
    const comboWith = e.comboWith as string;
    if (!byPartner[comboWith]) byPartner[comboWith] = { total: 0, worked: 0 };
    byPartner[comboWith].total++;
    if (e.worked === true) byPartner[comboWith].worked++;
  }

  const candidates = Object.entries(byPartner)
    .filter(([, s]) => s.total >= minSessions)
    .map(([partnerId, s]) => ({
      modeId: partnerId,
      total: s.total,
      successRate: Math.round((s.worked / s.total) * 100),
    }))
    .sort((a, b) => b.successRate - a.successRate || b.total - a.total);

  return candidates[0] || null;
}

/**
 * Compara taxa de sucesso do modo solo vs. em combo.
 * Retorna: { soloRate, comboRate, delta } | null se sem dados suficientes
 */
export function getComboVsSoloRate(modeId: string, minSessions = 2): ComboVsSoloRate | null {
  const logs = getUsageLogs().filter((e) => e.modeId === modeId);
  const solo  = logs.filter((e) => !e.comboWith);
  const combo = logs.filter((e) => !!e.comboWith);

  if (solo.length < minSessions || combo.length < minSessions) return null;

  const rate = (arr: SessionUsageEntry[]): number => Math.round((arr.filter((e) => e.worked === true).length / arr.length) * 100);
  const soloRate  = rate(solo);
  const comboRate = rate(combo);
  return { soloRate, comboRate, delta: comboRate - soloRate };
}

/**
 * Carrega registros do Supabase e mescla com localStorage.
 */
export async function loadRemoteUsageLogs(): Promise<void> {
  try {
    const { fetchUsageLogs } = await import("../api/sessionUsageLogs");
    const remote: SessionUsageEntry[] = await fetchUsageLogs();
    if (remote && remote.length) {
      const local: SessionUsageEntry[] = storageGet(LS_KEY, []);
      // Dedup por id (se disponível) ou fallback para modeId|date|hour
      const seen = new Set(local.map((e) => e.id || `${e.modeId}|${e.date}|${e.hour}`));
      const fresh = remote.filter((e) => !seen.has(e.id || `${e.modeId}|${e.date}|${e.hour}`));
      if (fresh.length) {
        const merged = [...local, ...fresh].slice(-MAX_ENTRIES);
        storageSet(LS_KEY, merged);
      }
    }
  } catch {
    // Falha silenciosa
  }
}
