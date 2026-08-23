import { storageGet, storageAppend, storageSet } from "./storage";
import { saveCheckin, updateCheckinFeedback, fetchCheckins } from "../api/dailyFocusCheckins";

const LS_KEY = "checkinLog";
const MAX_ENTRIES = 200;

// Fix #11: usar data local para evitar bug de fuso horário
function localIsoDate(): string {
  const d = new Date();
  return [d.getFullYear(), String(d.getMonth() + 1).padStart(2, "0"), String(d.getDate()).padStart(2, "0")].join("-");
}

export function logCheckinUsage(estadoId: string, modeId: string): void {
  if (!estadoId || !modeId) return;
  const date = localIsoDate();
  const hour = new Date().getHours();
  storageAppend(LS_KEY, { estadoId, modeId, date, hour }, MAX_ENTRIES);
  // Sincroniza com Supabase (fire-and-forget)
  saveCheckin(estadoId, modeId, date, hour).catch(() => {});
}

const FEEDBACK_KEY = "checkinFeedback";
const MAX_FEEDBACK = 200;

export function logSessionFeedback(estadoId: string, modeId: string, rating: number): void {
  if (!estadoId && !modeId) return;
  const date = localIsoDate();
  storageAppend(FEEDBACK_KEY, { estadoId, modeId, rating, date }, MAX_FEEDBACK);
  // Sincroniza com Supabase (fire-and-forget)
  updateCheckinFeedback(estadoId, modeId, date, rating).catch(() => {});
}

export function getSessionFeedback(): unknown[] {
  return storageGet(FEEDBACK_KEY, []);
}

export function getCheckinLog(): unknown[] {
  return storageGet(LS_KEY, []);
}

/** Total de check-ins realizados (para conquista "Auto-conhecimento"). */
export function getCheckinCount(): number {
  return getCheckinLog().length;
}

/**
 * Retorna os modos mais usados para um dado estadoId,
 * ordenados por frequência decrescente.
 * Ex: getTopModesForEstado("cansado") → [{ modeId: "meditar", count: 5 }, ...]
 */
export function getTopModesForEstado(estadoId: string): { modeId: string; count: number }[] {
  const log = (getCheckinLog() as Array<{ estadoId: string; modeId: string; date: string; hour: number }>).filter((e) => e.estadoId === estadoId);
  const counts: Record<string, number> = {};
  for (const e of log) {
    counts[e.modeId] = (counts[e.modeId] || 0) + 1;
  }
  return Object.entries(counts)
    .map(([modeId, count]) => ({ modeId, count }))
    .sort((a, b) => b.count - a.count);
}

/** Dias consecutivos com pelo menos 1 check-in (incluindo hoje). */
export function getCheckinStreak(): number {
  const log = getCheckinLog() as Array<{ date: string }>;
  if (!log.length) return 0;
  const dates = [...new Set(log.map((e) => e.date))].sort().reverse();
  const today = localIsoDate();
  if (dates[0] !== today) return 0; // não usou hoje
  let streak = 1;
  for (let i = 1; i < dates.length; i++) {
    const prev = new Date(dates[i - 1]);
    const curr = new Date(dates[i]);
    const diff = (prev.getTime() - curr.getTime()) / (1000 * 60 * 60 * 24);
    if (diff === 1) streak++;
    else break;
  }
  return streak;
}

/**
 * Carrega check-ins e feedbacks do Supabase e mescla com localStorage.
 * Deduplicação por date+estadoId+hour para checkins e date+estadoId+modeId para feedbacks.
 * Deve ser chamado no boot do app após login.
 */
export async function loadRemoteCheckins(): Promise<void> {
  try {
    const { checkins: remote, feedbacks: remoteFeedbacks } = await fetchCheckins();

    // Mescla checkins
    if (remote.length) {
      const local = storageGet(LS_KEY, []) as Array<{ date: string; estadoId: string; hour: number }>;
      const seen = new Set(local.map((e) => `${e.date}|${e.estadoId}|${e.hour}`));
      const fresh = (remote as Array<{ date: string; estadoId: string; hour: number }>).filter((e) => !seen.has(`${e.date}|${e.estadoId}|${e.hour}`));
      if (fresh.length) {
        const merged = [...local, ...fresh].slice(-MAX_ENTRIES);
        storageSet(LS_KEY, merged);
      }
    }

    // Mescla feedbacks
    if (remoteFeedbacks.length) {
      const localFb = storageGet(FEEDBACK_KEY, []) as Array<{ date: string; estadoId: string; modeId: string }>;
      const seenFb = new Set(localFb.map((e) => `${e.date}|${e.estadoId}|${e.modeId}`));
      const freshFb = (remoteFeedbacks as Array<{ date: string; estadoId: string; modeId: string }>).filter((e) => !seenFb.has(`${e.date}|${e.estadoId}|${e.modeId}`));
      if (freshFb.length) {
        const mergedFb = [...localFb, ...freshFb].slice(-MAX_FEEDBACK);
        storageSet(FEEDBACK_KEY, mergedFb);
      }
    }
  } catch {
    // Falha silenciosa
  }
}
