/** Testes de rota de Finanças (SQLite temporário com migrations reais). */
import test, { before, after } from "node:test";
import assert from "node:assert/strict";
import { execSync } from "node:child_process";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import Fastify from "fastify";
import jwt from "jsonwebtoken";

const backendDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../..");
const tmp = mkdtempSync(path.join(tmpdir(), "taskflow-finance-"));
process.env.DATABASE_URL = `file:${path.join(tmp, "test.db").replace(/\\/g, "/")}`;
process.env.JWT_SECRET = "test-secret";
process.env.NODE_ENV = "test";

let app;
let prisma;
const tokenA = () => jwt.sign({ userId: "user-a" }, "test-secret");
const tokenIso = () => jwt.sign({ userId: "user-iso" }, "test-secret");
const tokenB = () => jwt.sign({ userId: "user-b" }, "test-secret");

before(async () => {
  execSync("npx prisma migrate deploy", { cwd: backendDir, env: process.env, stdio: "ignore" });
  prisma = (await import(pathToFileURL(path.join(backendDir, "src/prisma.js")).href)).default;
  app = Fastify();
  app.setErrorHandler((error, _req, reply) => reply.status(error.statusCode ?? 500).send({ error: error.message }));
  app.register((await import("./categories.js")).default, { prefix: "/financas/categories" });
  app.register((await import("./entries.js")).default, { prefix: "/financas/entries" });
  app.register((await import("./series.js")).default, { prefix: "/financas/series" });
  app.register((await import("./summary.js")).default, { prefix: "/financas/summary" });
  await app.ready();
});

after(async () => {
  await app?.close();
  await prisma?.$disconnect();
  rmSync(tmp, { recursive: true, force: true });
});

const inject = (method, url, token, payload) =>
  app.inject({ method, url, headers: token ? { authorization: `Bearer ${token}` } : {}, payload });
const F = "/financas";

test("todas as rotas exigem autenticação", async () => {
  for (const [m, u] of [
    ["GET", `${F}/categories`], ["POST", `${F}/categories`], ["PATCH", `${F}/categories/x`], ["DELETE", `${F}/categories/x`],
    ["GET", `${F}/entries?month=2026-11`], ["POST", `${F}/entries`], ["PATCH", `${F}/entries/x`], ["DELETE", `${F}/entries/x`],
    ["GET", `${F}/series`], ["POST", `${F}/series`], ["PATCH", `${F}/series/x`], ["POST", `${F}/series/x/revise`],
    ["POST", `${F}/series/x/end`], ["PUT", `${F}/series/x/exceptions/2026-11`], ["GET", `${F}/summary?month=2026-11`],
  ]) {
    assert.equal((await inject(m, u, null, {})).statusCode, 401, `${m} ${u}`);
  }
});

test("categorias padrão são criadas e arquivar preserva o histórico", async () => {
  const list = (await inject("GET", `${F}/categories`, tokenA())).json();
  assert.ok(list.length >= 13);
  const cat = list.find((c) => c.kind === "expense");
  await inject("POST", `${F}/entries`, tokenA(), { type: "expense", amountCents: 1000, date: "2026-11-02", categoryId: cat.id });
  assert.equal((await inject("DELETE", `${F}/categories/${cat.id}`, tokenA())).statusCode, 204);
  assert.ok(!(await inject("GET", `${F}/categories`, tokenA())).json().some((c) => c.id === cat.id));
  const items = (await inject("GET", `${F}/entries?month=2026-11`, tokenA())).json();
  assert.equal(items.find((i) => i.amountCents === 1000).categoryId, cat.id);
});

test("lançamento: valida centavos, categoria de outro usuário e tipo", async () => {
  assert.equal((await inject("POST", `${F}/entries`, tokenA(), { type: "expense", amountCents: 12.5, date: "2026-11-02" })).statusCode, 400);
  const catB = (await inject("GET", `${F}/categories`, tokenB())).json().find((c) => c.kind === "expense");
  const r = await inject("POST", `${F}/entries`, tokenA(), { type: "expense", amountCents: 100, date: "2026-11-02", categoryId: catB.id });
  assert.equal(r.statusCode, 400);
  const inc = (await inject("GET", `${F}/categories`, tokenA())).json().find((c) => c.kind === "income");
  const r2 = await inject("POST", `${F}/entries`, tokenA(), { type: "expense", amountCents: 100, date: "2026-11-02", categoryId: inc.id });
  assert.equal(r2.statusCode, 400);
});

test("isolamento por usuário (lançamentos e séries)", async () => {
  const e = (await inject("POST", `${F}/entries`, tokenIso(), { type: "income", amountCents: 5000, date: "2026-10-05" })).json();
  const s = (await inject("POST", `${F}/series`, tokenIso(), { type: "expense", kind: "monthly", amountCents: 2000, startDate: "2026-10-05" })).json();
  assert.equal((await inject("PATCH", `${F}/entries/${e.id}`, tokenB(), { amountCents: 1 })).statusCode, 404);
  assert.equal((await inject("DELETE", `${F}/entries/${e.id}`, tokenB())).statusCode, 404);
  assert.equal((await inject("POST", `${F}/series/${s.id}/end`, tokenB(), { fromMonth: "2026-11" })).statusCode, 404);
  assert.equal((await inject("POST", `${F}/series/${s.id}/revise`, tokenB(), { effectiveMonth: "2026-11", amountCents: 1 })).statusCode, 404);
  assert.equal((await inject("GET", `${F}/entries?month=2026-10`, tokenB())).json().length, 0);
  const sum = (await inject("GET", `${F}/summary?month=2026-10`, tokenB())).json();
  assert.equal(sum.incomeCents, 0);
  assert.equal(sum.expenseCents, 0);
});

test("revisar recorrente não reescreve meses passados; encerrar e pular funcionam", async () => {
  const tk = tokenA();
  const s = (await inject("POST", `${F}/series`, tk, { type: "expense", kind: "monthly", amountCents: 5000, startDate: "2027-01-10", description: "Academia" })).json();
  const rev = await inject("POST", `${F}/series/${s.id}/revise`, tk, { effectiveMonth: "2027-04", amountCents: 7000 });
  assert.equal(rev.statusCode, 201);
  const amt = async (m) => (await inject("GET", `${F}/entries?month=${m}`, tk)).json().filter((i) => i.description === "Academia").map((i) => i.amountCents);
  assert.deepEqual(await amt("2027-03"), [5000]);
  assert.deepEqual(await amt("2027-04"), [7000]);
  assert.deepEqual(await amt("2027-08"), [7000]);

  // pular um mês: some dos totais
  const novo = rev.json();
  await inject("PUT", `${F}/series/${novo.id}/exceptions/2027-05`, tk, { skipped: true });
  const may = (await inject("GET", `${F}/entries?month=2027-05`, tk)).json().find((i) => i.description === "Academia");
  assert.equal(may.skipped, true);
  assert.equal((await inject("GET", `${F}/summary?month=2027-05`, tk)).json().expenseCents, 0);

  // encerrar a partir de 2027-07: junho continua, julho não
  await inject("POST", `${F}/series/${novo.id}/end`, tk, { fromMonth: "2027-07" });
  assert.deepEqual(await amt("2027-06"), [7000]);
  assert.deepEqual(await amt("2027-07"), []);
  assert.deepEqual(await amt("2027-02"), [5000]);
});

test("parcelado: 3x aparece com índice, parcelas não aceitam revisão", async () => {
  const tk = tokenA();
  const s = (await inject("POST", `${F}/series`, tk, { type: "expense", kind: "installment", amountCents: 10000, installments: 3, startDate: "2027-09-15", description: "Notebook" })).json();
  const get = async (m) => (await inject("GET", `${F}/entries?month=${m}`, tk)).json().find((i) => i.description === "Notebook");
  assert.equal((await get("2027-09")).amountCents, 3334);
  const second = await get("2027-10");
  assert.equal(second.installmentIndex, 2);
  assert.equal(second.installmentTotal, 3);
  assert.equal(await get("2027-12"), undefined);
  assert.equal((await inject("POST", `${F}/series/${s.id}/revise`, tk, { effectiveMonth: "2027-10", amountCents: 1 })).statusCode, 400);
});

test("summary compara com o mês anterior", async () => {
  const tk = tokenA();
  await inject("POST", `${F}/entries`, tk, { type: "expense", amountCents: 20000, date: "2028-02-03" });
  await inject("POST", `${F}/entries`, tk, { type: "expense", amountCents: 10000, date: "2028-01-03" });
  await inject("POST", `${F}/entries`, tk, { type: "income", amountCents: 50000, date: "2028-02-05" });
  const s = (await inject("GET", `${F}/summary?month=2028-02`, tk)).json();
  assert.equal(s.expenseCents, 20000);
  assert.equal(s.balanceCents, 30000);
  assert.equal(s.previous.expenseCents, 10000);
  assert.equal(s.delta.expensePct, 100);
  assert.equal((await inject("GET", `${F}/summary?month=2028-13`, tk)).statusCode, 400);
});
