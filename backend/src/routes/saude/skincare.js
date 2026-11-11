/**
 * routes/saude/skincare.js — Saúde / Cuidado de pele (prefixo /saude/skincare).
 * Dados pessoais: TODAS as rotas exigem JWT e filtram por userId.
 *
 * Passos nunca são apagados (active=false) para preservar os checks antigos;
 * apagar um produto só zera `productId` dos passos (SetNull) e eles mantêm o `label`.
 */
import prisma from "../../prisma.js";
import { authenticate } from "../../auth.js";
import { appliesOnDate } from "../../health/schedule.js";
import {
  productCreate,
  productUpdate,
  stepCreate,
  stepUpdate,
  stepReorder,
  checkInput,
  dateQuery,
  PERIODS,
  zodMessage,
} from "../../health/validation.js";

function parseJson(val, fallback) {
  try { return JSON.parse(val); } catch { return fallback; }
}

function todayServer() {
  const d = new Date();
  return [d.getFullYear(), String(d.getMonth() + 1).padStart(2, "0"), String(d.getDate()).padStart(2, "0")].join("-");
}

function httpError(statusCode, message) {
  const err = new Error(message);
  err.statusCode = statusCode;
  return err;
}

function shapeProduct(p) {
  return { id: p.id, name: p.name, category: p.category, status: p.status, notes: p.notes, createdAt: p.createdAt };
}

function shapeStep(s) {
  return {
    id: s.id,
    period: s.period,
    order: s.order,
    productId: s.productId,
    productName: s.product?.name ?? null,
    productCategory: s.product?.category ?? null,
    productStatus: s.product?.status ?? null,
    label: s.label,
    frequency: s.frequency,
    daysOfWeek: parseJson(s.daysOfWeek, []),
    intervalDays: s.intervalDays,
    startDate: s.startDate,
    active: s.active,
  };
}

function ruleOf(s) {
  return {
    frequency: s.frequency,
    daysOfWeek: parseJson(s.daysOfWeek, []),
    intervalDays: s.intervalDays,
    startDate: s.startDate,
  };
}

async function assertOwnProduct(client, userId, productId) {
  if (!productId) return;
  const p = await client.skincareProduct.findFirst({ where: { id: productId, userId } });
  if (!p) throw httpError(400, "productId: produto não encontrado");
}

export default async function skincareRoutes(fastify) {
  fastify.addHook("preHandler", authenticate);

  // ── Produtos ──────────────────────────────────────────────────────────────
  fastify.get("/products", async (req) => {
    const rows = await prisma.skincareProduct.findMany({
      where: { userId: req.userId },
      orderBy: { name: "asc" },
    });
    return rows.map(shapeProduct);
  });

  fastify.post("/products", async (req, reply) => {
    const parsed = productCreate.safeParse(req.body ?? {});
    if (!parsed.success) return reply.status(400).send({ error: zodMessage(parsed.error) });
    const v = parsed.data;
    const row = await prisma.skincareProduct.create({
      data: { userId: req.userId, name: v.name, category: v.category, status: v.status, notes: v.notes ?? null },
    });
    return reply.status(201).send(shapeProduct(row));
  });

  fastify.patch("/products/:id", async (req, reply) => {
    const parsed = productUpdate.safeParse(req.body ?? {});
    if (!parsed.success) return reply.status(400).send({ error: zodMessage(parsed.error) });
    const own = await prisma.skincareProduct.findFirst({ where: { id: req.params.id, userId: req.userId } });
    if (!own) return reply.status(404).send({ error: "Produto não encontrado." });
    const row = await prisma.skincareProduct.update({ where: { id: own.id }, data: parsed.data });
    return shapeProduct(row);
  });

  // Marcar como comprado: status volta para "have".
  fastify.post("/products/:id/purchased", async (req, reply) => {
    const own = await prisma.skincareProduct.findFirst({ where: { id: req.params.id, userId: req.userId } });
    if (!own) return reply.status(404).send({ error: "Produto não encontrado." });
    const row = await prisma.skincareProduct.update({ where: { id: own.id }, data: { status: "have" } });
    return shapeProduct(row);
  });

  // Os passos que usavam o produto ficam com productId=null e mantêm o label (SetNull).
  fastify.delete("/products/:id", async (req, reply) => {
    const own = await prisma.skincareProduct.findFirst({ where: { id: req.params.id, userId: req.userId } });
    if (!own) return reply.status(404).send({ error: "Produto não encontrado." });
    await prisma.skincareProduct.delete({ where: { id: own.id } });
    return reply.status(204).send();
  });

  // ── Passos ────────────────────────────────────────────────────────────────
  // GET /saude/skincare/steps?period=morning|night  (só ativos)
  fastify.get("/steps", async (req, reply) => {
    const period = req.query?.period;
    if (period !== undefined && !PERIODS.includes(period)) {
      return reply.status(400).send({ error: "period: use morning ou night" });
    }
    const rows = await prisma.skincareStep.findMany({
      where: { userId: req.userId, active: true, ...(period ? { period } : {}) },
      orderBy: [{ period: "asc" }, { order: "asc" }, { createdAt: "asc" }],
      include: { product: true },
    });
    return rows.map(shapeStep);
  });

  fastify.post("/steps", async (req, reply) => {
    const parsed = stepCreate.safeParse(req.body ?? {});
    if (!parsed.success) return reply.status(400).send({ error: zodMessage(parsed.error) });
    const v = parsed.data;

    const row = await prisma.$transaction(async (tx) => {
      await assertOwnProduct(tx, req.userId, v.productId);
      const product = v.productId ? await tx.skincareProduct.findUnique({ where: { id: v.productId } }) : null;
      const last = await tx.skincareStep.findFirst({
        where: { userId: req.userId, period: v.period },
        orderBy: { order: "desc" },
      });
      return tx.skincareStep.create({
        data: {
          userId: req.userId,
          period: v.period,
          order: (last?.order ?? -1) + 1,
          productId: v.productId ?? null,
          label: v.label || product?.name || "Passo",
          frequency: v.frequency,
          daysOfWeek: JSON.stringify(v.daysOfWeek),
          intervalDays: v.frequency === "every_n_days" ? v.intervalDays : null,
          startDate: v.startDate ?? todayServer(),
        },
        include: { product: true },
      });
    });
    return reply.status(201).send(shapeStep(row));
  });

  // Reordenar os passos ativos de um período: ids na nova ordem.
  fastify.put("/steps/reorder", async (req, reply) => {
    const parsed = stepReorder.safeParse(req.body ?? {});
    if (!parsed.success) return reply.status(400).send({ error: zodMessage(parsed.error) });
    const { period, ids } = parsed.data;

    await prisma.$transaction(async (tx) => {
      const owned = await tx.skincareStep.findMany({
        where: { userId: req.userId, period, active: true },
        select: { id: true },
      });
      const ownedIds = new Set(owned.map((s) => s.id));
      if (ids.some((id) => !ownedIds.has(id)) || new Set(ids).size !== ids.length) {
        throw httpError(400, "ids: passos inválidos para este período");
      }
      for (let i = 0; i < ids.length; i++) {
        await tx.skincareStep.update({ where: { id: ids[i] }, data: { order: i } });
      }
    });

    const rows = await prisma.skincareStep.findMany({
      where: { userId: req.userId, period, active: true },
      orderBy: { order: "asc" },
      include: { product: true },
    });
    return rows.map(shapeStep);
  });

  // Editar ou remover (active=false). Nunca apaga: checks antigos permanecem.
  fastify.patch("/steps/:id", async (req, reply) => {
    const parsed = stepUpdate.safeParse(req.body ?? {});
    if (!parsed.success) return reply.status(400).send({ error: zodMessage(parsed.error) });
    const v = parsed.data;

    const row = await prisma.$transaction(async (tx) => {
      const step = await tx.skincareStep.findFirst({ where: { id: req.params.id, userId: req.userId } });
      if (!step) throw httpError(404, "Passo não encontrado.");
      if (v.productId !== undefined) await assertOwnProduct(tx, req.userId, v.productId);

      const data = {};
      for (const k of ["productId", "label", "frequency", "intervalDays", "startDate", "active"]) {
        if (v[k] !== undefined) data[k] = v[k];
      }
      if (v.daysOfWeek !== undefined) data.daysOfWeek = JSON.stringify(v.daysOfWeek);

      const frequency = data.frequency ?? step.frequency;
      if (frequency === "every_n_days" && !(data.intervalDays ?? step.intervalDays)) {
        throw httpError(400, "intervalDays: Informe o intervalo em dias");
      }
      if (frequency === "custom_days" && parseJson(data.daysOfWeek ?? step.daysOfWeek, []).length === 0) {
        throw httpError(400, "daysOfWeek: Escolha ao menos um dia da semana");
      }
      if (frequency !== "every_n_days") data.intervalDays = null;

      return tx.skincareStep.update({ where: { id: step.id }, data, include: { product: true } });
    });
    return shapeStep(row);
  });

  // ── Dia ───────────────────────────────────────────────────────────────────
  // GET /saude/skincare/today?date=  → { date, morning: [...], night: [...] }
  // Só entram passos ATIVOS que se aplicam ao dia (os outros não aparecem no check).
  fastify.get("/today", async (req, reply) => {
    const q = dateQuery.safeParse(req.query ?? {});
    if (!q.success) return reply.status(400).send({ error: zodMessage(q.error) });
    const { date } = q.data;

    const steps = await prisma.skincareStep.findMany({
      where: { userId: req.userId, active: true },
      orderBy: [{ order: "asc" }, { createdAt: "asc" }],
      include: { product: true },
    });
    const due = steps.filter((s) => appliesOnDate(ruleOf(s), date));
    const checks = await prisma.skincareCheck.findMany({
      where: { userId: req.userId, date, stepId: { in: due.map((s) => s.id) } },
    });
    const doneAt = new Map(checks.map((c) => [c.stepId, c.doneAt]));

    const toItem = (s) => ({
      stepId: s.id,
      label: s.label,
      productId: s.productId,
      productName: s.product?.name ?? null,
      productStatus: s.product?.status ?? null,
      done: doneAt.has(s.id),
      doneAt: doneAt.get(s.id) ?? null,
    });
    return {
      date,
      morning: due.filter((s) => s.period === "morning").map(toItem),
      night: due.filter((s) => s.period === "night").map(toItem),
    };
  });

  // PUT /saude/skincare/checks { stepId, date, done }
  fastify.put("/checks", async (req, reply) => {
    const parsed = checkInput.safeParse(req.body ?? {});
    if (!parsed.success) return reply.status(400).send({ error: zodMessage(parsed.error) });
    const { stepId, date, done } = parsed.data;

    const step = await prisma.skincareStep.findFirst({ where: { id: stepId, userId: req.userId, active: true } });
    if (!step) return reply.status(404).send({ error: "Passo não encontrado." });
    if (!appliesOnDate(ruleOf(step), date)) {
      return reply.status(400).send({ error: "Este passo não se aplica neste dia." });
    }

    if (done) {
      const existing = await prisma.skincareCheck.findFirst({ where: { stepId, date } });
      if (!existing) {
        await prisma.skincareCheck.create({
          data: { userId: req.userId, stepId, date, stepLabel: step.label },
        });
      }
    } else {
      await prisma.skincareCheck.deleteMany({ where: { stepId, date, userId: req.userId } });
    }
    return { stepId, date, done };
  });
}
