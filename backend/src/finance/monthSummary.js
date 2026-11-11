/** finance/monthSummary.js — totais do mês e comparação com o mês anterior (centavos). */

/** `items`: {type, amountCents, categoryId, skipped?}. */
export function totals(items) {
  let incomeCents = 0;
  let expenseCents = 0;
  for (const it of items) {
    if (it.skipped) continue;
    if (it.type === "income") incomeCents += it.amountCents;
    else if (it.type === "expense") expenseCents += it.amountCents;
  }
  return { incomeCents, expenseCents, balanceCents: incomeCents - expenseCents };
}

/** Gastos por categoria, do maior para o menor. pct inteiro 0–100 (do total de saídas). */
export function expensesByCategory(items) {
  const map = new Map();
  let total = 0;
  for (const it of items) {
    if (it.skipped || it.type !== "expense") continue;
    const key = it.categoryId ?? null;
    map.set(key, (map.get(key) ?? 0) + it.amountCents);
    total += it.amountCents;
  }
  return [...map.entries()]
    .map(([categoryId, totalCents]) => ({
      categoryId,
      totalCents,
      pct: total > 0 ? Math.round((totalCents * 100) / total) : 0,
    }))
    .sort((a, b) => b.totalCents - a.totalCents);
}

/** Variação % de `cur` sobre `prev`, 1 casa decimal (null se prev = 0). */
export function pctChange(cur, prev) {
  if (!prev) return null;
  return Math.round(((cur - prev) * 1000) / prev) / 10;
}

export function monthSummary(currentItems, previousItems) {
  const cur = totals(currentItems);
  const prev = totals(previousItems);
  return {
    ...cur,
    byCategory: expensesByCategory(currentItems),
    previous: prev,
    delta: {
      incomeCents: cur.incomeCents - prev.incomeCents,
      expenseCents: cur.expenseCents - prev.expenseCents,
      balanceCents: cur.balanceCents - prev.balanceCents,
      expensePct: pctChange(cur.expenseCents, prev.expenseCents),
      incomePct: pctChange(cur.incomeCents, prev.incomeCents),
    },
  };
}
