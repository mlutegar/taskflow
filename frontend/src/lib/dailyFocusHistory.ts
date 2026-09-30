import { saveSession, fetchSessions } from "../api/dailyFocusSessions";
import { parsePtBR, todayPtBR } from "./dateUtils";

const LS_KEY = "daily_focus_history";
// Cache local de sessões. É apenas um write-through cache: a fonte de verdade é
// o backend (GET /daily-focus/sessions, paginado e sem cutoff). O limite existe
// só para não estourar a cota do localStorage — mantido alto para não descartar
// histórico (nem sessões ainda não sincronizadas) antes do flush ao backend.
const MAX_ENTRIES = 1000;

export interface HistoryEntry {
  date: string;
  level: number;
  tasks: string[];
  timings: { used: number; total: number }[];
  completedAt: string;
  rushMode: boolean;
  tabMode?: boolean;
  cycleCount?: number;
  estadoId?: string | null;
  tabsOpened?: number;
  /** UUID gerado no cliente → idempotência no backend (upsert por userId+clientId). */
  clientId?: string;
  /** false/undefined = ainda não confirmada no backend (fica na fila de reenvio). */
  synced?: boolean;
  /** nº de tentativas de reenvio já feitas (para backoff exponencial). */
  retryCount?: number;
  /** timestamp (ms) antes do qual não se deve tentar reenviar. */
  nextRetryAt?: number;
  /** true = falha definitiva (4xx de validação); não reenviar automaticamente. */
  failedPermanent?: boolean;
}

// Backoff exponencial: 30s, 60s, 120s… até o teto de 1h.
const RETRY_BASE_MS = 30_000;
const RETRY_MAX_MS = 60 * 60_000;

function backoffMs(retryCount: number): number {
  return Math.min(RETRY_MAX_MS, RETRY_BASE_MS * 2 ** Math.max(0, retryCount));
}

/** Gera um UUID (fallback simples quando crypto.randomUUID não existe). */
function genClientId(): string {
  try {
    if (typeof crypto !== "undefined" && crypto.randomUUID) return crypto.randomUUID();
  } catch {}
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

/** Chave de deduplicação estável por entrada (clientId quando existir; senão date+hora). */
function entryKey(e: { clientId?: string; date: string; completedAt?: string }): string {
  return e.clientId ? `cid:${e.clientId}` : `dk:${e.date}|${e.completedAt || ""}`;
}

/** Payload enviado ao backend (sem metadados locais de sincronização). */
function toPayload(e: HistoryEntry): Record<string, unknown> {
  const { synced, retryCount, nextRetryAt, failedPermanent, ...rest } = e;
  void synced; void retryCount; void nextRetryAt; void failedPermanent;
  return rest;
}

export interface Stats {
  totalSessions: number;
  totalTasks: number;
  avgLevel: number;
  maxLevel: number;
  streak: number;
  rushCount: number;
}

export interface WeeklyStatEntry {
  dateStr: string;
  count: number;
  maxLevel: number;
  dayOfWeek: number;
}

export function getHistory(): HistoryEntry[] {
  try {
    const raw = localStorage.getItem(LS_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

/** Apaga o histórico local de sessões (todo, ou só os últimos N dias). */
export function clearSessionHistory(scope: { days?: number } = {}): void {
  try {
    if (!scope.days) {
      localStorage.removeItem(LS_KEY);
      return;
    }
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - scope.days);
    const cutoffStr = [cutoff.getFullYear(), String(cutoff.getMonth() + 1).padStart(2, "0"), String(cutoff.getDate()).padStart(2, "0")].join("-");
    // date das sessões pode estar em DD/MM/YYYY (formato pt-BR); normaliza p/ ISO na comparação.
    const toIso = (d: string): string => {
      if (/^\d{4}-\d{2}-\d{2}/.test(d)) return d.slice(0, 10);
      const m = d.match(/^(\d{2})\/(\d{2})\/(\d{4})/);
      return m ? `${m[3]}-${m[2]}-${m[1]}` : d;
    };
    const kept = getHistory().filter((e) => toIso(e.date) < cutoffStr);
    localStorage.setItem(LS_KEY, JSON.stringify(kept));
  } catch {
    // silently fail
  }
}

/** Aplica um patch à entrada identificada por `key`, persistindo o resultado. */
function patchEntry(key: string, patch: Partial<HistoryEntry>): void {
  const history = getHistory();
  let changed = false;
  const updated = history.map((e) => {
    if (entryKey(e) === key) {
      changed = true;
      return { ...e, ...patch };
    }
    return e;
  });
  if (changed) {
    try {
      localStorage.setItem(LS_KEY, JSON.stringify(updated));
    } catch {}
  }
}

function markSynced(key: string): void {
  patchEntry(key, { synced: true, nextRetryAt: undefined, failedPermanent: false });
}

function recordFailure(key: string, permanent: boolean): void {
  const entry = getHistory().find((e) => entryKey(e) === key);
  const retryCount = (entry?.retryCount ?? 0) + 1;
  patchEntry(key, permanent
    ? { failedPermanent: true, retryCount }
    : { retryCount, nextRetryAt: Date.now() + backoffMs(retryCount) });
}

/** Nº de sessões ainda não sincronizadas (exclui falhas definitivas). */
export function getPendingCount(): number {
  return getHistory().filter((e) => e.synced !== true && !e.failedPermanent).length;
}

export function addSession(entry: HistoryEntry): HistoryEntry[] {
  const history = getHistory();
  const local: HistoryEntry = { ...entry, clientId: entry.clientId ?? genClientId(), synced: false, retryCount: 0 };
  const updated = [local, ...history].slice(0, MAX_ENTRIES);
  try {
    localStorage.setItem(LS_KEY, JSON.stringify(updated));
  } catch {}
  // Sincroniza com o backend; sucesso → synced; falha → fica na fila (backoff).
  const key = entryKey(local);
  saveSession(toPayload(local))
    .then((res) => { if (res.ok) markSynced(key); else recordFailure(key, res.permanent); })
    .catch(() => recordFailure(key, false));
  return updated;
}

// Guard de concorrência: boot, evento "online", visibilitychange e o intervalo
// periódico podem disparar juntos; sem isso reprocessariam a mesma entrada.
let flushing = false;

/**
 * Reenvia ao backend as sessões pendentes cujo backoff já expirou.
 * Chamada no boot (antes de loadRemoteSessions), ao ficar online, ao voltar o
 * foco (visibilitychange) e periodicamente.
 * @param force ignora backoff e reativa falhas definitivas (botão "Tentar agora").
 */
export async function flushUnsyncedSessions(force = false): Promise<void> {
  if (flushing) return;
  flushing = true;
  try {
    const now = Date.now();
    const pending = getHistory().filter((e) => {
      if (e.synced === true) return false;
      if (!force && e.failedPermanent) return false;
      if (!force && e.nextRetryAt && e.nextRetryAt > now) return false;
      return true;
    });
    for (const entry of pending) {
      const key = entryKey(entry);
      try {
        const res = await saveSession(toPayload(entry));
        if (res.ok) markSynced(key);
        else recordFailure(key, res.permanent && !force);
      } catch {
        recordFailure(key, false);
      }
    }
  } finally {
    flushing = false;
  }
}

/** Força um reenvio imediato de tudo que está pendente (inclui falhas definitivas). */
export function retrySessionsNow(): Promise<void> {
  return flushUnsyncedSessions(true);
}

/**
 * Carrega sessões do Supabase e mescla com localStorage.
 * Deduplicação por date + completedAt.
 * Deve ser chamado no boot do app após login.
 */
export async function loadRemoteSessions(): Promise<void> {
  try {
    const remote: HistoryEntry[] = await fetchSessions();
    if (!remote.length) return;

    const local = getHistory();
    const remoteKeys = new Set(remote.map(entryKey));
    const localKeys = new Set(local.map(entryKey));

    // Entradas locais pendentes que já existem no backend (ex.: POST cuja
    // resposta se perdeu) são reconciliadas como sincronizadas.
    const reconciled = local.map((e) =>
      e.synced !== true && remoteKeys.has(entryKey(e)) ? { ...e, synced: true } : e
    );

    // Entradas vindas do backend que ainda não temos localmente.
    const fresh = remote
      .filter((e) => !localKeys.has(entryKey(e)))
      .map((e) => ({ ...e, synced: true }));

    const merged = [...fresh, ...reconciled].slice(0, MAX_ENTRIES);
    // Re-ordena do mais recente para o mais antigo
    merged.sort((a, b) => parsePtBR(b.date) - parsePtBR(a.date));
    try {
      localStorage.setItem(LS_KEY, JSON.stringify(merged));
    } catch {}

    // Atualiza recordes baseado nos dados remotos
    for (const s of remote) {
      updateMaxLevel(s.level);
      updateMaxLevelByMode(s.level, s.rushMode);
      if (s.tabMode && s.cycleCount) updateMaxCycles(s.cycleCount);
    }
  } catch {
    // Falha silenciosa — não bloqueia o app
  }
}

export function getMaxLevel(): number {
  try {
    return parseInt(localStorage.getItem("daily_focus_max_level") || "0", 10);
  } catch {
    return 0;
  }
}

export function updateMaxLevel(level: number): boolean {
  const current = getMaxLevel();
  if (level > current) {
    try {
      localStorage.setItem("daily_focus_max_level", String(level));
    } catch {}
    return true; // new record
  }
  return false;
}

export function getTotalSessions(): number {
  return getHistory().length;
}

/** Número de dias consecutivos com pelo menos uma sessão (contando hoje). */
export function getStreak(): number {
  const history = getHistory();
  if (!history.length) return 0;

  const todayPtBRStr = todayPtBR();
  const uniqueDates = [...new Set(history.map((e) => e.date))];

  if (!uniqueDates.includes(todayPtBRStr)) return 0;

  const sorted = uniqueDates.sort((a, b) => parsePtBR(b) - parsePtBR(a));

  let streak = 1;
  for (let i = 1; i < sorted.length; i++) {
    const curr = parsePtBR(sorted[i - 1]);
    const prev = parsePtBR(sorted[i]);
    const diffDays = Math.round((curr - prev) / 86400000);
    if (diffDays === 1) streak++;
    else break;
  }
  return streak;
}

/** Estatísticas gerais das sessões. */
export function getStats(): Stats | null {
  const history = getHistory();
  if (!history.length) return null;

  const totalSessions = history.length;
  const totalTasks = history.reduce((s, e) => s + e.tasks.length, 0);
  const avgLevel = Math.round((history.reduce((s, e) => s + e.level, 0) / totalSessions) * 10) / 10;
  const streak = getStreak();
  const maxLvl = getMaxLevel();
  const rushCount = history.filter((e) => e.rushMode).length;

  return { totalSessions, totalTasks, avgLevel, maxLevel: maxLvl, streak, rushCount };
}

/** Recorde máximo separado por modo (timer vs rush). */
export function getMaxLevelByMode(isRush: boolean): number {
  const key = isRush ? "daily_focus_max_level_rush" : "daily_focus_max_level_timer";
  try { return parseInt(localStorage.getItem(key) || "0", 10); } catch { return 0; }
}

export function updateMaxLevelByMode(level: number, isRush: boolean): boolean {
  const current = getMaxLevelByMode(isRush);
  if (level > current) {
    const key = isRush ? "daily_focus_max_level_rush" : "daily_focus_max_level_timer";
    try { localStorage.setItem(key, String(level)); } catch {}
    return true;
  }
  return false;
}

/** Recorde de ciclos no Modo Abas. */
export function getMaxCycles(): number {
  try { return parseInt(localStorage.getItem("daily_focus_max_cycles") || "0", 10); } catch { return 0; }
}

export function updateMaxCycles(cycles: number): boolean {
  const current = getMaxCycles();
  if (cycles > current) {
    try { localStorage.setItem("daily_focus_max_cycles", String(cycles)); } catch {}
    return true;
  }
  return false;
}

/** Retorna mapa { nivel: "DD/MM/YYYY" } com a data mais recente de cada nível concluído. */
export function getLastDateByLevel(): Record<number, string> {
  const map: Record<number, string> = {};
  // iterar do mais antigo para o mais novo → o mais novo sobrescreve
  [...getHistory()].reverse().forEach((entry) => {
    map[entry.level] = entry.date;
  });
  return map;
}

/** Últimos 7 dias com contagem de sessões e nível máximo atingido em cada dia. */
export function getWeeklyStats(): WeeklyStatEntry[] {
  const history = getHistory();
  const today = new Date();
  const result: WeeklyStatEntry[] = [];
  for (let i = 6; i >= 0; i--) {
    const d = new Date(today);
    d.setDate(today.getDate() - i);
    const dateStr = d.toLocaleDateString("pt-BR");
    const sessions = history.filter((e) => e.date === dateStr);
    const maxLvl = sessions.length ? Math.max(...sessions.map((e) => e.level)) : 0;
    result.push({
      dateStr,
      count: sessions.length,
      maxLevel: maxLvl,
      dayOfWeek: d.getDay(), // 0=dom, 6=sab
    });
  }
  return result;
}
