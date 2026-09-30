// Utilitários para o campo de tempo estimado (em minutos) das tarefas.

export interface TimePreset {
  value: number;
  label: string;
}

// Presets oferecidos nos formulários de tarefa.
export const ESTIMATED_TIME_PRESETS: TimePreset[] = [
  { value: 5, label: "5 min" },
  { value: 10, label: "10 min" },
  { value: 15, label: "15 min" },
  { value: 30, label: "30 min" },
  { value: 45, label: "45 min" },
  { value: 60, label: "1 h" },
  { value: 90, label: "1 h 30" },
  { value: 120, label: "2 h" },
  { value: 240, label: "4 h" },
];

// Limites superiores (inclusivos) de cada faixa, em minutos.
// Fonte única no front — deve espelhar backend/src/taskEstimatedTime.js.
export const TIME_BUCKET_BOUNDS = { fast: 15, medium: 60 } as const;

export type TimeBucket = "fast" | "medium" | "long";

// Faixas usadas pelo filtro "Tempo" (alinhadas ao backend).
export const TIME_BUCKETS: { label: string; value: string }[] = [
  { label: "Qualquer tempo", value: "" },
  { label: `⚡ Rápida (≤${TIME_BUCKET_BOUNDS.fast} min)`, value: "fast" },
  { label: `⏳ Média (${TIME_BUCKET_BOUNDS.fast + 1}–${TIME_BUCKET_BOUNDS.medium} min)`, value: "medium" },
  { label: `🕰 Longa (>${TIME_BUCKET_BOUNDS.medium} min)`, value: "long" },
  { label: "Sem estimativa", value: "none" },
];

/** Classifica minutos em uma faixa ou null quando sem estimativa. */
export function bucketOf(min: number | null | undefined): TimeBucket | null {
  if (min == null) return null;
  if (min <= TIME_BUCKET_BOUNDS.fast) return "fast";
  if (min <= TIME_BUCKET_BOUNDS.medium) return "medium";
  return "long";
}

/** Formata minutos como "45 min", "1 h" ou "1 h 30". */
export function formatMinutes(min: number | null | undefined): string {
  if (min == null) return "";
  if (min < 60) return `${min} min`;
  const hours = Math.floor(min / 60);
  const rest = min % 60;
  return rest === 0 ? `${hours} h` : `${hours} h ${rest.toString().padStart(2, "0")}`;
}

/** Soma o tempo estimado (ignora tarefas sem estimativa e concluídas quando pedido). */
export function sumEstimated(
  tasks: Array<{ estimated_minutes?: number | null; completed?: boolean }>,
  opts: { includeCompleted?: boolean } = {}
): number {
  return tasks.reduce((total, t) => {
    if (!opts.includeCompleted && t.completed) return total;
    return total + (t.estimated_minutes ?? 0);
  }, 0);
}

/**
 * Interpreta um texto livre de duração: "90", "1h30", "1h", "45m", "2 h".
 * Retorna minutos (>=0) ou null se vazio/indecifrável.
 */
export function parseMinutesInput(raw: string): number | null {
  const s = raw.trim().toLowerCase();
  if (!s) return null;
  const hm = s.match(/^(\d+)\s*h(?:\s*(\d+))?\s*m?$/);      // "1h", "1h30", "1 h 30"
  if (hm) return Number(hm[1]) * 60 + (hm[2] ? Number(hm[2]) : 0);
  const mOnly = s.match(/^(\d+)\s*m?$/);                     // "90", "45m"
  if (mOnly) return Number(mOnly[1]);
  return null;
}

// ── Calibração (estimado × real) ────────────────────────────────────────────
// Guardamos uma média móvel simples do fator real/estimado no localStorage,
// para sugerir ajustes sem depender do servidor.
const CALIBRATION_KEY = "taskflow.estimation.calibration";

export function recordEstimationSample(estimated: number | null | undefined, actual: number | null | undefined): void {
  if (!estimated || !actual || estimated <= 0 || actual <= 0) return;
  try {
    const prev = JSON.parse(localStorage.getItem(CALIBRATION_KEY) || "null") as { ratio: number; n: number } | null;
    const ratio = actual / estimated;
    if (!prev) {
      localStorage.setItem(CALIBRATION_KEY, JSON.stringify({ ratio, n: 1 }));
    } else {
      const n = Math.min(prev.n + 1, 30); // limita o peso do histórico antigo
      const blended = prev.ratio + (ratio - prev.ratio) / n;
      localStorage.setItem(CALIBRATION_KEY, JSON.stringify({ ratio: blended, n }));
    }
  } catch { /* localStorage indisponível — calibração é best-effort */ }
}

/** Retorna o fator médio real/estimado (ex.: 1.3 = costuma levar 30% a mais) ou null. */
export function getCalibrationFactor(): { ratio: number; n: number } | null {
  try {
    const v = JSON.parse(localStorage.getItem(CALIBRATION_KEY) || "null");
    return v && typeof v.ratio === "number" && v.n >= 3 ? v : null;
  } catch { return null; }
}
