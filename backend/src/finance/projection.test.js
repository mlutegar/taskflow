/** Testes da projeção (lógica pura): cenários, recebidas, revisão e mês pulado. */
import test from "node:test";
import assert from "node:assert/strict";
import { project } from "./projection.js";

const base = { fromMonth: "2026-11", months: 3, entries: [], series: [], exceptions: [], expected: [] };
const exp = (id, amountCents, expectedDate, status, receivedEntryId = null) => ({ id, amountCents, expectedDate, status, receivedEntryId });
const fixed = (o) => ({ id: "s", type: "expense", kind: "monthly", amountCents: 1000, startDate: "2026-01-10", dayOfMonth: 10, endDate: null, ...o });

test("saldo inicial sem nada: constante", () => {
  const r = project({ ...base, openingCents: 5000, openingDate: "2026-11-01" });
  assert.deepEqual(r.months.map((m) => m.confirmedBalanceCents), [5000, 5000, 5000]);
});

test("dois cenários; incertas nunca entram", () => {
  const r = project({
    ...base,
    openingCents: 0,
    openingDate: "2026-11-01",
    expected: [exp("a", 10000, "2026-11-20", "confirmed"), exp("b", 4000, "2026-12-05", "probable"), exp("c", 99999, "2026-12-06", "uncertain")],
  });
  assert.deepEqual(r.months.map((m) => m.confirmedBalanceCents), [10000, 10000, 10000]);
  assert.deepEqual(r.months.map((m) => m.withProbableBalanceCents), [10000, 14000, 14000]);
});

test("renda recebida não conta duas vezes (vira lançamento real)", () => {
  const entries = [{ type: "income", amountCents: 10000, date: "2026-11-20" }];
  const r = project({ ...base, openingDate: "2026-11-01", entries, expected: [exp("a", 10000, "2026-11-20", "confirmed", "entry-1")] });
  assert.equal(r.months[0].confirmedBalanceCents, 10000);
  assert.equal(r.months[0].expectedConfirmedCents, 0);
});

test("recorrentes e parcelas entram; saldo cai e meses negativos são apontados", () => {
  const series = [
    fixed({ amountCents: 3000 }),
    { id: "p", type: "expense", kind: "installment", amountCents: 6000, installments: 2, startDate: "2026-11-15", dayOfMonth: 15 },
  ];
  const r = project({ ...base, openingCents: 4000, openingDate: "2026-11-01", series });
  // nov: -3000 -3000 ; dez: -3000 -3000 ; jan: -3000
  assert.deepEqual(r.months.map((m) => m.confirmedBalanceCents), [-2000, -8000, -11000]);
  assert.deepEqual(r.negativeMonths.confirmed, ["2026-11", "2026-12", "2027-01"]);
});

test("recorrente revisado e mês pulado refletidos", () => {
  const old = fixed({ id: "a", amountCents: 1000, endDate: "2026-11-30" });
  const next = fixed({ id: "b", amountCents: 5000, startDate: "2026-12-10" });
  const exceptions = [{ seriesId: "b", month: "2027-01", skipped: true }];
  const r = project({ ...base, openingDate: "2026-11-01", series: [old, next], exceptions });
  assert.deepEqual(r.months.map((m) => m.expenseCents), [1000, 5000, 0]);
  assert.deepEqual(r.months.map((m) => m.confirmedBalanceCents), [-1000, -6000, -6000]);
});

test("passado desde a data do saldo inicial é acumulado; antes dela é ignorado", () => {
  const series = [fixed({ amountCents: 1000, startDate: "2026-08-10", dayOfMonth: 10 })];
  const entries = [{ type: "income", amountCents: 7777, date: "2026-08-01" }]; // antes de openingDate
  const r = project({ ...base, openingCents: 10000, openingDate: "2026-09-01", series, entries });
  // set e out: -2000 → base 8000; nov -1000 ...
  assert.equal(r.startingBalanceCents, 10000 - 1000 - 1000);
  assert.equal(r.months[0].confirmedBalanceCents, 7000);
});

test("previsão atrasada cai no primeiro mês projetado", () => {
  const r = project({ ...base, openingDate: "2026-11-01", expected: [exp("a", 500, "2026-10-01", "confirmed")] });
  assert.equal(r.months[0].expectedConfirmedCents, 500);
});
