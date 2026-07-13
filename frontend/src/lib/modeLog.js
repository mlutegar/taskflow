// Log local de conclusões por modo (para "mais usados na semana").
// Guarda { modeId, date: "YYYY-MM-DD" } e retém ~90 dias. Por dispositivo.

const LS_KEY = "taskflow.modeLog";
const RETAIN_DAYS = 90;

function todayIso() {
  return new Date().toISOString().slice(0, 10);
}

function read() {
  try {
    const raw = localStorage.getItem(LS_KEY);
    const list = raw ? JSON.parse(raw) : [];
    return Array.isArray(list) ? list : [];
  } catch {
    return [];
  }
}

function write(list) {
  try {
    localStorage.setItem(LS_KEY, JSON.stringify(list));
  } catch {}
}

/** Registra uma conclusão de tarefa no modo informado. */
export function logCompletion(modeId) {
  if (!modeId) return;
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - RETAIN_DAYS);
  const cutoffIso = cutoff.toISOString().slice(0, 10);

  const list = read().filter((e) => e.date >= cutoffIso);
  list.push({ modeId, date: todayIso() });
  write(list);
}

/**
 * Contagem por modo nos últimos `days` dias.
 * Retorna [{ modeId, count }] ordenado do maior para o menor.
 */
export function usageStats(days = 7) {
  const start = new Date();
  start.setDate(start.getDate() - (days - 1));
  const startIso = start.toISOString().slice(0, 10);

  const counts = {};
  for (const e of read()) {
    if (e.date >= startIso) counts[e.modeId] = (counts[e.modeId] || 0) + 1;
  }
  return Object.entries(counts)
    .map(([modeId, count]) => ({ modeId, count }))
    .sort((a, b) => b.count - a.count);
}
