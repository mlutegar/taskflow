/**
 * dateUtils.js — Utilitários centralizados de data para o TaskFlow.
 *
 * Elimina a duplicação do padrão `split("/")` / parsePtBR espalhado por
 * dailyFocusHistory, DashboardPage, HistoryPage, WeeklyReview e useStreakReminder.
 *
 * Todas as funções operam em hora LOCAL (nunca UTC) para evitar bugs de fuso.
 */

/**
 * Converte uma string DD/MM/YYYY em um objeto Date (horário local).
 * Retorna Invalid Date se a string for inválida.
 * @param {string} str
 * @returns {Date}
 */
export function parsePtBR(str: string): Date {
  const [d, m, y] = (str || "").split("/");
  return new Date(Number(y), Number(m) - 1, Number(d));
}

/**
 * Converte DD/MM/YYYY → YYYY-MM-DD (formato ISO local).
 * @param {string} str
 * @returns {string}
 */
export function ptBRtoISO(str: string): string {
  const dt = parsePtBR(str);
  const y  = dt.getFullYear();
  const m  = String(dt.getMonth() + 1).padStart(2, "0");
  const d  = String(dt.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

/**
 * Converte YYYY-MM-DD → DD/MM/YYYY.
 * @param {string} str
 * @returns {string}
 */
export function ISOtoPtBR(str: string): string {
  const [y, m, d] = (str || "").split("-");
  return `${d}/${m}/${y}`;
}

/**
 * Retorna a data de hoje como string YYYY-MM-DD (horário local).
 * @returns {string}
 */
export function todayISO(): string {
  const d = new Date();
  return [
    d.getFullYear(),
    String(d.getMonth() + 1).padStart(2, "0"),
    String(d.getDate()).padStart(2, "0"),
  ].join("-");
}

/**
 * Retorna a data de hoje como string DD/MM/YYYY (horário local).
 * @returns {string}
 */
export function todayPtBR(): string {
  return new Date().toLocaleDateString("pt-BR");
}

/**
 * Retorna a data de N dias atrás como string YYYY-MM-DD (horário local).
 * @param {number} n
 * @returns {string}
 */
export function daysAgoISO(n: number): string {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return [
    d.getFullYear(),
    String(d.getMonth() + 1).padStart(2, "0"),
    String(d.getDate()).padStart(2, "0"),
  ].join("-");
}

/**
 * Formata uma string de data (DD/MM/YYYY ou YYYY-MM-DD) com toLocaleDateString pt-BR.
 * @param {string} str
 * @param {Intl.DateTimeFormatOptions} [options]
 * @returns {string}
 */
export function formatPtBR(str: string, options: Intl.DateTimeFormatOptions = { weekday: "short", day: "2-digit", month: "short", year: "numeric" }): string {
  if (!str) return "—";
  const dt = str.includes("/") ? parsePtBR(str) : (() => {
    const [y, m, d] = str.split("-");
    return new Date(Number(y), Number(m) - 1, Number(d));
  })();
  return dt.toLocaleDateString("pt-BR", options);
}

/**
 * Formata uma string ISO (YYYY-MM-DD) para exibição curta em pt-BR.
 * Ex.: "seg., 23 ago."
 * @param {string} iso
 * @returns {string}
 */
export function formatISOShort(iso: string): string {
  return formatPtBR(iso, { weekday: "short", day: "2-digit", month: "short" });
}
