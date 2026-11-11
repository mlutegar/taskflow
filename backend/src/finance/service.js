/** finance/service.js — junta lançamentos reais e ocorrências de séries de um mês (acesso a banco). */
import prisma from "../prisma.js";
import { occurrencesInMonth, lastDayOfMonth } from "./recurrence.js";

export function shapeEntry(e) {
  return {
    id: e.id,
    origin: "single",
    type: e.type,
    amountCents: e.amountCents,
    date: e.date,
    categoryId: e.categoryId,
    description: e.description,
    paymentMethod: e.paymentMethod,
    seriesId: null,
    kind: null,
    installmentIndex: null,
    installmentTotal: null,
    skipped: false,
  };
}

export function shapeSeries(s) {
  return {
    id: s.id,
    type: s.type,
    kind: s.kind,
    amountCents: s.amountCents,
    installments: s.installments,
    startDate: s.startDate,
    endDate: s.endDate,
    dayOfMonth: s.dayOfMonth,
    categoryId: s.categoryId,
    description: s.description,
    paymentMethod: s.paymentMethod,
  };
}

/** Itens do mês (reais + virtuais), ordenados por data desc. Sempre escopado por userId. */
export async function monthItems(userId, month) {
  const first = `${month}-01`;
  const last = lastDayOfMonth(month);
  const [entries, series] = await Promise.all([
    prisma.financeEntry.findMany({ where: { userId, date: { gte: first, lte: last } } }),
    prisma.financeSeries.findMany({
      where: { userId, startDate: { lte: last }, OR: [{ endDate: null }, { endDate: { gte: first } }] },
    }),
  ]);
  const exceptions = series.length
    ? await prisma.financeSeriesException.findMany({
        where: { userId, month, seriesId: { in: series.map((s) => s.id) } },
      })
    : [];

  const virtual = occurrencesInMonth(series, exceptions, month).map((o) => ({
    id: `s:${o.seriesId}:${month}`,
    origin: "series",
    ...o,
  }));
  return [...entries.map(shapeEntry), ...virtual].sort(
    (a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : 0),
  );
}

/** categoryId (se informado) deve ser do usuário e do mesmo tipo (gasto/renda). */
export async function categoryOk(userId, categoryId, type) {
  if (!categoryId) return true;
  const c = await prisma.financeCategory.findFirst({ where: { id: categoryId, userId } });
  return !!c && c.kind === type;
}
