import test from "node:test";
import assert from "node:assert/strict";
import { appliesOnDate } from "./schedule.js";
import { buildShoppingList } from "./shoppingList.js";
import { stepCreate, stepUpdate, productCreate, checkInput } from "./validation.js";

// ── Frequência de passos (esfoliante 2x por semana etc.) ────────────────────
// 2026-11-09 seg, 10 ter, 11 qua, 12 qui, 13 sex, 14 sáb, 15 dom.
test("esfoliante 2x/semana (ter e sex): só aparece nesses dias", () => {
  const rule = { frequency: "custom_days", daysOfWeek: [2, 5], startDate: "2026-11-01" };
  const week = ["2026-11-09", "2026-11-10", "2026-11-11", "2026-11-12", "2026-11-13", "2026-11-14", "2026-11-15"];
  assert.deepEqual(week.filter((d) => appliesOnDate(rule, d)), ["2026-11-10", "2026-11-13"]);
});

test("passo diário aparece todo dia; every_n_days usa o startDate do passo como âncora", () => {
  assert.equal(appliesOnDate({ frequency: "daily", startDate: "2026-11-01" }, "2026-12-25"), true);
  const rule = { frequency: "every_n_days", intervalDays: 3, startDate: "2026-11-10" };
  assert.equal(appliesOnDate(rule, "2026-11-10"), true);
  assert.equal(appliesOnDate(rule, "2026-11-12"), false);
  assert.equal(appliesOnDate(rule, "2026-11-13"), true);
});

// ── Lista de compras ────────────────────────────────────────────────────────
const prod = (name, status, category = "outro") => ({ id: name, name, status, category });
const med = (name, stockQty, lowStockThreshold = 5, active = true) => ({ id: name, name, stockQty, lowStockThreshold, active });

test("lista de compras: só 'acabando' e 'preciso comprar', 'preciso comprar' primeiro", () => {
  const r = buildShoppingList(
    [prod("Hidratante", "low"), prod("Protetor", "need_to_buy"), prod("Sabonete", "have"), prod("Esfoliante", "low")],
    []
  );
  assert.deepEqual(r.skincare.map((p) => p.name), ["Protetor", "Esfoliante", "Hidratante"]);
  assert.equal(r.total, 3);
});

test("lista de compras: remédios com estoque <= limite, em seção separada, mais crítico primeiro", () => {
  const r = buildShoppingList([], [med("A", 10), med("B", 5), med("C", 0), med("D", 2, 5, false), med("E", 3)]);
  assert.deepEqual(r.medications.map((m) => m.name), ["C", "E", "B"]); // D arquivado; A acima do limite
  assert.equal(r.medications[0].empty, true);
  assert.equal(r.skincare.length, 0);
  assert.equal(r.total, 3);
});

test("lista de compras vazia", () => {
  assert.deepEqual(buildShoppingList([], []), { skincare: [], medications: [], total: 0 });
});

// ── Validação ───────────────────────────────────────────────────────────────
test("stepCreate: exige nome ou produto, dias para custom_days e intervalo para every_n_days", () => {
  assert.equal(stepCreate.safeParse({ period: "morning" }).success, false);
  assert.equal(stepCreate.safeParse({ period: "morning", label: "Limpar" }).success, true);
  assert.equal(stepCreate.safeParse({ period: "morning", productId: "p1" }).success, true);
  assert.equal(stepCreate.safeParse({ period: "night", label: "x", frequency: "custom_days" }).success, false);
  assert.equal(stepCreate.safeParse({ period: "night", label: "x", frequency: "every_n_days" }).success, false);
  assert.equal(stepCreate.safeParse({ period: "tarde", label: "x" }).success, false);
  assert.equal(stepCreate.safeParse({ period: "night", label: "x", startDate: "2026-02-30" }).success, false);
});

test("stepUpdate/productCreate/checkInput validam formatos", () => {
  assert.equal(stepUpdate.safeParse({ active: false }).success, true);
  assert.equal(stepUpdate.safeParse({ frequency: "custom_days", daysOfWeek: [] }).success, false);
  assert.equal(productCreate.safeParse({ name: "X", status: "quebrado" }).success, false);
  assert.equal(productCreate.safeParse({ name: "X" }).success, true);
  assert.equal(checkInput.safeParse({ stepId: "s", date: "2026-11-11", done: true }).success, true);
  assert.equal(checkInput.safeParse({ stepId: "s", date: "11-11-2026", done: true }).success, false);
});
