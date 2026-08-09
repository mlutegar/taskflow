/**
 * Tracking de ativações de modos.
 * Uma "ativação" é contada quando o usuário abre uma sessão de modo.
 * Também registrada quando o Modo Música atinge contagem = 100 ou ao trocar de modo.
 *
 * Estrutura no localStorage ("taskflow.modeActivations"):
 * [{ modeId: string, date: "YYYY-MM-DD" }, ...]
 *
 * Retenção: 365 dias.
 */

import { storageGet, storageSet } from "./storage";
import { fetchModeActivations } from "../api/preferences";
import { withOfflineFallback } from "./syncQueue";

const KEY = "modeActivations";
const RETENTION_DAYS = 365;

function todayIso() {
  return new Date().toISOString().slice(0, 10);
}

function cutoff() {
  const d = new Date();
  d.setDate(d.getDate() - RETENTION_DAYS);
  return d.toISOString().slice(0, 10);
}

function load() {
  const entries = storageGet(KEY, []);
  // Limpa entradas antigas
  const limit = cutoff();
  return Array.isArray(entries) ? entries.filter((e) => e.date >= limit) : [];
}

function save(entries) {
  storageSet(KEY, entries);
}

// ── Batch buffer ──────────────────────────────────────────────────────────────
// Acumula ativações e envia em lote a cada 30s (ou ao fechar a página).

const _buffer = [];
let _batchTimer = null;

function _flushBatch() {
  if (!_buffer.length) return;
  const batch = _buffer.splice(0);
  // Envia um por um mas via fila offline — se falhar, reenvia ao voltar online
  for (const { modeId, date } of batch) {
    withOfflineFallback("POST", "/preferences/mode-activations", { modeId, date });
  }
}

function _scheduleBatch() {
  if (_batchTimer) return;
  _batchTimer = setTimeout(() => {
    _batchTimer = null;
    _flushBatch();
  }, 30_000);
}

if (typeof window !== "undefined") {
  window.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "hidden") _flushBatch();
  });
  window.addEventListener("pagehide", _flushBatch);
}

/**
 * Registra uma ativação do modo.
 * @param {string} modeId
 */
export function logActivation(modeId) {
  if (!modeId) return;
  const today = todayIso();
  const entries = load();
  entries.push({ modeId, date: today });
  save(entries);
  // Acumula no buffer e envia em lote a cada 30s
  _buffer.push({ modeId, date: today });
  _scheduleBatch();
}

/**
 * Carrega ativações do backend e mescla com localStorage.
 * Deve ser chamado no boot após autenticação.
 */
export async function loadRemoteModeActivations() {
  try {
    const remote = await fetchModeActivations();
    if (!Array.isArray(remote) || remote.length === 0) return;

    const local = load();
    const localKeys = new Set(local.map((e) => `${e.modeId}|${e.date}`));
    const fresh = remote.filter((e) => !localKeys.has(`${e.modeId}|${e.date}`));
    if (fresh.length === 0) return;

    const merged = [...local, ...fresh];
    const limit = cutoff();
    save(merged.filter((e) => e.date >= limit));
  } catch {
    // falha silenciosa
  }
}

/**
 * Retorna o total histórico de ativações de um modo (últimos 365 dias).
 * @param {string} modeId
 * @returns {number}
 */
export function getActivationCount(modeId) {
  return load().filter((e) => e.modeId === modeId).length;
}

/**
 * Retorna o número de ativações hoje de um modo.
 * @param {string} modeId
 * @returns {number}
 */
export function getActivationsToday(modeId) {
  const today = todayIso();
  return load().filter((e) => e.modeId === modeId && e.date === today).length;
}

/**
 * Retorna todas as ativações agrupadas por modeId com contagem total.
 * @returns {{ modeId: string, count: number }[]}
 */
export function getAllActivations() {
  const entries = load();
  const counts = {};
  entries.forEach(({ modeId }) => {
    counts[modeId] = (counts[modeId] || 0) + 1;
  });
  return Object.entries(counts)
    .map(([modeId, count]) => ({ modeId, count }))
    .sort((a, b) => b.count - a.count);
}
