/**
 * Catálogo de emoções para o checkpoint emocional do Daily Focus.
 * Usado pelo modal que aparece a cada início/retomada/fim do timer.
 * Registro leve e opcional — não interpreta nem recomenda nada.
 *
 * Suporta override via localStorage (chave: taskflow.emotionsCustom) para
 * permitir que o usuário edite o próprio catálogo no futuro.
 */

export interface Emotion {
  id: string;
  emoji: string;
  label: string;
  /** Cor de destaque opcional (usada no realce/heatmap). */
  color?: string;
}

export const EMOTIONS_DEFAULT: Emotion[] = [
  { id: "tranquilo",   emoji: "😌", label: "Tranquilo",   color: "#34d399" },
  { id: "focado",      emoji: "🎯", label: "Focado",      color: "#38bdf8" },
  { id: "animado",     emoji: "🤩", label: "Animado",     color: "#a78bfa" },
  { id: "cansado",     emoji: "😴", label: "Cansado",     color: "#818cf8" },
  { id: "ansioso",     emoji: "😰", label: "Ansioso",     color: "#fbbf24" },
  { id: "estressado",  emoji: "😣", label: "Estressado",  color: "#f87171" },
  { id: "desmotivado", emoji: "😞", label: "Desmotivado", color: "#94a3b8" },
];

const LS_KEY = "taskflow.emotionsCustom";

/** Retorna o catálogo ativo (custom se existir, senão o padrão). */
export function getEmotions(): Emotion[] {
  try {
    const custom = localStorage.getItem(LS_KEY);
    if (custom) {
      const parsed = JSON.parse(custom) as Emotion[];
      if (Array.isArray(parsed) && parsed.length) return parsed;
    }
  } catch {
    // ignora catálogo custom inválido
  }
  return EMOTIONS_DEFAULT;
}

/** Mantido para compatibilidade — prefira getEmotions() para respeitar o custom. */
export const EMOTIONS = EMOTIONS_DEFAULT;

export function getEmotionById(id: string): Emotion | undefined {
  return getEmotions().find((e) => e.id === id) ?? EMOTIONS_DEFAULT.find((e) => e.id === id);
}

/** Rótulo de intensidade opcional (checkpoint continua válido sem ela). */
export type EmotionIntensity = "leve" | "forte";
