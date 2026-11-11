import test from "node:test";
import assert from "node:assert/strict";
import { appliesOnDate } from "./schedule.js";
import { applyIntake, isLowStock, daysOfStockLeft } from "./stock.js";
import { dateStr, timeStr, medicationCreate } from "./validation.js";

// 2026-11-11 é quarta-feira.
const base = { startDate: "2026-11-01" };

test("daily: aplica todo dia dentro do período", () => {
  assert.equal(appliesOnDate({ ...base, frequency: "daily" }, "2026-11-11"), true);
});

test("fora de [startDate, endDate] nunca aplica", () => {
  const r = { frequency: "daily", startDate: "2026-11-05", endDate: "2026-11-10" };
  assert.equal(appliesOnDate(r, "2026-11-04"), false);
  assert.equal(appliesOnDate(r, "2026-11-05"), true);
  assert.equal(appliesOnDate(r, "2026-11-10"), true);
  assert.equal(appliesOnDate(r, "2026-11-11"), false);
});

test("weekdays: seg–sex, não sáb/dom", () => {
  const r = { ...base, frequency: "weekdays" };
  assert.equal(appliesOnDate(r, "2026-11-11"), true); // quarta
  assert.equal(appliesOnDate(r, "2026-11-14"), false); // sábado
  assert.equal(appliesOnDate(r, "2026-11-15"), false); // domingo
});

test("custom_days: só nos dias escolhidos (0=dom)", () => {
  const r = { ...base, frequency: "custom_days", daysOfWeek: [1, 3] }; // seg e qua
  assert.equal(appliesOnDate(r, "2026-11-11"), true); // qua
  assert.equal(appliesOnDate(r, "2026-11-09"), true); // seg
  assert.equal(appliesOnDate(r, "2026-11-10"), false); // ter
});

test("every_n_days: âncora é o startDate (dia do início aplica)", () => {
  const r = { frequency: "every_n_days", intervalDays: 3, startDate: "2026-11-02" };
  assert.equal(appliesOnDate(r, "2026-11-02"), true); // dia 0
  assert.equal(appliesOnDate(r, "2026-11-03"), false);
  assert.equal(appliesOnDate(r, "2026-11-04"), false);
  assert.equal(appliesOnDate(r, "2026-11-05"), true); // dia 3
  assert.equal(appliesOnDate(r, "2026-11-11"), true); // dia 9
  assert.equal(appliesOnDate(r, "2026-11-12"), false);
});

test("every_n_days: cruza virada de mês/ano e não depende do fuso", () => {
  const r = { frequency: "every_n_days", intervalDays: 7, startDate: "2026-12-28" };
  assert.equal(appliesOnDate(r, "2027-01-04"), true);
  assert.equal(appliesOnDate(r, "2027-01-05"), false);
});

test("every_n_days: sem intervalo válido ou sem âncora não aplica", () => {
  assert.equal(appliesOnDate({ frequency: "every_n_days", startDate: "2026-11-01" }, "2026-11-01"), false);
  assert.equal(appliesOnDate({ frequency: "every_n_days", intervalDays: 2 }, "2026-11-01"), false);
});

test("every_n_days: não aplica antes da âncora (mesmo múltiplo negativo)", () => {
  const r = { frequency: "every_n_days", intervalDays: 2, startDate: "2026-11-10" };
  assert.equal(appliesOnDate(r, "2026-11-08"), false);
});

// ── Estoque ────────────────────────────────────────────────────────────────
test("tomei: copia a dose do horário e baixa o estoque", () => {
  const r = applyIntake(null, "taken", 2, 10);
  assert.deepEqual(r, { intake: { status: "taken", doseQty: 2 }, stock: 8 });
});

test("tomei de novo é idempotente (não baixa duas vezes)", () => {
  const prev = { status: "taken", doseQty: 2 };
  const r = applyIntake(prev, "taken", 2, 8);
  assert.equal(r.stock, 8);
});

test("taken → skipped devolve exatamente o doseQty do intake, mesmo se a dose do horário mudou", () => {
  const prev = { status: "taken", doseQty: 2 };
  const r = applyIntake(prev, "skipped", 1, 8); // horário agora é 1, intake guardou 2
  assert.equal(r.stock, 10);
  assert.deepEqual(r.intake, { status: "skipped", doseQty: 2 });
});

test("desmarcar (pending) devolve o estoque e remove o registro", () => {
  const r = applyIntake({ status: "taken", doseQty: 1 }, "pending", 1, 4);
  assert.equal(r.stock, 5);
  assert.equal(r.intake, null);
});

test("skipped → taken baixa com a dose atual do horário", () => {
  const r = applyIntake({ status: "skipped", doseQty: 1 }, "taken", 2, 5);
  assert.equal(r.stock, 3);
  assert.equal(r.intake.doseQty, 2);
});

test("skipped não mexe no estoque", () => {
  assert.equal(applyIntake(null, "skipped", 1, 5).stock, 5);
});

test("estoque nunca fica negativo", () => {
  assert.equal(applyIntake(null, "taken", 3, 1).stock, 0);
  assert.equal(applyIntake(null, "taken", 1, 0).stock, 0);
});

test("isLowStock: no limite ou abaixo", () => {
  assert.equal(isLowStock(5, 5), true);
  assert.equal(isLowStock(6, 5), false);
});

test("daysOfStockLeft: 1 comprimido de manhã e 2 à noite = 3/dia", () => {
  const med = { frequency: "daily", startDate: "2026-11-01", stockQty: 9 };
  const sch = [{ doseQty: 1 }, { doseQty: 2 }];
  assert.equal(daysOfStockLeft(med, sch, "2026-11-11"), 3);
});

test("daysOfStockLeft: ignora horários inativos e sem consumo retorna null", () => {
  const med = { frequency: "daily", startDate: "2026-11-01", stockQty: 4 };
  assert.equal(daysOfStockLeft(med, [{ doseQty: 1 }, { doseQty: 5, active: false }], "2026-11-11"), 4);
  assert.equal(daysOfStockLeft(med, [], "2026-11-11"), null);
});

test("daysOfStockLeft: pula dias em que o remédio não se aplica", () => {
  // seg/qua/sex, 1 por dia, estoque 2; a partir de qui 12/11: sex 13 e seg 16 consomem; qua 18 (i=6) já não tem.
  const med = { frequency: "custom_days", daysOfWeek: [1, 3, 5], startDate: "2026-11-01", stockQty: 2 };
  assert.equal(daysOfStockLeft(med, [{ doseQty: 1 }], "2026-11-12"), 6);
});

// ── Validação ──────────────────────────────────────────────────────────────
test("dateStr/timeStr validam formato e calendário", () => {
  assert.equal(dateStr.safeParse("2026-11-11").success, true);
  assert.equal(dateStr.safeParse("2026-02-30").success, false);
  assert.equal(dateStr.safeParse("11/11/2026").success, false);
  assert.equal(timeStr.safeParse("08:30").success, true);
  assert.equal(timeStr.safeParse("24:00").success, false);
  assert.equal(timeStr.safeParse("8:30").success, false);
});

test("medicationCreate: custom_days exige dias; every_n_days exige intervalo; fim ≥ início", () => {
  const ok = { name: "X", startDate: "2026-11-01" };
  assert.equal(medicationCreate.safeParse(ok).success, true);
  assert.equal(medicationCreate.safeParse({ ...ok, frequency: "custom_days" }).success, false);
  assert.equal(medicationCreate.safeParse({ ...ok, frequency: "every_n_days" }).success, false);
  assert.equal(medicationCreate.safeParse({ ...ok, frequency: "every_n_days", intervalDays: 2 }).success, true);
  assert.equal(medicationCreate.safeParse({ ...ok, endDate: "2026-10-01" }).success, false);
});
