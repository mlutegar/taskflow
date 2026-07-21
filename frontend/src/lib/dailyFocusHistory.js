const LS_KEY = "daily_focus_history";
const MAX_ENTRIES = 100;

/**
 * @typedef {{ date: string, level: number, tasks: string[], timings: {used:number,total:number}[], completedAt: string, rushMode: boolean }} HistoryEntry
 */

export function getHistory() {
  try {
    const raw = localStorage.getItem(LS_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

export function addSession(entry) {
  const history = getHistory();
  const updated = [entry, ...history].slice(0, MAX_ENTRIES);
  try {
    localStorage.setItem(LS_KEY, JSON.stringify(updated));
  } catch {}
  return updated;
}

export function getMaxLevel() {
  try {
    return parseInt(localStorage.getItem("daily_focus_max_level") || "0", 10);
  } catch {
    return 0;
  }
}

export function updateMaxLevel(level) {
  const current = getMaxLevel();
  if (level > current) {
    try {
      localStorage.setItem("daily_focus_max_level", String(level));
    } catch {}
    return true; // new record
  }
  return false;
}

export function getTotalSessions() {
  return getHistory().length;
}

function parsePtBR(str) {
  const [d, m, y] = (str || "").split("/");
  return new Date(Number(y), Number(m) - 1, Number(d));
}

/** Número de dias consecutivos com pelo menos uma sessão (contando hoje). */
export function getStreak() {
  const history = getHistory();
  if (!history.length) return 0;

  const todayPtBR = new Date().toLocaleDateString("pt-BR");
  const uniqueDates = [...new Set(history.map((e) => e.date))];

  if (!uniqueDates.includes(todayPtBR)) return 0;

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
export function getStats() {
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
export function getMaxLevelByMode(isRush) {
  const key = isRush ? "daily_focus_max_level_rush" : "daily_focus_max_level_timer";
  try { return parseInt(localStorage.getItem(key) || "0", 10); } catch { return 0; }
}

export function updateMaxLevelByMode(level, isRush) {
  const current = getMaxLevelByMode(isRush);
  if (level > current) {
    const key = isRush ? "daily_focus_max_level_rush" : "daily_focus_max_level_timer";
    try { localStorage.setItem(key, String(level)); } catch {}
    return true;
  }
  return false;
}

/** Retorna mapa { nivel: "DD/MM/YYYY" } com a data mais recente de cada nível concluído. */
export function getLastDateByLevel() {
  const map = {};
  // iterar do mais antigo para o mais novo → o mais novo sobrescreve
  [...getHistory()].reverse().forEach((entry) => {
    map[entry.level] = entry.date;
  });
  return map;
}

/** Últimos 7 dias com contagem de sessões e nível máximo atingido em cada dia. */
export function getWeeklyStats() {
  const history = getHistory();
  const today = new Date();
  const result = [];
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
