import { test } from "node:test";
import assert from "node:assert/strict";
import { extractJson, coerceType } from "./ai.js";

test("extractJson: JSON puro", () => {
  assert.deepEqual(extractJson('{"name":"Foco","steps":["a","b"]}'), {
    name: "Foco",
    steps: ["a", "b"],
  });
});

test("extractJson: JSON dentro de cerca ```json", () => {
  const text = "Claro! Aqui está:\n```json\n{\"name\":\"Deep Work\"}\n```\nEspero ter ajudado.";
  assert.deepEqual(extractJson(text), { name: "Deep Work" });
});

test("extractJson: JSON com texto ao redor (sem cerca)", () => {
  const text = 'Segue o modo: {"name":"Ritual","tips":"beba água"} — pronto!';
  assert.deepEqual(extractJson(text), { name: "Ritual", tips: "beba água" });
});

test("extractJson: objeto aninhado usa o último fecha-chave", () => {
  const text = 'ok {"a":1,"b":{"c":2}} fim';
  assert.deepEqual(extractJson(text), { a: 1, b: { c: 2 } });
});

test("extractJson: resposta sem JSON retorna null", () => {
  assert.equal(extractJson("Desculpe, não entendi."), null);
});

test("extractJson: JSON inválido retorna null", () => {
  assert.equal(extractJson('{"name": faltando aspas}'), null);
});

test("extractJson: entradas não-string retornam null", () => {
  assert.equal(extractJson(null), null);
  assert.equal(extractJson(undefined), null);
  assert.equal(extractJson(42), null);
});

test("coerceType: valores válidos passam direto", () => {
  assert.equal(coerceType("durante"), "durante");
  assert.equal(coerceType("entre"), "entre");
  assert.equal(coerceType(" ENTRE "), "entre");
});

test("coerceType: mapeia valores livres para 'durante'", () => {
  assert.equal(coerceType("productivity-mode"), "durante");
  assert.equal(coerceType("focus"), "durante");
  assert.equal(coerceType("deep work"), "durante");
  assert.equal(coerceType("fluxo"), "durante");
});

test("coerceType: mapeia valores livres para 'entre'", () => {
  assert.equal(coerceType("break"), "entre");
  assert.equal(coerceType("pausa"), "entre");
  assert.equal(coerceType("transition"), "entre");
});

test("coerceType: desconhecido/entradas inválidas → undefined", () => {
  assert.equal(coerceType("xyz"), undefined);
  assert.equal(coerceType(""), undefined);
  assert.equal(coerceType(null), undefined);
  assert.equal(coerceType(123), undefined);
});
