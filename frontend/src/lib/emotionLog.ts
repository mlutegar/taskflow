import { storageGet, storageAppend, storageSet } from "./storage";
import { saveEmotion, fetchEmotions } from "../api/dailyFocusEmotions";
import type { SessionEmotion, EmotionMoment } from "../types";

const LS_KEY = "emotionLog";
const LAST_KEY = "emotionLastId";     // última emoção escolhida (memória do modal)
const MAX_ENTRIES = 500;

export type { EmotionMoment };
export type EmotionEntry = SessionEmotion;

function localIsoDate(): string {
  const d = new Date();
  return [d.getFullYear(), String(d.getMonth() + 1).padStart(2, "0"), String(d.getDate()).padStart(2, "0")].join("-");
}

export interface LogEmotionInput {
  emotion: string;
  moment: EmotionMoment;                 // "start" | "resume" | "end"
  intensity?: "leve" | "forte";
  taskTitle?: string;
  taskIndex?: number;
  taskId?: string | null;
  modeIds?: string[];
  level?: number;
  rushMode?: boolean;
  tabMode?: boolean;
  pauseSecs?: number;                    // duração da pausa anterior (resume)
  completed?: boolean;                   // tarefa foi concluída (end)
  usedSecs?: number;                     // tempo usado na tarefa (end)
  totalSecs?: number;                    // duração planejada da tarefa (end)
}

/**
 * Registra um checkpoint emocional. Leve, opcional e não bloqueante.
 * Persiste localmente e sincroniza com o backend (fire-and-forget).
 */
export function logEmotion(input: LogEmotionInput): void {
  if (!input.emotion) return;
  const date = localIsoDate();
  const now = new Date();
  const entry: EmotionEntry = {
    emotion: input.emotion,
    moment: input.moment,
    intensity: input.intensity,
    date,
    hour: now.getHours(),
    timestamp: now.toISOString(),
    taskTitle: input.taskTitle,
    taskIndex: input.taskIndex,
    taskId: input.taskId ?? undefined,
    modeIds: input.modeIds,
    level: input.level,
    rushMode: input.rushMode,
    tabMode: input.tabMode,
    pauseSecs: input.pauseSecs,
    completed: input.completed,
    usedSecs: input.usedSecs,
    totalSecs: input.totalSecs,
  };
  storageAppend(LS_KEY, entry, MAX_ENTRIES);
  storageSet(LAST_KEY, input.emotion);
  saveEmotion(entry).catch(() => {});
}

export function getEmotionLog(): EmotionEntry[] {
  return storageGet<EmotionEntry[]>(LS_KEY, []);
}

/** Última emoção registrada (para memória/realce no modal). */
export function getLastEmotionId(): string | null {
  return storageGet<string | null>(LAST_KEY, null);
}

/** Registros de hoje. */
export function getTodayEmotions(): EmotionEntry[] {
  const today = localIsoDate();
  return getEmotionLog().filter((e) => e.date === today);
}

/**
 * Contagem de emoções por hora do dia (0-23) para o heatmap.
 * Ex.: { 9: { focado: 2, ansioso: 1 }, 14: { cansado: 1 } }
 */
export function getEmotionsByHour(entries?: EmotionEntry[]): Record<number, Record<string, number>> {
  const log = entries ?? getEmotionLog();
  const map: Record<number, Record<string, number>> = {};
  for (const e of log) {
    const h = e.hour ?? 0;
    if (!map[h]) map[h] = {};
    map[h][e.emotion] = (map[h][e.emotion] || 0) + 1;
  }
  return map;
}

/** Contagem total por emoção (opcionalmente filtrada por momento). */
export function getEmotionCounts(moment?: EmotionMoment, entries?: EmotionEntry[]): Record<string, number> {
  const log = (entries ?? getEmotionLog()).filter((e) => !moment || e.moment === moment);
  const counts: Record<string, number> = {};
  for (const e of log) counts[e.emotion] = (counts[e.emotion] || 0) + 1;
  return counts;
}

/** Total de check-ins emocionais (para conquista). */
export function getEmotionCount(): number {
  return getEmotionLog().length;
}

/**
 * Carrega emoções do backend e mescla com localStorage.
 * Deduplicação por timestamp+emotion+moment. Chamado no boot após login.
 */
export async function loadRemoteEmotions(): Promise<void> {
  try {
    const { emotions: remote } = await fetchEmotions();
    if (!remote?.length) return;
    const local = getEmotionLog();
    const key = (e: EmotionEntry) => `${e.timestamp}|${e.emotion}|${e.moment}`;
    const seen = new Set(local.map(key));
    const fresh = (remote as EmotionEntry[]).filter((e) => !seen.has(key(e)));
    if (fresh.length) {
      const merged = [...local, ...fresh].slice(-MAX_ENTRIES);
      storageSet(LS_KEY, merged);
    }
  } catch {
    // falha silenciosa
  }
}
