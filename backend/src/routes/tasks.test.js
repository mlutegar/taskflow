import test from "node:test";
import assert from "node:assert/strict";
import { computeNextDueDate, dateInTimeZone, isBrazilianHoliday } from "../taskRecurrence.js";
import { isVersionConflict } from "../taskVersion.js";
import { bucketOf, estimatedTimeWhere, TIME_BUCKET_BOUNDS } from "../taskEstimatedTime.js";

test("sem versão enviada nunca há conflito (retrocompatível)", () => {
  assert.equal(isVersionConflict(5, undefined), false);
});

test("versões iguais não conflitam", () => {
  assert.equal(isVersionConflict(5, 5), false);
});

test("versão defasada gera conflito", () => {
  assert.equal(isVersionConflict(6, 5), true);
});

test("recorrência diária concluída hoje fica agendada para amanhã", () => {
  const now = new Date("2026-09-15T15:00:00");
  assert.equal(computeNextDueDate("2026-09-15", "daily", {}, now), "2026-09-16");
});

test("recorrência diária atrasada também vai para amanhã", () => {
  const now = new Date("2026-09-15T15:00:00");
  assert.equal(computeNextDueDate("2026-09-10", "daily", {}, now), "2026-09-16");
});

test("recorrência futura preserva a cadência a partir da data agendada", () => {
  const now = new Date("2026-09-15T15:00:00");
  assert.equal(computeNextDueDate("2026-09-20", "weekly", {}, now), "2026-09-27");
});

test("dias úteis pula o fim de semana", () => {
  const friday = new Date("2026-09-18T15:00:00Z");
  assert.equal(computeNextDueDate("2026-09-18", "weekdays", {}, friday), "2026-09-21");
});

test("intervalo personalizado respeita quantidade de dias", () => {
  const now = new Date("2026-09-15T15:00:00Z");
  assert.equal(computeNextDueDate("2026-09-15", "custom", { type: "interval", intervalDays: 3 }, now), "2026-09-18");
});

test("dias específicos encontra o próximo dia selecionado", () => {
  const tuesday = new Date("2026-09-15T15:00:00Z");
  assert.equal(computeNextDueDate("2026-09-15", "custom", { type: "weekdays", weekdays: [1, 3, 5] }, tuesday), "2026-09-16");
});

test("pular feriados move para o próximo dia", () => {
  const now = new Date("2026-12-24T15:00:00Z");
  assert.equal(isBrazilianHoliday("2026-12-25"), true);
  assert.equal(computeNextDueDate("2026-12-24", "daily", { skipHolidays: true }, now), "2026-12-26");
});

test("data do usuário respeita o fuso horário", () => {
  const instant = new Date("2026-09-16T01:00:00Z");
  assert.equal(dateInTimeZone(instant, "America/Sao_Paulo"), "2026-09-15");
});

// ── Recorrência anual ───────────────────────────────────────────────────────
test("recorrência anual avança um ano", () => {
  const now = new Date("2026-10-13T15:00:00");
  assert.equal(computeNextDueDate("2026-10-13", "yearly", {}, now), "2027-10-13");
});

test("recorrência anual em 29/02 cai em 28/02 em ano não bissexto", () => {
  const now = new Date("2024-02-29T15:00:00");
  assert.equal(computeNextDueDate("2024-02-29", "yearly", {}, now), "2025-02-28");
});

test("recorrência anual em 29/02 mantém 29/02 em próximo ano bissexto", () => {
  const now = new Date("2027-02-28T15:00:00");
  assert.equal(computeNextDueDate("2028-02-29", "yearly", {}, now), "2029-02-28");
});

test("recorrência anual em 31/12 vira 31/12 do ano seguinte", () => {
  const now = new Date("2026-12-31T15:00:00");
  assert.equal(computeNextDueDate("2026-12-31", "yearly", {}, now), "2027-12-31");
});

test("recorrência anual atrasada agenda a partir de hoje", () => {
  const now = new Date("2026-10-15T15:00:00");
  const old = "2025-10-13";
  const next = computeNextDueDate(old, "yearly", {}, now);
  assert.equal(next, "2027-10-15");
});

test("recorrência mensal ainda funciona após adicionar yearly", () => {
  const now = new Date("2026-10-13T15:00:00");
  assert.equal(computeNextDueDate("2026-10-13", "monthly", {}, now), "2026-11-13");
});

test("recorrência anual em 31/01 mantém 31/01", () => {
  const now = new Date("2026-01-31T15:00:00");
  assert.equal(computeNextDueDate("2026-01-31", "yearly", {}, now), "2027-01-31");
});

test("recorrência anual respeita último dia do mês", () => {
  const now = new Date("2026-05-31T15:00:00");
  assert.equal(computeNextDueDate("2026-05-31", "yearly", {}, now), "2027-05-31");
});

// ── Tempo estimado: faixas ──────────────────────────────────────────────────
test("bucketOf classifica pelos limites (inclusivos no topo)", () => {
  assert.equal(bucketOf(null), null);
  assert.equal(bucketOf(1), "fast");
  assert.equal(bucketOf(TIME_BUCKET_BOUNDS.fast), "fast");        // 15 → fast
  assert.equal(bucketOf(TIME_BUCKET_BOUNDS.fast + 1), "medium");  // 16 → medium
  assert.equal(bucketOf(TIME_BUCKET_BOUNDS.medium), "medium");    // 60 → medium
  assert.equal(bucketOf(TIME_BUCKET_BOUNDS.medium + 1), "long");  // 61 → long
});

test("estimatedTimeWhere devolve fragmentos coerentes por faixa", () => {
  assert.deepEqual(estimatedTimeWhere("fast"), { not: null, lte: 15 });
  assert.deepEqual(estimatedTimeWhere("medium"), { gt: 15, lte: 60 });
  assert.deepEqual(estimatedTimeWhere("long"), { gt: 60 });
  assert.equal(estimatedTimeWhere("none"), null);
  assert.equal(estimatedTimeWhere("qualquer"), undefined);
});
