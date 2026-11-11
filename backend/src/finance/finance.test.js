/** Testes da lógica pura de Finanças: parcelas, recorrência e totais do mês. */
import test from "node:test";
import assert from "node:assert/strict";
import { splitInstallments, installmentAmount } from "./installments.js";
import { occurrenceInMonth, occurrencesInMonth, addMonths, clampDay, monthsBetween } from "./recurrence.js";
import { totals, expensesByCategory, monthSummary, pctChange } from "./monthSummary.js";
import { seriesCreate, entryCreate } from "./validation.js";

test("parcelas: soma fecha o total e o resto vai na 1ª", () => {
  const p = splitInstallments(10000, 3);
  assert.deepEqual(p, [3334, 3333, 3333]);
  assert.equal(p.reduce((a, b) => a + b, 0), 10000);
  assert.deepEqual(splitInstallments(9000, 3), [3000, 3000, 3000]);
  assert.equal(installmentAmount(10000, 3, 0), 3334);
  assert.throws(() => splitInstallments(10.5, 2));
  assert.throws(() => splitInstallments(100, 0));
});

test("helpers de mês", () => {
  assert.equal(addMonths("2026-11", 2), "2027-01");
  assert.equal(addMonths("2026-01", -1), "2025-12");
  assert.equal(monthsBetween("2026-11", "2027-02"), 3);
  assert.equal(clampDay("2026-02", 31), "2026-02-28");
  assert.equal(clampDay("2028-02", 31), "2028-02-29");
});

const monthly = { id: "s1", type: "expense", kind: "monthly", amountCents: 5000, startDate: "2026-08-31", dayOfMonth: 31, endDate: null, categoryId: "c" };

test("fixo mensal: antes do início não ocorre; dia 31 vira último dia", () => {
  assert.equal(occurrenceInMonth(monthly, "2026-07"), null);
  assert.equal(occurrenceInMonth(monthly, "2026-08").date, "2026-08-31");
  assert.equal(occurrenceInMonth(monthly, "2026-09").date, "2026-09-30");
  assert.equal(occurrenceInMonth(monthly, "2027-02").date, "2027-02-28");
});

test("fixo mensal: endDate encerra e meses passados continuam", () => {
  const ended = { ...monthly, endDate: "2026-10-31" };
  assert.ok(occurrenceInMonth(ended, "2026-10"));
  assert.equal(occurrenceInMonth(ended, "2026-11"), null);
});

test("revisão: série antiga + nova não reescrevem o passado", () => {
  const old = { ...monthly, id: "a", startDate: "2026-01-10", dayOfMonth: 10, amountCents: 5000, endDate: "2026-05-31" };
  const next = { ...monthly, id: "b", startDate: "2026-06-10", dayOfMonth: 10, amountCents: 7000 };
  const at = (m) => occurrencesInMonth([old, next], [], m).map((o) => o.amountCents);
  assert.deepEqual(at("2026-05"), [5000]);
  assert.deepEqual(at("2026-06"), [7000]);
});

test("exceção: pular mês e ajustar valor", () => {
  const ex = [
    { seriesId: "s1", month: "2026-09", skipped: true },
    { seriesId: "s1", month: "2026-10", skipped: false, amountCents: 9900 },
  ];
  assert.equal(occurrencesInMonth([monthly], ex, "2026-09")[0].skipped, true);
  assert.equal(occurrencesInMonth([monthly], ex, "2026-10")[0].amountCents, 9900);
  assert.equal(occurrencesInMonth([monthly], ex, "2026-11")[0].amountCents, 5000);
});

test("parcelado: N ocorrências com índice e soma exata", () => {
  const s = { id: "p", type: "expense", kind: "installment", amountCents: 10000, installments: 3, startDate: "2026-11-15", dayOfMonth: 15 };
  const all = ["2026-10", "2026-11", "2026-12", "2027-01", "2027-02"].map((m) => occurrenceInMonth(s, m));
  assert.equal(all[0], null);
  assert.equal(all[4], null);
  const got = all.filter(Boolean);
  assert.deepEqual(got.map((o) => o.installmentIndex), [1, 2, 3]);
  assert.equal(got[0].installmentTotal, 3);
  assert.equal(got.reduce((a, o) => a + o.amountCents, 0), 10000);
  assert.equal(got[0].date, "2026-11-15");
});

test("parcelado encerrado no meio para de ocorrer", () => {
  const s = { id: "p", type: "expense", kind: "installment", amountCents: 10000, installments: 5, startDate: "2026-01-05", dayOfMonth: 5, endDate: "2026-03-31" };
  assert.ok(occurrenceInMonth(s, "2026-03"));
  assert.equal(occurrenceInMonth(s, "2026-04"), null);
});

test("totais do mês ignoram puladas; por categoria e comparação", () => {
  const items = [
    { type: "income", amountCents: 300000, categoryId: "sal" },
    { type: "expense", amountCents: 10000, categoryId: "a" },
    { type: "expense", amountCents: 30000, categoryId: "b" },
    { type: "expense", amountCents: 5000, categoryId: null },
    { type: "expense", amountCents: 99999, categoryId: "a", skipped: true },
  ];
  assert.deepEqual(totals(items), { incomeCents: 300000, expenseCents: 45000, balanceCents: 255000 });
  const cats = expensesByCategory(items);
  assert.deepEqual(cats.map((c) => c.categoryId), ["b", "a", null]);
  assert.equal(cats[0].pct, 67);
  const s = monthSummary(items, [{ type: "expense", amountCents: 30000 }]);
  assert.equal(s.delta.expenseCents, 15000);
  assert.equal(s.delta.expensePct, 50);
  assert.equal(pctChange(10, 0), null);
});

test("validação: centavos inteiros e parcelas", () => {
  const base = { type: "expense", date: "2026-11-11" };
  assert.equal(entryCreate.safeParse({ ...base, amountCents: 12.5 }).success, false);
  assert.equal(entryCreate.safeParse({ ...base, amountCents: 0 }).success, false);
  assert.equal(entryCreate.safeParse({ ...base, amountCents: 1250 }).success, true);
  assert.equal(entryCreate.safeParse({ ...base, amountCents: 1250, date: "2026-02-30" }).success, false);
  const s = { type: "expense", amountCents: 9000, startDate: "2026-11-11" };
  assert.equal(seriesCreate.safeParse({ ...s, kind: "installment" }).success, false);
  assert.equal(seriesCreate.safeParse({ ...s, kind: "installment", installments: 3 }).success, true);
  assert.equal(seriesCreate.safeParse({ ...s, kind: "monthly", installments: 3 }).success, false);
});
