import { todayISO, daysAgoISO } from "./dateUtils";
import { upsertContinuousActivity, type RemoteDayState } from "../api/dailyFocusDayState";

// Atividade Contínua do Daily Focus.
// Uma atividade de fundo (ex.: revisar flashcards no Anki) que NÃO tem timer,
// NÃO conta como tarefa da sequência e fica disponível o dia todo — ideal para
// aproveitar micro-momentos (pausas, transporte, celular).
//
// Persiste por DIA (reseta automaticamente quando a data muda), no mesmo espírito
// de dailyFocusDay.ts. Mantém também:
//  - a última configuração (para "repetir de ontem"), sem expirar;
//  - um histórico de dias com atividade/ticks (para o streak).
// Sincroniza com o backend (fire-and-forget) via day-state.

const LS_KEY      = "taskflow.dailyFocus.continuousActivity";
const LAST_KEY    = "taskflow.dailyFocus.continuousActivity.last";
const HISTORY_KEY = "taskflow.dailyFocus.continuousActivity.history";
const DONE_KEY    = "taskflow.dailyFocus.continuousActivity.done";

export interface ContinuousActivity {
  title: string;
  link: string;
  note: string;
  icon: string;
  goalTarget: number | null; // meta opcional (ex.: 20 cards)
  goalUnit: string;          // unidade da meta (ex.: "cards")
  ticks: number;             // vezes que abriu/avançou hoje
  progress: number;          // progresso manual em direção à meta
}

interface Stored extends ContinuousActivity {
  date: string;
}

interface HistoryEntry {
  date: string;
  ticks: number;
  completed?: number; // nº de atividades contínuas concluídas nesse dia
}

/** ISO do instante atual (usa new Date() — runtime do browser). */
function nowISO(): string {
  try { return new Date().toISOString(); } catch { return ""; }
}

export interface ContinuousPreset {
  id: string;
  icon: string;
  title: string;
  goalUnit: string;
  linkPlaceholder?: string;
}

// Presets rápidos oferecidos na fase select.
export const CONTINUOUS_PRESETS: ContinuousPreset[] = [
  { id: "anki",     icon: "🃏", title: "Revisar flashcards no Anki", goalUnit: "cards",    linkPlaceholder: "https://ankiweb.net/decks" },
  { id: "artigo",   icon: "📖", title: "Ler um artigo",             goalUnit: "artigos" },
  { id: "idioma",   icon: "🦉", title: "Praticar idioma",           goalUnit: "lições",   linkPlaceholder: "https://www.duolingo.com" },
  { id: "podcast",  icon: "🎧", title: "Ouvir um podcast",          goalUnit: "min" },
  { id: "livro",    icon: "📚", title: "Ler um livro",              goalUnit: "páginas" },
];

// ── helpers ──────────────────────────────────────────────
export function makeEmptyActivity(): ContinuousActivity {
  return { title: "", link: "", note: "", icon: "🔄", goalTarget: null, goalUnit: "", ticks: 0, progress: 0 };
}

function normalize(partial: Partial<ContinuousActivity> | null | undefined): ContinuousActivity {
  const base = makeEmptyActivity();
  if (!partial) return base;
  return {
    title: (partial.title ?? "").toString(),
    link: (partial.link ?? "").toString(),
    note: (partial.note ?? "").toString(),
    icon: partial.icon || "🔄",
    goalTarget: typeof partial.goalTarget === "number" && partial.goalTarget > 0 ? partial.goalTarget : null,
    goalUnit: (partial.goalUnit ?? "").toString(),
    ticks: typeof partial.ticks === "number" && partial.ticks >= 0 ? Math.floor(partial.ticks) : 0,
    progress: typeof partial.progress === "number" && partial.progress >= 0 ? Math.floor(partial.progress) : 0,
  };
}

function isEmpty(a: ContinuousActivity | null): boolean {
  return !a || (!a.title.trim() && !a.link.trim() && !a.note.trim());
}

// ── histórico / streak ───────────────────────────────────
function readHistory(): HistoryEntry[] {
  try {
    const raw = localStorage.getItem(HISTORY_KEY);
    const arr = raw ? JSON.parse(raw) : [];
    return Array.isArray(arr) ? arr : [];
  } catch {
    return [];
  }
}

function writeHistory(list: HistoryEntry[]): void {
  try {
    // mantém só os últimos 400 dias
    localStorage.setItem(HISTORY_KEY, JSON.stringify(list.slice(-400)));
  } catch {}
}

function touchHistory(ticks: number, completed?: number): void {
  const today = todayISO();
  const list = readHistory();
  const idx = list.findIndex((e) => e.date === today);
  const prevCompleted = idx >= 0 ? list[idx].completed : undefined;
  const entry: HistoryEntry = { date: today, ticks, completed: completed ?? prevCompleted };
  if (idx >= 0) list[idx] = entry;
  else list.push(entry);
  writeHistory(list);
}

/**
 * Dias consecutivos (terminando hoje ou ontem) com atividade contínua registrada.
 * Conta o dia se houver entrada no histórico (atividade definida) — ticks não são
 * obrigatórios para contar.
 */
export function getContinuousStreak(): number {
  const days = new Set(readHistory().map((e) => e.date));
  if (days.size === 0) return 0;
  // Começa hoje; se hoje ainda não tem, permite começar por ontem.
  let anchor = days.has(todayISO()) ? 0 : (days.has(daysAgoISO(1)) ? 1 : -1);
  if (anchor < 0) return 0;
  let streak = 0;
  while (days.has(daysAgoISO(anchor))) {
    streak++;
    anchor++;
  }
  return streak;
}

// ── leitura / escrita do dia ─────────────────────────────
/** Lê a atividade contínua de hoje, ou null se não houver / se o dia virou. */
export function getContinuousActivity(): ContinuousActivity | null {
  try {
    const raw = localStorage.getItem(LS_KEY);
    if (!raw) return null;
    const obj = JSON.parse(raw) as Stored;
    if (obj?.date !== todayISO()) return null; // dia virou — ignora
    const activity = normalize(obj);
    return isEmpty(activity) ? null : activity;
  } catch {
    return null;
  }
}

function persist(activity: ContinuousActivity): void {
  const stored: Stored = { ...activity, title: activity.title.trim(), link: activity.link.trim(), note: activity.note.trim(), date: todayISO() };
  try {
    localStorage.setItem(LS_KEY, JSON.stringify(stored));
    // "última configuração" (sem data de expiração) para repetir depois
    localStorage.setItem(LAST_KEY, JSON.stringify({ ...stored, ticks: 0, progress: 0 }));
  } catch {}
  touchHistory(activity.ticks);
  // Sincroniza com o backend (fire-and-forget)
  upsertContinuousActivity(stored).catch(() => {});
}

/** Grava (ou limpa, se vazia) a atividade contínua de hoje. Preserva ticks/progress atuais se não vierem no objeto. */
export function setContinuousActivity(input: Partial<ContinuousActivity>): void {
  const current = getContinuousActivity();
  const merged = normalize({
    ...current,
    ...input,
    // ticks/progress só mudam por funções próprias, a menos que explicitamente passados
    ticks: input.ticks ?? current?.ticks ?? 0,
    progress: input.progress ?? current?.progress ?? 0,
  });
  if (isEmpty(merged)) {
    clearContinuousActivity();
    return;
  }
  persist(merged);
}

/** Remove a atividade contínua de hoje (mantém histórico e "última config"). */
export function clearContinuousActivity(): void {
  try {
    localStorage.removeItem(LS_KEY);
  } catch {}
  upsertContinuousActivity(null).catch(() => {});
}

// ── conclusões do dia ────────────────────────────────────
export interface CompletedEntry {
  title: string;
  icon: string;
  link: string;
  ticks: number;
  progress: number;
  goalTarget: number | null;
  goalUnit: string;
  completedAt: string; // ISO — para heatmap/quando concluiu
}

interface DoneStored {
  date: string;
  items: CompletedEntry[];
}

function normalizeCompleted(raw: unknown): CompletedEntry | null {
  if (!raw || typeof raw !== "object") return null;
  const o = raw as Record<string, unknown>;
  const title = (o.title ?? "").toString();
  if (!title.trim()) return null;
  return {
    title,
    icon: (o.icon as string) || "🔄",
    link: (o.link ?? "").toString(),
    ticks: typeof o.ticks === "number" && o.ticks >= 0 ? Math.floor(o.ticks) : 0,
    progress: typeof o.progress === "number" && o.progress >= 0 ? Math.floor(o.progress) : 0,
    goalTarget: typeof o.goalTarget === "number" && o.goalTarget > 0 ? o.goalTarget : null,
    goalUnit: (o.goalUnit ?? "").toString(),
    completedAt: (o.completedAt ?? "").toString(),
  };
}

/** Lê a lista de atividades contínuas concluídas hoje (reseta quando o dia vira). */
export function getCompletedToday(): CompletedEntry[] {
  try {
    const raw = localStorage.getItem(DONE_KEY);
    if (!raw) return [];
    const obj = JSON.parse(raw) as DoneStored;
    if (obj?.date !== todayISO()) return []; // dia virou
    return Array.isArray(obj.items) ? obj.items.map(normalizeCompleted).filter((e): e is CompletedEntry => e !== null) : [];
  } catch {
    return [];
  }
}

/** Quantas atividades contínuas foram concluídas hoje. */
export function getCompletedCountToday(): number {
  return getCompletedToday().length;
}

function writeCompleted(items: CompletedEntry[]): void {
  try {
    localStorage.setItem(DONE_KEY, JSON.stringify({ date: todayISO(), items } as DoneStored));
  } catch {}
  // Sincroniza o log do dia com o backend (fire-and-forget).
  import("../api/dailyFocusDayState")
    .then(({ upsertContinuousCompleted }) => upsertContinuousCompleted(items))
    .catch(() => {});
}

/**
 * Marca a atividade contínua atual como concluída: registra no log do dia
 * (mantendo o streak, com contagem de conclusões) e limpa a atividade atual
 * para dar lugar a outra. No-op se não houver atividade definida.
 */
export function completeContinuousActivity(): CompletedEntry | null {
  const current = getContinuousActivity();
  if (!current) return null;
  const entry: CompletedEntry = {
    title: current.title,
    icon: current.icon,
    link: current.link,
    ticks: current.ticks,
    progress: current.progress,
    goalTarget: current.goalTarget,
    goalUnit: current.goalUnit,
    completedAt: nowISO(),
  };
  const items = getCompletedToday();
  items.push(entry);
  writeCompleted(items);
  // garante que o dia continue contando no streak (com nº de conclusões)
  touchHistory(current.ticks, items.length);
  clearContinuousActivity();
  return entry;
}

/**
 * Desfaz a última conclusão do dia: remove-a do log e restaura como atividade
 * atual (preservando ticks/progress). Retorna a entrada restaurada, ou null.
 */
export function uncompleteLast(): CompletedEntry | null {
  const items = getCompletedToday();
  const last = items.pop();
  if (!last) return null;
  writeCompleted(items);
  touchHistory(last.ticks, items.length);
  setContinuousActivity({
    title: last.title,
    link: last.link,
    icon: last.icon,
    goalTarget: last.goalTarget,
    goalUnit: last.goalUnit,
    ticks: last.ticks,
    progress: last.progress,
  });
  return last;
}

/**
 * Troca a atividade contínua de hoje por uma nova: limpa a atual e grava a nova,
 * zerando ticks/progress. Mantém a lógica de "última configuração" (LAST_KEY).
 * Se o objeto novo for vazio, apenas limpa.
 */
export function replaceContinuousActivity(next: Partial<ContinuousActivity>): void {
  clearContinuousActivity();
  setContinuousActivity({ ...next, ticks: 0, progress: 0 });
}

/** Registra que a atividade foi acessada/avançada (incrementa ticks). No-op se não houver atividade. */
export function registerTick(): ContinuousActivity | null {
  const current = getContinuousActivity();
  if (!current) return null;
  const updated = { ...current, ticks: current.ticks + 1 };
  persist(updated);
  return updated;
}

/** Ajusta o progresso manual em direção à meta (delta pode ser negativo). */
export function addProgress(delta: number): ContinuousActivity | null {
  const current = getContinuousActivity();
  if (!current) return null;
  const updated = { ...current, progress: Math.max(0, current.progress + delta) };
  persist(updated);
  return updated;
}

/** Última configuração usada (para "repetir de ontem"), ou null. Sempre com ticks/progress zerados. */
export function getLastActivity(): ContinuousActivity | null {
  try {
    const raw = localStorage.getItem(LAST_KEY);
    if (!raw) return null;
    const activity = normalize(JSON.parse(raw));
    return isEmpty(activity) ? null : { ...activity, ticks: 0, progress: 0 };
  } catch {
    return null;
  }
}

/**
 * Carrega a atividade contínua de hoje do backend e mescla com localStorage.
 * Se o remoto for de hoje e o local estiver vazio, adota o remoto.
 * Chamado no boot (useRemoteSync).
 */
export async function loadRemoteContinuousActivity(): Promise<void> {
  try {
    const { fetchTodayState } = await import("../api/dailyFocusDayState");
    const remote = (await fetchTodayState()) as RemoteDayState | null;
    if (!remote || remote.date !== todayISO()) return;

    // 1) Atividade atual — adota o remoto quando o local está vazio ou tem menos ticks.
    if (remote.continuousActivity) {
      const local = getContinuousActivity();
      const remoteActivity = normalize(remote.continuousActivity);
      if (!isEmpty(remoteActivity) && (!local || remoteActivity.ticks > local.ticks)) {
        const stored: Stored = { ...remoteActivity, date: todayISO() };
        try {
          localStorage.setItem(LS_KEY, JSON.stringify(stored));
          localStorage.setItem(LAST_KEY, JSON.stringify({ ...stored, ticks: 0, progress: 0 }));
        } catch {}
        touchHistory(remoteActivity.ticks);
      }
    }

    // 2) Log de concluídas — adota o remoto quando tiver mais itens que o local.
    if (Array.isArray(remote.continuousCompleted)) {
      const remoteDone = remote.continuousCompleted
        .map(normalizeCompleted)
        .filter((e): e is CompletedEntry => e !== null);
      const localDone = getCompletedToday();
      if (remoteDone.length > localDone.length) {
        try {
          localStorage.setItem(DONE_KEY, JSON.stringify({ date: todayISO(), items: remoteDone } as DoneStored));
        } catch {}
        touchHistory(getContinuousActivity()?.ticks ?? 0, remoteDone.length);
      }
    }
  } catch {
    // falha silenciosa
  }
}
