// Autodesenvolvimento no Daily Focus.
// Rastreia (localStorage) quais dias o usuário começou por uma tarefa de
// autodesenvolvimento, calcula o streak e controla a dispensa da recomendação.
// Segue o mesmo padrão de dailyFocusDay.ts (data local, não UTC — fix #11/#23).

const LOG_KEY     = "taskflow.selfDev.log";      // { [YYYY-MM-DD]: true }
const DISMISS_KEY = "taskflow.selfDev.dismissUntil"; // "YYYY-MM-DD"

/** Data local no formato YYYY-MM-DD (evita bug de fuso). */
export function todayIso(): string {
  const d = new Date();
  return [
    d.getFullYear(),
    String(d.getMonth() + 1).padStart(2, "0"),
    String(d.getDate()).padStart(2, "0"),
  ].join("-");
}

function isoDaysAgo(n: number): string {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return [
    d.getFullYear(),
    String(d.getMonth() + 1).padStart(2, "0"),
    String(d.getDate()).padStart(2, "0"),
  ].join("-");
}

function readLog(): Record<string, boolean> {
  try {
    const raw = localStorage.getItem(LOG_KEY);
    if (!raw) return {};
    const obj = JSON.parse(raw);
    return obj && typeof obj === "object" ? obj : {};
  } catch {
    return {};
  }
}

function writeLog(log: Record<string, boolean>): void {
  try {
    localStorage.setItem(LOG_KEY, JSON.stringify(log));
  } catch {}
}

/** Marca (ou desmarca) o dia atual como "começou por autodesenvolvimento". */
export function setTodaySelfDev(value: boolean): void {
  const log = readLog();
  if (value) {
    log[todayIso()] = true;
  } else {
    delete log[todayIso()];
  }
  writeLog(log);
}

/** Se hoje já foi marcado como autodesenvolvimento. */
export function isTodaySelfDev(): boolean {
  return !!readLog()[todayIso()];
}

/**
 * Streak de dias consecutivos (terminando hoje ou ontem) em que o usuário
 * começou por autodesenvolvimento. Se hoje ainda não foi marcado, conta a
 * partir de ontem para não zerar o streak no início do dia.
 */
export function getSelfDevStreak(): number {
  const log = readLog();
  let streak = 0;
  // ponto de partida: hoje se marcado, senão ontem
  let start = log[todayIso()] ? 0 : 1;
  for (let i = start; ; i++) {
    if (log[isoDaysAgo(i)]) streak++;
    else break;
  }
  return streak;
}

/** Total de dias registrados de autodesenvolvimento. */
export function getSelfDevTotal(): number {
  return Object.values(readLog()).filter(Boolean).length;
}

// ── Dispensa temporária da recomendação ──────────────────
/** Dispensa a recomendação por `days` dias (default 7). */
export function dismissRecommendation(days = 7): void {
  try {
    localStorage.setItem(DISMISS_KEY, isoDaysAgo(-days)); // -days = daqui a `days` dias
  } catch {}
}

/** Se a recomendação está dispensada no momento. */
export function isRecommendationDismissed(): boolean {
  try {
    const until = localStorage.getItem(DISMISS_KEY);
    if (!until) return false;
    return todayIso() < until;
  } catch {
    return false;
  }
}

// ── Conteúdo / rotação ───────────────────────────────────
export const SELF_DEV_EXAMPLES: string[] = [
  "estudar algo importante para o seu desenvolvimento",
  "evoluir uma ferramenta pessoal de produtividade",
  "trabalhar num projeto próprio",
  "organizar ou evoluir seu sistema de estudos",
  "aprender uma nova habilidade",
  "melhorar um processo que você vai reutilizar depois",
];

/** Exemplo do dia — rotaciona de forma determinística pelo dia do ano. */
export function getExampleOfTheDay(): string {
  const d = new Date();
  const start = new Date(d.getFullYear(), 0, 0);
  const dayOfYear = Math.floor((d.getTime() - start.getTime()) / 86400000);
  return SELF_DEV_EXAMPLES[dayOfYear % SELF_DEV_EXAMPLES.length];
}

/**
 * Fator de ganho composto de 1% ao dia por um ano: 1.01^365 ≈ 37.78.
 * Usado no micro-visual da recomendação.
 */
export const COMPOUND_YEAR_FACTOR = Math.round(Math.pow(1.01, 365));
