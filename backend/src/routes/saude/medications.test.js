/**
 * Testes de rota de Saúde/Remédios com banco SQLite temporário (migrations reais via
 * `prisma migrate deploy`) e Fastify.inject. Cobre: auth, isolamento entre usuários,
 * validação, estoque, histórico preservado e DELETE com confirmação.
 */
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
const tmp = mkdtempSync(path.join(tmpdir(), "taskflow-saude-"));
const dbFile = path.join(tmp, "test.db").replace(/\\/g, "/");
process.env.DATABASE_URL = `file:${dbFile}`;
process.env.JWT_SECRET = "test-secret";
process.env.NODE_ENV = "test";

let app;
let prisma;
const tokenA = () => jwt.sign({ userId: "user-a" }, "test-secret");
const tokenB = () => jwt.sign({ userId: "user-b" }, "test-secret");
const authH = (t) => ({ authorization: `Bearer ${t}` });

before(async () => {
  execSync("npx prisma migrate deploy", { cwd: backendDir, env: process.env, stdio: "ignore" });
  prisma = (await import(pathToFileURL(path.join(backendDir, "src/prisma.js")).href)).default;
  const routes = (await import("./medications.js")).default;
  app = Fastify();
  app.setErrorHandler((error, _req, reply) => reply.status(error.statusCode ?? 500).send({ error: error.message }));
  app.register(routes, { prefix: "/saude/medications" });
  await app.ready();
});

after(async () => {
  await app?.close();
  await prisma?.$disconnect();
  rmSync(tmp, { recursive: true, force: true });
});

const inject = (method, url, token, payload) =>
  app.inject({ method, url, headers: token ? authH(token) : {}, payload });

async function createMed(token, over = {}) {
  const res = await inject("POST", "/saude/medications", token, {
    name: "Losartana",
    dose: "50mg",
    startDate: "2026-11-01",
    stockQty: 10,
    lowStockThreshold: 3,
    schedules: [{ time: "08:00", doseQty: 1 }, { time: "20:00", doseQty: 2 }],
    ...over,
  });
  assert.equal(res.statusCode, 201, res.body);
  return res.json();
}

test("todas as rotas exigem autenticação (401 sem token)", async () => {
  for (const [m, u] of [
    ["GET", "/saude/medications"],
    ["POST", "/saude/medications"],
    ["GET", "/saude/medications/today?date=2026-11-11"],
    ["PUT", "/saude/medications/intakes"],
    ["GET", "/saude/medications/history?from=2026-11-01&to=2026-11-30"],
    ["PATCH", "/saude/medications/x"],
    ["DELETE", "/saude/medications/x?confirm=true"],
  ]) {
    assert.equal((await inject(m, u, null, {})).statusCode, 401, `${m} ${u}`);
  }
  assert.equal((await inject("GET", "/saude/medications", "token-ruim")).statusCode, 401);
});

test("validação: data/horário inválidos retornam 400", async () => {
  const bad = (over) => inject("POST", "/saude/medications", tokenA(), { name: "X", startDate: "2026-11-01", ...over });
  assert.equal((await bad({ startDate: "01/11/2026" })).statusCode, 400);
  assert.equal((await bad({ startDate: "2026-02-30" })).statusCode, 400);
  assert.equal((await bad({ schedules: [{ time: "25:00" }] })).statusCode, 400);
  assert.equal((await bad({ frequency: "every_n_days" })).statusCode, 400);
  assert.equal((await inject("GET", "/saude/medications/today?date=hoje", tokenA())).statusCode, 400);
  assert.equal((await inject("GET", "/saude/medications/today", tokenA())).statusCode, 400);
  assert.equal((await inject("PUT", "/saude/medications/intakes", tokenA(), { scheduleId: "s", date: "2026-11-11", status: "x" })).statusCode, 400);
});

test("isolamento: usuário B não vê nem altera remédios do usuário A", async () => {
  const med = await createMed(tokenA(), { name: "Privado" });
  const listB = (await inject("GET", "/saude/medications", tokenB())).json();
  assert.equal(listB.some((m) => m.id === med.id), false);
  assert.equal((await inject("PATCH", `/saude/medications/${med.id}`, tokenB(), { name: "hack" })).statusCode, 404);
  assert.equal((await inject("DELETE", `/saude/medications/${med.id}?confirm=true`, tokenB())).statusCode, 404);
  const put = await inject("PUT", "/saude/medications/intakes", tokenB(), {
    scheduleId: med.schedules[0].id, date: "2026-11-11", status: "taken",
  });
  assert.equal(put.statusCode, 404);
  const todayB = (await inject("GET", "/saude/medications/today?date=2026-11-11", tokenB())).json();
  assert.equal(todayB.items.length, 0);
});

test("tomei baixa o estoque com a dose do horário; desmarcar devolve; nunca negativo", async () => {
  const med = await createMed(tokenA(), { name: "Estoque", stockQty: 2 });
  const [manha, noite] = med.schedules; // 08:00 (1), 20:00 (2)
  const put = (scheduleId, status) =>
    inject("PUT", "/saude/medications/intakes", tokenA(), { scheduleId, date: "2026-11-11", status }).then((r) => r.json());

  let r = await put(manha.id, "taken");
  assert.equal(r.stockQty, 1);
  assert.equal(r.intake.doseQty, 1);

  r = await put(manha.id, "taken"); // idempotente
  assert.equal(r.stockQty, 1);

  r = await put(noite.id, "taken"); // dose 2 com estoque 1 → fica em 0, não negativo
  assert.equal(r.stockQty, 0);
  assert.equal(r.lowStock, true);

  r = await put(manha.id, "pending"); // desmarca: devolve 1
  assert.equal(r.stockQty, 1);
  assert.equal(r.status, "pending");

  const today = (await inject("GET", "/saude/medications/today?date=2026-11-11", tokenA())).json();
  const item = today.items.find((i) => i.scheduleId === manha.id);
  assert.equal(item.status, "pending");
});

test("trocar a dose do horário não reescreve o intake antigo; taken→skipped devolve o doseQty registrado", async () => {
  const med = await createMed(tokenA(), { name: "Dose", stockQty: 10, schedules: [{ time: "09:00", doseQty: 2 }] });
  const sid = med.schedules[0].id;
  const put = (status) =>
    inject("PUT", "/saude/medications/intakes", tokenA(), { scheduleId: sid, date: "2026-11-11", status }).then((r) => r.json());

  assert.equal((await put("taken")).stockQty, 8);

  // muda a dose e o horário do schedule para 1 / 10:30
  const patched = await inject("PATCH", `/saude/medications/${med.id}`, tokenA(), {
    schedules: [{ id: sid, time: "10:30", doseQty: 1 }],
  });
  assert.equal(patched.statusCode, 200);

  const r = await put("skipped"); // devolve 2 (valor do intake), não 1
  assert.equal(r.stockQty, 10);
  assert.equal(r.intake.scheduledTime, "09:00"); // snapshot preservado
  assert.equal(r.intake.doseQty, 2);
});

test("remover horário = active=false: histórico (intakes) permanece", async () => {
  const med = await createMed(tokenA(), { name: "Hist", schedules: [{ time: "07:00", doseQty: 1 }, { time: "19:00", doseQty: 1 }] });
  const [a, b] = med.schedules;
  await inject("PUT", "/saude/medications/intakes", tokenA(), { scheduleId: a.id, date: "2026-11-10", status: "taken" });

  const res = await inject("PATCH", `/saude/medications/${med.id}`, tokenA(), {
    schedules: [{ id: b.id, time: "19:00", doseQty: 1 }, { time: "21:00", doseQty: 1 }],
  });
  const updated = res.json();
  assert.deepEqual(updated.schedules.map((s) => s.time), ["19:00", "21:00"]);

  const dbA = await prisma.medicationSchedule.findUnique({ where: { id: a.id } });
  assert.equal(dbA.active, false); // não foi apagado
  const hist = (await inject("GET", `/saude/medications/history?from=2026-11-10&to=2026-11-10&medicationId=${med.id}`, tokenA())).json();
  assert.equal(hist.length, 1);
  assert.equal(hist[0].scheduledTime, "07:00");
  assert.equal(hist[0].status, "taken");
});

test("arquivar (active=false) esconde da lista e do dia, mas mantém o histórico", async () => {
  const med = await createMed(tokenA(), { name: "Arquivar" });
  await inject("PUT", "/saude/medications/intakes", tokenA(), { scheduleId: med.schedules[0].id, date: "2026-11-09", status: "taken" });
  assert.equal((await inject("PATCH", `/saude/medications/${med.id}`, tokenA(), { active: false })).statusCode, 200);

  const list = (await inject("GET", "/saude/medications", tokenA())).json();
  assert.equal(list.some((m) => m.id === med.id), false);
  const all = (await inject("GET", "/saude/medications?includeArchived=true", tokenA())).json();
  assert.equal(all.find((m) => m.id === med.id)?.active, false);
  const today = (await inject("GET", "/saude/medications/today?date=2026-11-11", tokenA())).json();
  assert.equal(today.items.some((i) => i.medicationId === med.id), false);
  const hist = (await inject("GET", `/saude/medications/history?from=2026-11-09&to=2026-11-09&medicationId=${med.id}`, tokenA())).json();
  assert.equal(hist.length, 1);
});

test("hoje respeita a frequência (every_n_days com âncora no startDate)", async () => {
  const med = await createMed(tokenA(), {
    name: "A cada 3", frequency: "every_n_days", intervalDays: 3, startDate: "2026-11-02",
    schedules: [{ time: "12:00", doseQty: 1 }],
  });
  const has = async (date) =>
    (await inject("GET", `/saude/medications/today?date=${date}`, tokenA())).json().items.some((i) => i.medicationId === med.id);
  assert.equal(await has("2026-11-02"), true);
  assert.equal(await has("2026-11-03"), false);
  assert.equal(await has("2026-11-05"), true);
  assert.equal(await has("2026-11-01"), false); // antes do início
});

test("DELETE exige confirmação explícita e apaga o histórico junto", async () => {
  const med = await createMed(tokenA(), { name: "Apagar" });
  await inject("PUT", "/saude/medications/intakes", tokenA(), { scheduleId: med.schedules[0].id, date: "2026-11-08", status: "taken" });

  const sem = await inject("DELETE", `/saude/medications/${med.id}`, tokenA());
  assert.equal(sem.statusCode, 400);
  assert.match(sem.json().error, /hist[óo]rico/i);
  assert.ok(await prisma.medication.findUnique({ where: { id: med.id } }));

  assert.equal((await inject("DELETE", `/saude/medications/${med.id}?confirm=true`, tokenA())).statusCode, 204);
  assert.equal(await prisma.medication.findUnique({ where: { id: med.id } }), null);
  assert.equal(await prisma.medicationIntake.count({ where: { medicationId: med.id } }), 0);
  assert.equal(await prisma.medicationSchedule.count({ where: { medicationId: med.id } }), 0);
});

test("lista informa lowStock e daysLeft", async () => {
  const med = await createMed(tokenA(), { name: "Acabando", stockQty: 3, lowStockThreshold: 5, schedules: [{ time: "08:00", doseQty: 1 }] });
  const found = (await inject("GET", "/saude/medications", tokenA())).json().find((m) => m.id === med.id);
  assert.equal(found.lowStock, true);
  assert.equal(typeof found.daysLeft, "number");
});

test("restock: soma ao estoque, exige quantidade > 0, 404 para outro usuário, 401 sem token", async () => {
  const med = await createMed(tokenA(), { name: "Repor", stockQty: 2 });
  const url = `/saude/medications/${med.id}/restock`;

  const ok = await inject("POST", url, tokenA(), { qty: 30 });
  assert.equal(ok.statusCode, 200);
  assert.equal(ok.json().stockQty, 32);
  assert.equal(ok.json().lowStock, false);

  const dec = await inject("POST", url, tokenA(), { qty: 0.5 }); // fracionado permitido
  assert.equal(dec.json().stockQty, 32.5);

  for (const qty of [0, -3, "10", null, undefined]) {
    assert.equal((await inject("POST", url, tokenA(), { qty })).statusCode, 400, `qty=${qty}`);
  }
  assert.equal((await inject("POST", url, tokenA(), {})).statusCode, 400);
  assert.equal((await inject("POST", url, tokenA(), { qty: 1e9 })).statusCode, 400);

  assert.equal((await inject("POST", url, tokenB(), { qty: 5 })).statusCode, 404);
  assert.equal((await inject("POST", url, null, { qty: 5 })).statusCode, 401);
  const db = await prisma.medication.findUnique({ where: { id: med.id } });
  assert.equal(db.stockQty, 32.5); // nada vazou do usuário B
});
