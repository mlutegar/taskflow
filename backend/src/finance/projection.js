/**
 * finance/projection.js — projeção de saldo mês a mês (puro, sem banco). Centavos.
 *
 * saldo(fim do mês) = saldo inicial (em openingDate) + lançamentos reais + ocorrências de séries
 * (fixo/parcelas, já com revisões e meses pulados) + rendas previstas ainda não recebidas.
 * Cenário "confirmed": só previsões confirmadas. "withProbable": confirmadas + prováveis.
 * Incertas NUNCA entram. Renda recebida (receivedEntryId) já virou lançamento real: fora da previsão.
 */
import { addMonths, monthOf, monthsBetween, occurrencesInMonth } from "./recurrence.js";

export const MAX_LOOKBACK_MONTHS = 120;

/**
 * @param o.fromMonth    1º mês projetado (mês atual do cliente)
 * @param o.openingDate  data do saldo inicial ("YYYY-MM-DD") ou null → começa em fromMonth
 * @param o.entries      lançamentos reais {type, amountCents, date}
 * @param o.series / o.exceptions  regras e exceções
 * @param o.expected     rendas previstas {amountCents, expectedDate, status, receivedEntryId}
 */
export function project({ openingCents = 0, openingDate = null, fromMonth, months, entries, series, exceptions, expected }) {
  const startDate = openingDate ?? `${fromMonth}-01`;
  let firstMonth = monthOf(startDate);
  if (monthsBetween(firstMonth, fromMonth) > MAX_LOOKBACK_MONTHS) firstMonth = addMonths(fromMonth, -MAX_LOOKBACK_MONTHS);

  const pending = expected.filter((e) => !e.receivedEntryId && (e.status === "confirmed" || e.status === "probable"));

  // Lançamentos reais + séries de um mês (só a partir de startDate).
  const realOf = (month) => {
    let income = 0;
    let expense = 0;
    const add = (type, cents) => {
      if (type === "income") income += cents;
      else expense += cents;
    };
    for (const e of entries) if (monthOf(e.date) === month && e.date >= startDate) add(e.type, e.amountCents);
    for (const o of occurrencesInMonth(series, exceptions, month))
      if (!o.skipped && o.date >= startDate) add(o.type, o.amountCents);
    return { income, expense };
  };

  // Saldo real acumulado até o mês anterior a fromMonth.
  let base = openingCents;
  for (let m = firstMonth; monthsBetween(m, fromMonth) > 0; m = addMonths(m, 1)) {
    const r = realOf(m);
    base += r.income - r.expense;
  }

  // Previstas atrasadas (data antes do 1º mês projetado) caem no 1º mês.
  const monthOfExpected = (e) => (monthOf(e.expectedDate) < fromMonth ? fromMonth : monthOf(e.expectedDate));

  let confirmedBal = base;
  let probableBal = base;
  const out = [];
  for (let i = 0; i < months; i++) {
    const month = addMonths(fromMonth, i);
    const r = realOf(month);
    let confirmed = 0;
    let probable = 0;
    for (const e of pending) {
      if (monthOfExpected(e) !== month) continue;
      if (e.status === "confirmed") confirmed += e.amountCents;
      else probable += e.amountCents;
    }
    confirmedBal += r.income - r.expense + confirmed;
    probableBal += r.income - r.expense + confirmed + probable;
    out.push({
      month,
      incomeCents: r.income,
      expenseCents: r.expense,
      expectedConfirmedCents: confirmed,
      expectedProbableCents: probable,
      confirmedBalanceCents: confirmedBal,
      withProbableBalanceCents: probableBal,
    });
  }
  return {
    startingBalanceCents: base,
    months: out,
    negativeMonths: {
      confirmed: out.filter((m) => m.confirmedBalanceCents < 0).map((m) => m.month),
      withProbable: out.filter((m) => m.withProbableBalanceCents < 0).map((m) => m.month),
    },
  };
}
