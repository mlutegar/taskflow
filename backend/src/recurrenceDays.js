/**
 * recurrenceDays.js — helpers puros de recorrência/dia, compartilhados entre
 * Hábitos (routines.js) e Saúde (health/schedule.js). Sem acesso a banco.
 */

// Recorrências agendáveis de hábitos (espelha frontend/src/lib/dailyRoutine.ts).
const DAILY_RECURRENCES = new Set(["daily", "weekdays"]);

/**
 * true se a rotina/hábito "vale para hoje" segundo sua recorrência.
 * - sem recorrência (null/"none"): sempre vale (comportamento legado).
 * - "daily": todo dia. "weekdays": seg–sex (getDay 1..5, horário local).
 */
export function appliesToday(recurrence, ref = new Date()) {
  if (!recurrence || recurrence === "none") return true;
  if (!DAILY_RECURRENCES.has(recurrence)) return true;
  if (recurrence === "weekdays") {
    const dow = ref.getDay(); // 0=dom … 6=sáb
    return dow >= 1 && dow <= 5;
  }
  return true;
}

/** Dia civil "YYYY-MM-DD" → número de dias desde a época (sem fuso/DST). */
export function dayNumber(dateStr) {
  const [y, m, d] = dateStr.split("-").map(Number);
  return Math.round(Date.UTC(y, m - 1, d) / 86400000);
}

/** Dia da semana (0=dom … 6=sáb) de uma data "YYYY-MM-DD", sem depender do fuso. */
export function dayOfWeek(dateStr) {
  const [y, m, d] = dateStr.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d)).getUTCDay();
}

/** Soma `n` dias a uma data "YYYY-MM-DD". */
export function addDays(dateStr, n) {
  const [y, m, d] = dateStr.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d + n)).toISOString().slice(0, 10);
}
