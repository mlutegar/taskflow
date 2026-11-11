/**
 * finance/recurrence.js — ocorrências de séries (fixo mensal / parcelado) calculadas na leitura.
 * Puro: sem banco. Meses são "YYYY-MM", datas "YYYY-MM-DD".
 */
import { installmentAmount } from "./installments.js";

export const monthOf = (date) => date.slice(0, 7);

const pad = (n) => String(n).padStart(2, "0");

export function daysInMonth(month) {
  const [y, m] = month.split("-").map(Number);
  return new Date(Date.UTC(y, m, 0)).getUTCDate();
}

/** "YYYY-MM" + k meses. */
export function addMonths(month, k) {
  const [y, m] = month.split("-").map(Number);
  const idx = y * 12 + (m - 1) + k;
  return `${Math.floor(idx / 12)}-${pad((idx % 12) + 1)}`;
}

/** Diferença em meses (b - a). */
export function monthsBetween(a, b) {
  const [ya, ma] = a.split("-").map(Number);
  const [yb, mb] = b.split("-").map(Number);
  return (yb - ya) * 12 + (mb - ma);
}

/** Dia do mês limitado ao último dia (31 em fevereiro → 28/29). */
export function clampDay(month, day) {
  return `${month}-${pad(Math.min(day, daysInMonth(month)))}`;
}

export function lastDayOfMonth(month) {
  return `${month}-${pad(daysInMonth(month))}`;
}

/**
 * Ocorrência (ou null) de uma série em `month`.
 * `exception` ({skipped, amountCents}) é opcional. Ocorrência pulada volta com `skipped: true`
 * (a UI pode desfazer); os totais ignoram as puladas.
 */
export function occurrenceInMonth(series, month, exception = null) {
  const index = monthsBetween(monthOf(series.startDate), month);
  if (index < 0) return null;
  if (series.kind === "installment" && index >= series.installments) return null;
  const date = index === 0 ? series.startDate : clampDay(month, series.dayOfMonth);
  if (series.endDate && date > series.endDate) return null;

  const amountCents =
    series.kind === "installment"
      ? installmentAmount(series.amountCents, series.installments, index)
      : exception?.amountCents ?? series.amountCents;

  return {
    seriesId: series.id,
    type: series.type,
    kind: series.kind,
    date,
    amountCents,
    categoryId: series.categoryId ?? null,
    description: series.description ?? null,
    paymentMethod: series.paymentMethod ?? null,
    installmentIndex: series.kind === "installment" ? index + 1 : null,
    installmentTotal: series.kind === "installment" ? series.installments : null,
    skipped: !!exception?.skipped,
  };
}

/** Ocorrências de várias séries em um mês. `exceptions` = lista com {seriesId, month, ...}. */
export function occurrencesInMonth(seriesList, exceptions, month) {
  const exBy = new Map(exceptions.filter((e) => e.month === month).map((e) => [e.seriesId, e]));
  return seriesList.map((s) => occurrenceInMonth(s, month, exBy.get(s.id) ?? null)).filter(Boolean);
}
