import test from "node:test";
import assert from "node:assert/strict";
import { applyWater, sortMeals } from "./nutrition.js";
import { mealCreate, mealUpdate, waterAdd, restockInput } from "./validation.js";

test("água: +1 soma, -1 desfaz e nunca fica negativa", () => {
  assert.equal(applyWater(0, 1), 1);
  assert.equal(applyWater(3, 1), 4);
  assert.equal(applyWater(4, -1), 3);
  assert.equal(applyWater(0, -1), 0);
  assert.equal(applyWater(2, -5), 0);
});

test("refeições ordenadas por tipo (café → jantar) e depois por horário", () => {
  const m = (type, time, description) => ({ type, time, description });
  const sorted = sortMeals([
    m("dinner", "20:00", "Sopa"),
    m("snack", "16:30", "Fruta"),
    m("breakfast", "08:00", "Pão"),
    m("snack", "10:00", "Iogurte"),
    m("lunch", "12:30", "Arroz"),
  ]);
  assert.deepEqual(sorted.map((x) => x.description), ["Pão", "Arroz", "Iogurte", "Fruta", "Sopa"]);
});

test("validação de refeição: tipo, hora, data e descrição", () => {
  const ok = { date: "2026-11-11", type: "lunch", time: "12:30", description: "Arroz e feijão" };
  assert.equal(mealCreate.safeParse(ok).success, true);
  assert.equal(mealCreate.safeParse({ ...ok, type: "brunch" }).success, false);
  assert.equal(mealCreate.safeParse({ ...ok, time: "25:00" }).success, false);
  assert.equal(mealCreate.safeParse({ ...ok, date: "2026-02-30" }).success, false);
  assert.equal(mealCreate.safeParse({ ...ok, description: "   " }).success, false);
  assert.equal(mealUpdate.safeParse({ time: "08:00" }).success, true);
  assert.equal(mealUpdate.safeParse({ time: "8h" }).success, false);
});

test("validação de água e reposição", () => {
  assert.equal(waterAdd.safeParse({ date: "2026-11-11", delta: 1 }).success, true);
  assert.equal(waterAdd.safeParse({ date: "2026-11-11", delta: -1 }).success, true);
  assert.equal(waterAdd.safeParse({ date: "2026-11-11", delta: 0 }).success, false);
  assert.equal(waterAdd.safeParse({ date: "2026-11-11", delta: 1.5 }).success, false);
  assert.equal(waterAdd.safeParse({ date: "11/11", delta: 1 }).success, false);
  assert.equal(restockInput.safeParse({ qty: 10 }).success, true);
  assert.equal(restockInput.safeParse({ qty: 0 }).success, false);
  assert.equal(restockInput.safeParse({ qty: -1 }).success, false);
});
