const LS_KEY = "taskflow.checkinLog";
const MAX_ENTRIES = 200;

export function logCheckinUsage(estadoId, modeId) {
  if (!estadoId || !modeId) return;
  try {
    const log = getCheckinLog();
    log.push({ estadoId, modeId, date: new Date().toISOString().slice(0, 10) });
    // Mantém apenas as últimas MAX_ENTRIES entradas
    const trimmed = log.slice(-MAX_ENTRIES);
    localStorage.setItem(LS_KEY, JSON.stringify(trimmed));
  } catch {}
}

export function getCheckinLog() {
  try {
    return JSON.parse(localStorage.getItem(LS_KEY) || "[]");
  } catch {
    return [];
  }
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
