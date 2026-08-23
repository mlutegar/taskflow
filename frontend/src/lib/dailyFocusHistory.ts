import { saveSession, fetchSessions } from "../api/dailyFocusSessions";
import { parsePtBR, todayPtBR } from "./dateUtils";

const LS_KEY = "daily_focus_history";
const MAX_ENTRIES = 100;

export interface HistoryEntry {
  date: string;
  level: number;
  tasks: string[];
  timings: { used: number; total: number }[];
  completedAt: string;
  rushMode: boolean;
  tabMode?: boolean;
  cycleCount?: number;
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

export function addSession(entry: HistoryEntry): HistoryEntry[] {
  const history = getHistory();
  const updated = [entry, ...history].slice(0, MAX_ENTRIES);
  try {
    localStorage.setItem(LS_KEY, JSON.stringify(updated));
  } catch {}
  // Sincroniza com Supabase (fire-and-forget)
  saveSession(entry).catch(() => {});
  return updated;
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
    const seen = new Set(local.map((e) => `${e.date}|${e.completedAt || ""}`));
    const fresh = remote.filter((e) => !seen.has(`${e.date}|${e.completedAt || ""}`));
    if (!fresh.length) return;

    const merged = [...fresh, ...local].slice(0, MAX_ENTRIES);
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
