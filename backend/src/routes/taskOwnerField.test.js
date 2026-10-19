/**
 * Guard contra o bug "createdBy vs userId".
 *
 * O schema usa nomes de dono DIFERENTES por model:
 *   Task              → createdBy  (coluna created_by)
 *   TaskCompletion    → userId     (coluna user_id)
 *   TaskChange        → userId     (coluna user_id)
 *   UserPreferences   → userId     (coluna user_id)
 *
 * Usar `createdBy` num model que só conhece `userId` não quebra o build nem os
 * testes de unidade — só estoura em runtime como PrismaClientValidationError
 * ("Unknown argument `createdBy`" / "Argument `userId` is missing"), derrubando
 * todo o fluxo de conclusão de tarefas. Aconteceu de verdade; estes testes
 * fazem a divergência falhar no `npm test`.
 */

import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { Prisma } from "@prisma/client";

const here = dirname(fileURLToPath(import.meta.url));

/** Nomes de campo escalares de um model, lidos do client realmente gerado. */
function fieldsOf(modelName) {
  const model = Prisma.dmmf.datamodel.models.find((m) => m.name === modelName);
  assert.ok(model, `model ${modelName} não existe no Prisma Client gerado`);
  return new Set(model.fields.map((f) => f.name));
}

const OWNER_IS_USER_ID = ["TaskCompletion", "TaskChange", "UserPreferences"];

test("Task continua usando createdBy como dono", () => {
  const fields = fieldsOf("Task");
  assert.ok(fields.has("createdBy"), "Task deveria ter createdBy");
  assert.ok(!fields.has("userId"), "Task não deveria ter userId");
});

for (const modelName of OWNER_IS_USER_ID) {
  test(`${modelName} usa userId (e não createdBy) como dono`, () => {
    const fields = fieldsOf(modelName);
    assert.ok(fields.has("userId"), `${modelName} deveria ter userId`);
    assert.ok(!fields.has("createdBy"), `${modelName} não deveria ter createdBy`);
  });
}

/**
 * Varredura do código: nenhuma linha que fale com um desses models/helpers pode
 * mencionar `createdBy`. Pega o erro no lugar onde ele é escrito, não só no
 * schema.
 */
test("rotas não passam createdBy para models cujo dono é userId", () => {
  const source = readFileSync(join(here, "tasks.js"), "utf8");
  const lines = source.split(/\r?\n/);

  // Chamadas que se estendem por várias linhas (ex.: recordTaskChange({\n ... }))
  // são cobertas olhando uma janela de linhas após a abertura.
  const OPENERS = /prisma\.taskCompletion\.|tx\.taskCompletion\.|prisma\.taskChange\.|tx\.taskChange\.|prisma\.userPreferences\.|recordTaskChange\(\{/;
  const offenders = [];

  lines.forEach((line, i) => {
    if (!OPENERS.test(line)) return;
    // olha a própria linha + as 8 seguintes (tamanho folgado para os objetos de data/where)
    const window = lines.slice(i, i + 9);
    let depth = 0;
    for (const [offset, current] of window.entries()) {
      if (current.includes("createdBy")) {
        offenders.push(`linha ${i + 1 + offset}: ${current.trim()}`);
      }
      depth += (current.match(/[({[]/g) ?? []).length;
      depth -= (current.match(/[)}\]]/g) ?? []).length;
      if (offset > 0 && depth <= 0) break; // fim da chamada
    }
  });

  assert.deepEqual(
    offenders,
    [],
    `createdBy usado onde o model espera userId:\n${offenders.join("\n")}`,
  );
});

test("recordTaskChange é sempre chamado com userId", () => {
  const source = readFileSync(join(here, "tasks.js"), "utf8");
  const calls = source.match(/recordTaskChange\(\{[^}]*/g) ?? [];
  assert.ok(calls.length > 0, "esperava encontrar chamadas de recordTaskChange");
  for (const call of calls) {
    assert.ok(
      /\buserId\s*:/.test(call),
      `chamada sem userId: ${call.slice(0, 120)}`,
    );
  }
});
