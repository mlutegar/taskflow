/** Testes de rota de Exercícios (SQLite temporário com migrations reais). */
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
const tmp = mkdtempSync(path.join(tmpdir(), "taskflow-workout-"));
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
  app.register((await import("./workouts.js")).default, { prefix: "/saude/workouts" });
  await app.ready();
});

after(async () => {
  await app?.close();
  await prisma?.$disconnect();
  rmSync(tmp, { recursive: true, force: true });
});

const inject = (method, url, token, payload) =>
  app.inject({ method, url, headers: token ? { authorization: `Bearer ${token}` } : {}, payload });
const W = "/saude/workouts";

test("todas as rotas exigem autenticação", async () => {
  for (const [m, u] of [
    ["GET", `${W}?from=2026-11-01&to=2026-11-30`], ["POST", W], ["PATCH", `${W}/x`], ["DELETE", `${W}/x`],
    ["GET", `${W}/plan`], ["POST", `${W}/plan`], ["PATCH", `${W}/plan/x`], ["DELETE", `${W}/plan/x`],
    ["GET", `${W}/today?date=2026-11-11`],
  ]) {
    assert.equal((await inject(m, u, null, {})).statusCode, 401, `${m} ${u}`);
  }
});

test("validação: data, duração, tipo, dia da semana e intervalo inválidos retornam 400", async () => {
  const t = tokenA();
  const w = { date: "2026-11-11", type: "Corrida", durationMin: 30 };
  assert.equal((await inject("POST", W, t, { ...w, date: "11/11/2026" })).statusCode, 400);
  assert.equal((await inject("POST", W, t, { ...w, durationMin: 0 })).statusCode, 400);
  assert.equal((await inject("POST", W, t, { ...w, durationMin: "30" })).statusCode, 400);
  assert.equal((await inject("POST", W, t, { ...w, type: "" })).statusCode, 400);
  assert.equal((await inject("POST", `${W}/plan`, t, { weekday: 8, type: "Yoga" })).statusCode, 400);
  assert.equal((await inject("GET", `${W}?from=2026-11-01`, t)).statusCode, 400);
  assert.equal((await inject("GET", `${W}?from=2026-11-30&to=2026-11-01`, t)).statusCode, 400);
  assert.equal((await inject("GET", `${W}/today?date=hoje`, t)).statusCode, 400);
});

test("treinos: criar, editar, listar por período com resumo e excluir", async () => {
  const t = tokenA();
  const mk = async (date, type, durationMin, notes) =>
    (await inject("POST", W, t, { date, type, durationMin, notes })).json();
  const a = await mk("2026-12-01", "Corrida", 30, "Parque");
  await mk("2026-12-03", "Musculação", 60);
  await mk("2026-12-20", "Yoga", 40); // fora do período

  const patched = await inject("PATCH", `${W}/${a.id}`, t, { durationMin: 35, notes: "" });
  assert.equal(patched.json().durationMin, 35);
  assert.equal(patched.json().notes, null);

  const res = (await inject("GET", `${W}?from=2026-12-01&to=2026-12-07`, t)).json();
  assert.equal(res.workouts.length, 2);
  assert.deepEqual(res.workouts.map((x) => x.date), ["2026-12-03", "2026-12-01"]); // mais recente primeiro
  assert.deepEqual(res.summary, { count: 2, totalMin: 95 });

  assert.equal((await inject("DELETE", `${W}/${a.id}`, t)).statusCode, 204);
  assert.equal((await inject("GET", `${W}?from=2026-12-01&to=2026-12-07`, t)).json().summary.count, 1);
});

test("plano: CRUD e 'hoje' mostra só os do dia da semana, marcando feitos", async () => {
  const t = tokenA();
  // 2026-11-09 é segunda (1)
  const musc = (await inject("POST", `${W}/plan`, t, { weekday: 1, type: "Musculação", durationMin: 60 })).json();
  const corr = (await inject("POST", `${W}/plan`, t, { weekday: 1, type: "Corrida", durationMin: 30 })).json();
  await inject("POST", `${W}/plan`, t, { weekday: 3, type: "Yoga" });
  assert.ok(musc.order < corr.order);

  const plan = (await inject("GET", `${W}/plan`, t)).json();
  assert.deepEqual(plan.map((p) => p.type), ["Musculação", "Corrida", "Yoga"]);

  let today = (await inject("GET", `${W}/today?date=2026-11-09`, t)).json();
  assert.deepEqual(today.planned.map((p) => [p.type, p.done]), [["Musculação", false], ["Corrida", false]]);
  assert.equal((await inject("GET", `${W}/today?date=2026-11-10`, t)).json().planned.length, 0); // terça

  // "Fiz": cria o treino com planId
  const did = await inject("POST", W, t, { date: "2026-11-09", type: "Musculação", durationMin: 50, planId: musc.id });
  assert.equal(did.statusCode, 201);
  today = (await inject("GET", `${W}/today?date=2026-11-09`, t)).json();
  assert.equal(today.planned.find((p) => p.planId === musc.id).done, true);
  assert.equal(today.planned.find((p) => p.planId === corr.id).done, false);
  assert.equal(today.workouts.length, 1);
  assert.equal(today.workouts[0].durationMin, 50); // editado antes de salvar

  // não duplica o mesmo item do plano no mesmo dia
  const dup = await inject("POST", W, t, { date: "2026-11-09", type: "Musculação", durationMin: 50, planId: musc.id });
  assert.equal(dup.statusCode, 409);

  // desfazer (apagar o treino) volta a pendente
  await inject("DELETE", `${W}/${did.json().id}`, t);
  today = (await inject("GET", `${W}/today?date=2026-11-09`, t)).json();
  assert.equal(today.planned.find((p) => p.planId === musc.id).done, false);

  // editar o plano
  const upd = await inject("PATCH", `${W}/plan/${corr.id}`, t, { durationMin: 40, weekday: 2 });
  assert.equal(upd.json().weekday, 2);
});

test("apagar item do plano não apaga treinos já feitos", async () => {
  const t = tokenA();
  const p = (await inject("POST", `${W}/plan`, t, { weekday: 5, type: "Natação", durationMin: 45 })).json();
  const w = (await inject("POST", W, t, { date: "2026-11-13", type: "Natação", durationMin: 45, planId: p.id })).json();
  assert.equal((await inject("DELETE", `${W}/plan/${p.id}`, t)).statusCode, 204);
  assert.ok(await prisma.workout.findUnique({ where: { id: w.id } }));
});

test("planId de outro usuário ou inexistente é rejeitado (400)", async () => {
  const p = (await inject("POST", `${W}/plan`, tokenA(), { weekday: 2, type: "Privado" })).json();
  const res = await inject("POST", W, tokenB(), { date: "2026-11-10", type: "x", durationMin: 10, planId: p.id });
  assert.equal(res.statusCode, 400);
  assert.equal((await inject("POST", W, tokenB(), { date: "2026-11-10", type: "x", durationMin: 10, planId: "nao-existe" })).statusCode, 400);
});

test("isolamento: usuário B não vê nem altera treinos e plano do A", async () => {
  const w = (await inject("POST", W, tokenA(), { date: "2027-01-05", type: "Privado", durationMin: 20 })).json();
  const p = (await inject("POST", `${W}/plan`, tokenA(), { weekday: 4, type: "Privado" })).json();

  const listB = (await inject("GET", `${W}?from=2027-01-01&to=2027-01-31`, tokenB())).json();
  assert.equal(listB.workouts.length, 0);
  assert.equal((await inject("GET", `${W}/plan`, tokenB())).json().some((x) => x.id === p.id), false);
  assert.equal((await inject("PATCH", `${W}/${w.id}`, tokenB(), { type: "hack" })).statusCode, 404);
  assert.equal((await inject("DELETE", `${W}/${w.id}`, tokenB())).statusCode, 404);
  assert.equal((await inject("PATCH", `${W}/plan/${p.id}`, tokenB(), { type: "hack" })).statusCode, 404);
  assert.equal((await inject("DELETE", `${W}/plan/${p.id}`, tokenB())).statusCode, 404);
  assert.equal((await prisma.workout.findUnique({ where: { id: w.id } })).type, "Privado");
});
