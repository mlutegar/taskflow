import test from "node:test";
import assert from "node:assert/strict";
import { plannedForDate, summarize } from "./workouts.js";
import { workoutCreate, workoutUpdate, planCreate, planUpdate } from "./workoutValidation.js";

// 2026-11-09 seg(1), 10 ter(2), 11 qua(3), 14 sáb(6), 15 dom(0)
const plan = [
  { id: "p1", weekday: 1, type: "Musculação", durationMin: 60, order: 1 },
  { id: "p2", weekday: 1, type: "Corrida", durationMin: 30, order: 0 },
  { id: "p3", weekday: 3, type: "Yoga", durationMin: null, order: 0 },
  { id: "p4", weekday: 0, type: "Caminhada", durationMin: 45, order: 0 },
];

test("planejados do dia: só o dia da semana certo, ordenados", () => {
  const mon = plannedForDate(plan, [], "2026-11-09");
  assert.deepEqual(mon.map((p) => p.type), ["Corrida", "Musculação"]);
  assert.equal(plannedForDate(plan, [], "2026-11-10").length, 0); // terça
  assert.deepEqual(plannedForDate(plan, [], "2026-11-15").map((p) => p.type), ["Caminhada"]); // domingo = 0
  assert.equal(plannedForDate(plan, [], "2026-11-11")[0].durationMin, null);
});

test("item do plano vira feito quando há treino do dia com o planId", () => {
  const done = plannedForDate(plan, [{ id: "w1", planId: "p2" }, { id: "w2", planId: null }], "2026-11-09");
  assert.deepEqual(done.map((p) => [p.type, p.done, p.workoutId]), [
    ["Corrida", true, "w1"],
    ["Musculação", false, null],
  ]);
});

test("summarize soma contagem e minutos", () => {
  assert.deepEqual(summarize([{ durationMin: 30 }, { durationMin: 45 }]), { count: 2, totalMin: 75 });
  assert.deepEqual(summarize([]), { count: 0, totalMin: 0 });
});

test("validação de treino: data, tipo, duração e observações", () => {
  const ok = { date: "2026-11-11", type: "Corrida", durationMin: 30 };
  assert.equal(workoutCreate.safeParse(ok).success, true);
  assert.equal(workoutCreate.safeParse({ ...ok, date: "2026-02-30" }).success, false);
  assert.equal(workoutCreate.safeParse({ ...ok, type: "  " }).success, false);
  assert.equal(workoutCreate.safeParse({ ...ok, durationMin: 0 }).success, false);
  assert.equal(workoutCreate.safeParse({ ...ok, durationMin: 30.5 }).success, false);
  assert.equal(workoutCreate.safeParse({ ...ok, durationMin: 1441 }).success, false);
  assert.equal(workoutCreate.safeParse({ ...ok, notes: "x".repeat(1001) }).success, false);
  assert.equal(workoutUpdate.safeParse({ durationMin: 45 }).success, true);
});

test("validação do plano: dia da semana 0–6", () => {
  assert.equal(planCreate.safeParse({ weekday: 0, type: "Yoga" }).success, true);
  assert.equal(planCreate.safeParse({ weekday: 6, type: "Yoga", durationMin: 40 }).success, true);
  assert.equal(planCreate.safeParse({ weekday: 7, type: "Yoga" }).success, false);
  assert.equal(planCreate.safeParse({ weekday: -1, type: "Yoga" }).success, false);
  assert.equal(planCreate.safeParse({ weekday: 1, type: "" }).success, false);
  assert.equal(planUpdate.safeParse({ durationMin: null }).success, true);
});
