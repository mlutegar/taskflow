/**
 * Testes de rota de Skincare + lista de compras (SQLite temporário com migrations reais).
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
const tmp = mkdtempSync(path.join(tmpdir(), "taskflow-skin-"));
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
  app.register((await import("./skincare.js")).default, { prefix: "/saude/skincare" });
  app.register((await import("./shopping.js")).default, { prefix: "/saude/shopping-list" });
  app.register((await import("./medications.js")).default, { prefix: "/saude/medications" });
  await app.ready();
});

after(async () => {
  await app?.close();
  await prisma?.$disconnect();
  rmSync(tmp, { recursive: true, force: true });
});

const inject = (method, url, token, payload) =>
  app.inject({ method, url, headers: token ? { authorization: `Bearer ${token}` } : {}, payload });

const S = "/saude/skincare";
async function mkProduct(token, over = {}) {
  const r = await inject("POST", `${S}/products`, token, { name: "Protetor", category: "protetor", ...over });
  assert.equal(r.statusCode, 201, r.body);
  return r.json();
}
async function mkStep(token, over = {}) {
  const r = await inject("POST", `${S}/steps`, token, { period: "morning", label: "Limpar", startDate: "2026-11-01", ...over });
  assert.equal(r.statusCode, 201, r.body);
  return r.json();
}

test("todas as rotas exigem autenticação", async () => {
  for (const [m, u] of [
    ["GET", `${S}/products`], ["POST", `${S}/products`], ["PATCH", `${S}/products/x`], ["DELETE", `${S}/products/x`],
    ["POST", `${S}/products/x/purchased`], ["GET", `${S}/steps`], ["POST", `${S}/steps`], ["PATCH", `${S}/steps/x`],
    ["PUT", `${S}/steps/reorder`], ["GET", `${S}/today?date=2026-11-11`], ["PUT", `${S}/checks`],
    ["GET", "/saude/shopping-list"],
  ]) {
    assert.equal((await inject(m, u, null, {})).statusCode, 401, `${m} ${u}`);
  }
});

test("validação: datas, períodos, status e categorias inválidos retornam 400", async () => {
  const t = tokenA();
  assert.equal((await inject("POST", `${S}/products`, t, { name: "X", status: "xx" })).statusCode, 400);
  assert.equal((await inject("POST", `${S}/products`, t, { name: "X", category: "yy" })).statusCode, 400);
  assert.equal((await inject("POST", `${S}/steps`, t, { period: "tarde", label: "x" })).statusCode, 400);
  assert.equal((await inject("POST", `${S}/steps`, t, { period: "night", label: "x", startDate: "01/11/2026" })).statusCode, 400);
  assert.equal((await inject("GET", `${S}/today?date=hoje`, t)).statusCode, 400);
  assert.equal((await inject("PUT", `${S}/checks`, t, { stepId: "s", date: "2026-13-01", done: true })).statusCode, 400);
  assert.equal((await inject("GET", `${S}/steps?period=tarde`, t)).statusCode, 400);
});

test("isolamento entre usuários (produtos, passos, checks, compras)", async () => {
  const p = await mkProduct(tokenA(), { name: "Privado", status: "need_to_buy" });
  const s = await mkStep(tokenA(), { label: "Privado" });
  assert.equal((await inject("GET", `${S}/products`, tokenB())).json().some((x) => x.id === p.id), false);
  assert.equal((await inject("PATCH", `${S}/products/${p.id}`, tokenB(), { name: "x" })).statusCode, 404);
  assert.equal((await inject("DELETE", `${S}/products/${p.id}`, tokenB())).statusCode, 404);
  assert.equal((await inject("POST", `${S}/products/${p.id}/purchased`, tokenB())).statusCode, 404);
  assert.equal((await inject("PATCH", `${S}/steps/${s.id}`, tokenB(), { active: false })).statusCode, 404);
  assert.equal((await inject("PUT", `${S}/checks`, tokenB(), { stepId: s.id, date: "2026-11-11", done: true })).statusCode, 404);
  // B não pode apontar um passo para produto do A
  const stepB = await inject("POST", `${S}/steps`, tokenB(), { period: "night", label: "x", productId: p.id });
  assert.equal(stepB.statusCode, 400);
  const shopB = (await inject("GET", "/saude/shopping-list", tokenB())).json();
  assert.equal(shopB.total, 0);
});

test("passo com frequência própria só aparece nos dias que se aplica", async () => {
  const t = tokenA();
  const daily = await mkStep(t, { period: "night", label: "Limpeza noite" });
  const exf = await mkStep(t, { period: "night", label: "Esfoliante", frequency: "custom_days", daysOfWeek: [2, 5] });
  const items = async (date) => (await inject("GET", `${S}/today?date=${date}`, t)).json().night.map((i) => i.label);

  const tue = await items("2026-11-10"); // terça
  assert.ok(tue.includes("Esfoliante") && tue.includes("Limpeza noite"));
  const wed = await items("2026-11-11"); // quarta
  assert.ok(!wed.includes("Esfoliante") && wed.includes("Limpeza noite"));
  // não dá para marcar um passo num dia em que não se aplica
  const bad = await inject("PUT", `${S}/checks`, t, { stepId: exf.id, date: "2026-11-11", done: true });
  assert.equal(bad.statusCode, 400);
  assert.ok(daily.id);
});

test("check de manhã e noite são independentes; marcar é idempotente e desmarcar remove", async () => {
  const t = tokenA();
  const m = await mkStep(t, { period: "morning", label: "Check manhã" });
  const n = await mkStep(t, { period: "night", label: "Check noite" });
  const put = (stepId, done) => inject("PUT", `${S}/checks`, t, { stepId, date: "2026-11-11", done });

  assert.equal((await put(m.id, true)).statusCode, 200);
  assert.equal((await put(m.id, true)).statusCode, 200); // idempotente
  assert.equal(await prisma.skincareCheck.count({ where: { stepId: m.id, date: "2026-11-11" } }), 1);

  const today = (await inject("GET", `${S}/today?date=2026-11-11`, t)).json();
  assert.equal(today.morning.find((i) => i.stepId === m.id).done, true);
  assert.equal(today.night.find((i) => i.stepId === n.id).done, false);

  await put(m.id, false);
  const again = (await inject("GET", `${S}/today?date=2026-11-11`, t)).json();
  assert.equal(again.morning.find((i) => i.stepId === m.id).done, false);
});

test("remover passo = active=false: some do dia, mas os checks antigos permanecem", async () => {
  const t = tokenA();
  const s = await mkStep(t, { label: "Soft delete" });
  await inject("PUT", `${S}/checks`, t, { stepId: s.id, date: "2026-11-09", done: true });
  assert.equal((await inject("PATCH", `${S}/steps/${s.id}`, t, { active: false })).statusCode, 200);

  const steps = (await inject("GET", `${S}/steps`, t)).json();
  assert.equal(steps.some((x) => x.id === s.id), false);
  const today = (await inject("GET", `${S}/today?date=2026-11-11`, t)).json();
  assert.equal(today.morning.some((i) => i.stepId === s.id), false);
  assert.equal((await inject("PUT", `${S}/checks`, t, { stepId: s.id, date: "2026-11-11", done: true })).statusCode, 404);

  const db = await prisma.skincareStep.findUnique({ where: { id: s.id } });
  assert.equal(db.active, false);
  assert.equal(await prisma.skincareCheck.count({ where: { stepId: s.id } }), 1); // histórico intacto
});

test("apagar produto: passos mantêm o label e productId vira null (SetNull)", async () => {
  const t = tokenA();
  const p = await mkProduct(t, { name: "Sérum C" });
  const s = await mkStep(t, { label: "", productId: p.id }); // label vem do produto
  assert.equal(s.label, "Sérum C");
  assert.equal(s.productName, "Sérum C");

  assert.equal((await inject("DELETE", `${S}/products/${p.id}`, t)).statusCode, 204);
  const after = (await inject("GET", `${S}/steps`, t)).json().find((x) => x.id === s.id);
  assert.equal(after.productId, null);
  assert.equal(after.label, "Sérum C");
  assert.equal(after.active, true);
});

test("reordenar passos do período", async () => {
  const t = tokenB();
  const a = await mkStep(t, { period: "night", label: "A" });
  const b = await mkStep(t, { period: "night", label: "B" });
  const c = await mkStep(t, { period: "night", label: "C" });
  const res = await inject("PUT", `${S}/steps/reorder`, t, { period: "night", ids: [c.id, a.id, b.id] });
  assert.equal(res.statusCode, 200);
  assert.deepEqual(res.json().map((x) => x.label), ["C", "A", "B"]);
  // id de outro período/usuário é rejeitado
  const bad = await inject("PUT", `${S}/steps/reorder`, t, { period: "night", ids: [a.id, "inexistente"] });
  assert.equal(bad.statusCode, 400);
});

test("lista de compras: produtos acabando/comprar + remédios com estoque baixo; 'comprei' volta para 'have'", async () => {
  const t = "user-shop";
  const tok = jwt.sign({ userId: t }, "test-secret");
  const low = await mkProduct(tok, { name: "Hidratante", status: "low" });
  const need = await mkProduct(tok, { name: "Protetor solar", status: "need_to_buy" });
  await mkProduct(tok, { name: "Sabonete", status: "have" });

  const medRes = await inject("POST", "/saude/medications", tok, {
    name: "Vitamina D", startDate: "2026-11-01", stockQty: 2, lowStockThreshold: 5, schedules: [{ time: "08:00", doseQty: 1 }],
  });
  assert.equal(medRes.statusCode, 201);
  const okMed = await inject("POST", "/saude/medications", tok, {
    name: "Cheio", startDate: "2026-11-01", stockQty: 50, lowStockThreshold: 5, schedules: [],
  });
  assert.equal(okMed.statusCode, 201);

  let list = (await inject("GET", "/saude/shopping-list", tok)).json();
  assert.deepEqual(list.skincare.map((x) => x.name), ["Protetor solar", "Hidratante"]);
  assert.deepEqual(list.medications.map((x) => x.name), ["Vitamina D"]);
  assert.equal(list.total, 3);

  const bought = await inject("POST", `${S}/products/${need.id}/purchased`, tok);
  assert.equal(bought.json().status, "have");
  list = (await inject("GET", "/saude/shopping-list", tok)).json();
  assert.deepEqual(list.skincare.map((x) => x.name), ["Hidratante"]);
  assert.ok(low.id);

  // arquivar o remédio tira da lista
  await inject("PATCH", `/saude/medications/${medRes.json().id}`, tok, { active: false });
  list = (await inject("GET", "/saude/shopping-list", tok)).json();
  assert.equal(list.medications.length, 0);
});
