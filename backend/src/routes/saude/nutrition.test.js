/** Testes de rota de Alimentação (SQLite temporário com migrations reais). */
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
const tmp = mkdtempSync(path.join(tmpdir(), "taskflow-food-"));
process.env.DATABASE_URL = `file:${path.join(tmp, "test.db").replace(/\\/g, "/")}`;
process.env.JWT_SECRET = "test-secret";
process.env.NODE_ENV = "test";

let app;
let prisma;
const tokenA = () => jwt.sign({ userId: "user-a" }, "test-secret");
const tokenB = () => jwt.sign({ userId: "user-b" }, "test-secret");

before(async () => {
  execSync("npx prisma migrate deploy", { cwd: backendDir, env: process.env, stdio: "ignore" });
  prisma = (await import(pathToFileURL(path.join(backendDir, "src/prisma.js")).href)).default;
  app = Fastify();
  app.setErrorHandler((error, _req, reply) => reply.status(error.statusCode ?? 500).send({ error: error.message }));
  app.register((await import("./nutrition.js")).default, { prefix: "/saude/nutrition" });
  await app.ready();
});

after(async () => {
  await app?.close();
  await prisma?.$disconnect();
  rmSync(tmp, { recursive: true, force: true });
});

const inject = (method, url, token, payload) =>
  app.inject({ method, url, headers: token ? { authorization: `Bearer ${token}` } : {}, payload });
const N = "/saude/nutrition";
const D = "2026-11-11";

test("todas as rotas exigem autenticação", async () => {
  for (const [m, u] of [
    ["GET", `${N}/meals?date=${D}`], ["POST", `${N}/meals`], ["PATCH", `${N}/meals/x`], ["DELETE", `${N}/meals/x`],
    ["GET", `${N}/water?date=${D}`], ["POST", `${N}/water/add`],
  ]) {
    assert.equal((await inject(m, u, null, {})).statusCode, 401, `${m} ${u}`);
  }
});

test("validação: data, hora, tipo, descrição e delta inválidos retornam 400", async () => {
  const t = tokenA();
  const meal = { date: D, type: "lunch", time: "12:30", description: "Arroz" };
  assert.equal((await inject("POST", `${N}/meals`, t, { ...meal, date: "11/11/2026" })).statusCode, 400);
  assert.equal((await inject("POST", `${N}/meals`, t, { ...meal, time: "9h" })).statusCode, 400);
  assert.equal((await inject("POST", `${N}/meals`, t, { ...meal, type: "brunch" })).statusCode, 400);
  assert.equal((await inject("POST", `${N}/meals`, t, { ...meal, description: "" })).statusCode, 400);
  assert.equal((await inject("GET", `${N}/meals`, t)).statusCode, 400);
  assert.equal((await inject("GET", `${N}/water?date=hoje`, t)).statusCode, 400);
  assert.equal((await inject("POST", `${N}/water/add`, t, { date: D, delta: 0 })).statusCode, 400);
  assert.equal((await inject("POST", `${N}/water/add`, t, { date: D, delta: 1.5 })).statusCode, 400);
});

test("refeições: criar, listar ordenado por tipo/horário, editar e excluir", async () => {
  const t = tokenA();
  const mk = async (type, time, description) =>
    (await inject("POST", `${N}/meals`, t, { date: D, type, time, description })).json();
  await mk("dinner", "20:00", "Sopa");
  const cafe = await mk("breakfast", "08:00", "Pão com ovo");
  await mk("lunch", "12:30", "Arroz e feijão");
  await mk("snack", "16:00", "Fruta");

  const list = (await inject("GET", `${N}/meals?date=${D}`, t)).json();
  assert.deepEqual(list.map((m) => m.type), ["breakfast", "lunch", "snack", "dinner"]);

  const patched = await inject("PATCH", `${N}/meals/${cafe.id}`, t, { description: "Pão com queijo", time: "07:45" });
  assert.equal(patched.json().description, "Pão com queijo");
  assert.equal(patched.json().time, "07:45");

  assert.equal((await inject("DELETE", `${N}/meals/${cafe.id}`, t)).statusCode, 204);
  assert.equal((await inject("GET", `${N}/meals?date=${D}`, t)).json().length, 3);
  assert.equal((await inject("GET", `${N}/meals?date=2026-11-12`, t)).json().length, 0); // outro dia não mistura
});

test("isolamento: usuário B não vê nem altera refeições e água do A", async () => {
  const meal = (await inject("POST", `${N}/meals`, tokenA(), { date: "2026-11-20", type: "lunch", time: "12:00", description: "Privado" })).json();
  await inject("POST", `${N}/water/add`, tokenA(), { date: "2026-11-20", delta: 3 });

  assert.equal((await inject("GET", `${N}/meals?date=2026-11-20`, tokenB())).json().length, 0);
  assert.equal((await inject("PATCH", `${N}/meals/${meal.id}`, tokenB(), { description: "hack" })).statusCode, 404);
  assert.equal((await inject("DELETE", `${N}/meals/${meal.id}`, tokenB())).statusCode, 404);
  assert.equal((await inject("GET", `${N}/water?date=2026-11-20`, tokenB())).json().count, 0);
  assert.equal((await inject("GET", `${N}/water?date=2026-11-20`, tokenA())).json().count, 3);
  assert.equal((await prisma.meal.findUnique({ where: { id: meal.id } })).description, "Privado");
});

test("água: dia sem registro = 0; +1 acumula; -1 desfaz; nunca negativa; dias separados", async () => {
  const t = tokenA();
  const date = "2026-11-25";
  const add = (delta, d = date) => inject("POST", `${N}/water/add`, t, { date: d, delta }).then((r) => r.json());

  const empty = (await inject("GET", `${N}/water?date=${date}`, t)).json();
  assert.equal(empty.count, 0);
  assert.equal(empty.totalMl, 0);
  assert.equal(empty.goalGlasses, 8);

  assert.equal((await add(1)).count, 1);
  const two = await add(1);
  assert.equal(two.count, 2);
  assert.equal(two.totalMl, 500);
  assert.equal((await add(-1)).count, 1);
  assert.equal((await add(-1)).count, 0);
  assert.equal((await add(-1)).count, 0); // não fica negativa
  assert.equal((await add(1, "2026-11-26")).count, 1); // outro dia
  assert.equal((await inject("GET", `${N}/water?date=${date}`, t)).json().count, 0);
  assert.equal(await prisma.waterLog.count({ where: { userId: "user-a", date } }), 1); // um registro por dia
});
