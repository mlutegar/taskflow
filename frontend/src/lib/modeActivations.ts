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

interface ModeActivationEntry {
  modeId: string;
  date: string;
}

const KEY = "modeActivations";
const RETENTION_DAYS = 365;

function todayIso(): string {
  return new Date().toISOString().slice(0, 10);
}

function cutoff(): string {
  const d = new Date();
  d.setDate(d.getDate() - RETENTION_DAYS);
  return d.toISOString().slice(0, 10);
}

function load(): ModeActivationEntry[] {
  const entries = storageGet(KEY, []);
  // Limpa entradas antigas
  const limit = cutoff();
  return Array.isArray(entries) ? entries.filter((e: ModeActivationEntry) => e.date >= limit) : [];
}

function save(entries: ModeActivationEntry[]): void {
  storageSet(KEY, entries);
}

// ── Batch buffer ──────────────────────────────────────────────────────────────
// Acumula ativações e envia em lote a cada 30s (ou ao fechar a página).

const _buffer: ModeActivationEntry[] = [];
let _batchTimer: ReturnType<typeof setTimeout> | null = null;

function _flushBatch(): void {
  if (!_buffer.length) return;
  const batch = _buffer.splice(0);
  // Envia um por um mas via fila offline — se falhar, reenvia ao voltar online
  for (const { modeId, date } of batch) {
    withOfflineFallback("POST", "/preferences/mode-activations", { modeId, date });
  }
}

function _scheduleBatch(): void {
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
export function logActivation(modeId: string): void {
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
export async function loadRemoteModeActivations(): Promise<void> {
  try {
    const remote = await fetchModeActivations();
    if (!Array.isArray(remote) || remote.length === 0) return;

    const local = load();
    const localKeys = new Set(local.map((e: ModeActivationEntry) => `${e.modeId}|${e.date}`));
    const fresh = remote.filter((e: ModeActivationEntry) => !localKeys.has(`${e.modeId}|${e.date}`));
    if (fresh.length === 0) return;

    const merged = [...local, ...fresh];
    const limit = cutoff();
    save(merged.filter((e: ModeActivationEntry) => e.date >= limit));
  } catch {
    // falha silenciosa
  }
}

/**
 * Retorna o total histórico de ativações de um modo (últimos 365 dias).
 * @param {string} modeId
 * @returns {number}
 */
export function getActivationCount(modeId: string): number {
  return load().filter((e: ModeActivationEntry) => e.modeId === modeId).length;
}

/**
 * Retorna o número de ativações hoje de um modo.
 * @param {string} modeId
 * @returns {number}
 */
export function getActivationsToday(modeId: string): number {
  const today = todayIso();
  return load().filter((e: ModeActivationEntry) => e.modeId === modeId && e.date === today).length;
}

/**
 * Calcula o streak atual (dias consecutivos com pelo menos 1 ativação) de um modo.
 * @param {string} modeId
 * @returns {number} streak em dias (0 = sem streak)
 */
export function getActivityStreak(modeId: string): number {
  const entries = load().filter((e: ModeActivationEntry) => e.modeId === modeId);
  if (entries.length === 0) return 0;

  // Conjunto de datas únicas em que o modo foi ativado
  const datesSet = new Set(entries.map((e: ModeActivationEntry) => e.date));

  // Começa a contar do dia de hoje para trás
  let streak = 0;
  const today = new Date();
  for (let i = 0; i < 365; i++) {
    const d = new Date(today);
    d.setDate(d.getDate() - i);
    const iso = d.toISOString().slice(0, 10);
    if (datesSet.has(iso)) {
      streak++;
    } else if (i === 0) {
      // Hoje não foi usado — verifica ontem para manter streak de ontem
      continue;
    } else {
      break;
    }
  }
  // Se hoje não foi usado mas ontem sim, conta o streak a partir de ontem
  const todayIsoStr = today.toISOString().slice(0, 10);
  if (!datesSet.has(todayIsoStr)) {
    // streak já foi calculado ignorando hoje (i=0 faz continue)
  }
  return streak;
}

/**
 * Retorna todas as ativações agrupadas por modeId com contagem total.
 * @returns {{ modeId: string, count: number }[]}
 */
export function getAllActivations(): { modeId: string; count: number }[] {
  const entries = load();
  const counts: Record<string, number> = {};
  entries.forEach(({ modeId }: ModeActivationEntry) => {
    counts[modeId] = (counts[modeId] || 0) + 1;
  });
  return Object.entries(counts)
    .map(([modeId, count]) => ({ modeId, count }))
    .sort((a, b) => b.count - a.count);
}
