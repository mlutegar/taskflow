import { storageGet, storageAppend } from "./storage";

const LS_KEY = "checkinLog";
const MAX_ENTRIES = 200;

export function logCheckinUsage(estadoId, modeId) {
  if (!estadoId || !modeId) return;
  storageAppend(LS_KEY, {
    estadoId,
    modeId,
    date: new Date().toISOString().slice(0, 10),
    hour: new Date().getHours(),
  }, MAX_ENTRIES);
}

const FEEDBACK_KEY = "checkinFeedback";
const MAX_FEEDBACK = 200;

export function logSessionFeedback(estadoId, modeId, rating) {
  if (!estadoId && !modeId) return;
  storageAppend(FEEDBACK_KEY, {
    estadoId,
    modeId,
    rating, // 1 = positivo, -1 = negativo
    date: new Date().toISOString().slice(0, 10),
  }, MAX_FEEDBACK);
}

export function getSessionFeedback() {
  return storageGet(FEEDBACK_KEY, []);
}

export function getCheckinLog() {
  return storageGet(LS_KEY, []);
}

/** Total de check-ins realizados (para conquista "Auto-conhecimento"). */
export function getCheckinCount() {
  return getCheckinLog().length;
}

/**
 * Retorna os modos mais usados para um dado estadoId,
 * ordenados por frequência decrescente.
 * Ex: getTopModesForEstado("cansado") → [{ modeId: "meditar", count: 5 }, ...]
 */
export function getTopModesForEstado(estadoId) {
  const log = getCheckinLog().filter((e) => e.estadoId === estadoId);
  const counts = {};
  for (const e of log) {
    counts[e.modeId] = (counts[e.modeId] || 0) + 1;
  }
  return Object.entries(counts)
    .map(([modeId, count]) => ({ modeId, count }))
    .sort((a, b) => b.count - a.count);
}

/** Dias consecutivos com pelo menos 1 check-in (incluindo hoje). */
export function getCheckinStreak() {
  const log = getCheckinLog();
  if (!log.length) return 0;
  const dates = [...new Set(log.map((e) => e.date))].sort().reverse();
  const today = new Date().toISOString().slice(0, 10);
  if (dates[0] !== today) return 0; // não usou hoje
  let streak = 1;
  for (let i = 1; i < dates.length; i++) {
    const prev = new Date(dates[i - 1]);
    const curr = new Date(dates[i]);
    const diff = (prev - curr) / (1000 * 60 * 60 * 24);
    if (diff === 1) streak++;
    else break;
  }
  return streak;
}
