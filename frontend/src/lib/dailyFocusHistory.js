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
