// Log de conclusões por modo (para "mais usados na semana").
// Guarda { modeId, date: "YYYY-MM-DD" } e retém ~90 dias.
// Padrão offline-first: localStorage + sync backend (fire-and-forget).

import { storageGet, storageSet } from "./storage";

const LS_KEY = "modeLog";
const RETAIN_DAYS = 90;

function todayIso() {
  const d = new Date();
  return [d.getFullYear(), String(d.getMonth() + 1).padStart(2, "0"), String(d.getDate()).padStart(2, "0")].join("-");
}

function read() {
  const list = storageGet(LS_KEY, []);
  return Array.isArray(list) ? list : [];
}

function write(list) {
  storageSet(LS_KEY, list);
}

/** Registra uma conclusão de tarefa no modo informado. */
export function logCompletion(modeId) {
  if (!modeId) return;
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - RETAIN_DAYS);
  const cutoffIso = cutoff.toISOString().slice(0, 10);
  const date = todayIso();

  const list = read().filter((e) => e.date >= cutoffIso);
  list.push({ modeId, date });
  write(list);

  // Sync com backend (fire-and-forget com retry offline)
  import("./syncQueue").then(({ withOfflineFallback }) => {
    withOfflineFallback("POST", "/mode-log", { modeId, date });
  });
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

/** Retorna todos os registros salvos (cronológico decrescente). */
export function getAllLogs() {
  return [...read()].sort((a, b) => (a.date < b.date ? 1 : -1));
}

/**
 * Carrega registros do backend e mescla com localStorage.
 * Deduplicação por modeId + date.
 * Deve ser chamado no boot do app após login.
 */
export async function loadRemoteModeLog() {
  try {
    const { fetchModeLogs } = await import("../api/modeLog");
    const remote = await fetchModeLogs();
    if (!remote || !remote.length) return;

    const local = read();
    const seen = new Set(local.map((e) => `${e.modeId}|${e.date}`));
    const fresh = remote.filter((e) => !seen.has(`${e.modeId}|${e.date}`));
    if (!fresh.length) return;

    // Mantém retenção de 90 dias
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - RETAIN_DAYS);
    const cutoffIso = cutoff.toISOString().slice(0, 10);

    const merged = [...local, ...fresh].filter((e) => e.date >= cutoffIso);
    write(merged);
  } catch {
    // Falha silenciosa — app funciona com dados locais
  }
}
