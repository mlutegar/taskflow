/**
 * routes/financas/incomes.js — Fontes de renda, rendas previstas, saldo inicial e projeção.
 * Prefixo /financas. JWT + zod + userId em tudo.
 */
import prisma from "../../prisma.js";
import { authenticate } from "../../auth.js";
import { categoryOk, shapeEntry } from "../../finance/service.js";
import { project } from "../../finance/projection.js";
import { addMonths, lastDayOfMonth } from "../../finance/recurrence.js";
import {
  sourceCreate, sourceUpdate, expectedCreate, expectedUpdate, receiveBody, settingsBody, projectionQuery, zodMessage,
} from "../../finance/validation.js";

const shapeSource = (s) => ({ id: s.id, name: s.name, kind: s.kind, active: s.active });
const shapeExpected = (e) => ({
  id: e.id, sourceId: e.sourceId, amountCents: e.amountCents, expectedDate: e.expectedDate,
  status: e.status, description: e.description, receivedEntryId: e.receivedEntryId,
});

export default async function incomesRoutes(fastify) {
  fastify.addHook("preHandler", authenticate);
  const bad = (reply, err) => reply.status(400).send({ error: zodMessage(err) });

  async function sourceOk(userId, sourceId) {
    if (!sourceId) return true;
    return !!(await prisma.incomeSource.findFirst({ where: { id: sourceId, userId } }));
  }

  // ── Fontes ──
  fastify.get("/income-sources", async (req) => {
    const all = req.query?.all === "1";
    const rows = await prisma.incomeSource.findMany({
      where: { userId: req.userId, ...(all ? {} : { active: true }) },
      orderBy: { createdAt: "asc" },
    });
    return rows.map(shapeSource);
  });

  fastify.post("/income-sources", async (req, reply) => {
    const p = sourceCreate.safeParse(req.body ?? {});
    if (!p.success) return bad(reply, p.error);
    return reply.status(201).send(shapeSource(await prisma.incomeSource.create({ data: { userId: req.userId, ...p.data } })));
  });

  fastify.patch("/income-sources/:id", async (req, reply) => {
    const p = sourceUpdate.safeParse(req.body ?? {});
    if (!p.success) return bad(reply, p.error);
    const own = await prisma.incomeSource.findFirst({ where: { id: req.params.id, userId: req.userId } });
    if (!own) return reply.status(404).send({ error: "Fonte não encontrada." });
    return shapeSource(await prisma.incomeSource.update({ where: { id: own.id }, data: p.data }));
  });

  // DELETE = arquivar (previsões antigas continuam apontando para ela)
  fastify.delete("/income-sources/:id", async (req, reply) => {
    const own = await prisma.incomeSource.findFirst({ where: { id: req.params.id, userId: req.userId } });
    if (!own) return reply.status(404).send({ error: "Fonte não encontrada." });
    await prisma.incomeSource.update({ where: { id: own.id }, data: { active: false } });
    return reply.status(204).send();
  });

  // ── Rendas previstas ──
  // GET ?received=1 inclui as já recebidas; padrão = só pendentes.
  fastify.get("/expected-incomes", async (req) => {
    const withReceived = req.query?.received === "1";
    const rows = await prisma.expectedIncome.findMany({
      where: { userId: req.userId, ...(withReceived ? {} : { receivedEntryId: null }) },
      orderBy: { expectedDate: "asc" },
    });
    return rows.map(shapeExpected);
  });

  fastify.post("/expected-incomes", async (req, reply) => {
    const p = expectedCreate.safeParse(req.body ?? {});
    if (!p.success) return bad(reply, p.error);
    if (!(await sourceOk(req.userId, p.data.sourceId))) return reply.status(400).send({ error: "Fonte inválida." });
    return reply.status(201).send(shapeExpected(await prisma.expectedIncome.create({ data: { userId: req.userId, ...p.data } })));
  });

  fastify.patch("/expected-incomes/:id", async (req, reply) => {
    const p = expectedUpdate.safeParse(req.body ?? {});
    if (!p.success) return bad(reply, p.error);
    const own = await prisma.expectedIncome.findFirst({ where: { id: req.params.id, userId: req.userId } });
    if (!own) return reply.status(404).send({ error: "Renda prevista não encontrada." });
    if (own.receivedEntryId) return reply.status(409).send({ error: "Renda já recebida; edite o lançamento." });
    if (!(await sourceOk(req.userId, p.data.sourceId))) return reply.status(400).send({ error: "Fonte inválida." });
    return shapeExpected(await prisma.expectedIncome.update({ where: { id: own.id }, data: p.data }));
  });

  fastify.delete("/expected-incomes/:id", async (req, reply) => {
    const own = await prisma.expectedIncome.findFirst({ where: { id: req.params.id, userId: req.userId } });
    if (!own) return reply.status(404).send({ error: "Renda prevista não encontrada." });
    await prisma.expectedIncome.delete({ where: { id: own.id } });
    return reply.status(204).send();
  });

  // POST /expected-incomes/:id/receive — cria o FinanceEntry de renda e vincula (sem duplicar)
  fastify.post("/expected-incomes/:id/receive", async (req, reply) => {
    const p = receiveBody.safeParse(req.body ?? {});
    if (!p.success) return bad(reply, p.error);
    const own = await prisma.expectedIncome.findFirst({ where: { id: req.params.id, userId: req.userId } });
    if (!own) return reply.status(404).send({ error: "Renda prevista não encontrada." });
    if (own.receivedEntryId) return reply.status(409).send({ error: "Esta renda já foi recebida." });
    if (p.data.categoryId && !(await categoryOk(req.userId, p.data.categoryId, "income")))
      return reply.status(400).send({ error: "Categoria inválida para este tipo." });

    let description = p.data.description === undefined ? own.description : p.data.description;
    if (!description && own.sourceId) {
      const src = await prisma.incomeSource.findFirst({ where: { id: own.sourceId, userId: req.userId } });
      description = src?.name ?? null;
    }
    const entry = await prisma.$transaction(async (tx) => {
      const claimed = await tx.expectedIncome.updateMany({
        where: { id: own.id, userId: req.userId, receivedEntryId: null },
        data: { receivedEntryId: "pending" },
      });
      if (claimed.count === 0) return null; // corrida: já recebida
      const e = await tx.financeEntry.create({
        data: {
          userId: req.userId,
          type: "income",
          amountCents: p.data.amountCents ?? own.amountCents,
          date: p.data.date ?? own.expectedDate,
          categoryId: p.data.categoryId ?? null,
          description,
          paymentMethod: p.data.paymentMethod ?? null,
        },
      });
      await tx.expectedIncome.update({ where: { id: own.id }, data: { receivedEntryId: e.id } });
      return e;
    });
    if (!entry) return reply.status(409).send({ error: "Esta renda já foi recebida." });
    return reply.status(201).send(shapeEntry(entry));
  });

  // ── Saldo inicial ──
  fastify.get("/settings", async (req) => {
    const s = await prisma.financeSettings.findUnique({ where: { userId: req.userId } });
    return { openingBalanceCents: s?.openingBalanceCents ?? 0, openingDate: s?.openingDate ?? null };
  });

  fastify.put("/settings", async (req, reply) => {
    const p = settingsBody.safeParse(req.body ?? {});
    if (!p.success) return bad(reply, p.error);
    const data = { openingBalanceCents: p.data.openingBalanceCents, openingDate: p.data.openingDate ?? null };
    const s = await prisma.financeSettings.upsert({
      where: { userId: req.userId },
      create: { userId: req.userId, ...data },
      update: data,
    });
    return { openingBalanceCents: s.openingBalanceCents, openingDate: s.openingDate };
  });

  // ── Projeção ── GET /projection?months=3..6&from=YYYY-MM (from = mês atual do cliente)
  fastify.get("/projection", async (req, reply) => {
    const q = projectionQuery.safeParse(req.query ?? {});
    if (!q.success) return bad(reply, q.error);
    const { months, from } = q.data;
    const userId = req.userId;
    const last = lastDayOfMonth(addMonths(from, months - 1));

    const settings = await prisma.financeSettings.findUnique({ where: { userId } });
    const openingDate = settings?.openingDate ?? null;
    const [entries, series, exceptions, expected] = await Promise.all([
      prisma.financeEntry.findMany({ where: { userId, date: { lte: last, ...(openingDate ? { gte: openingDate } : {}) } } }),
      prisma.financeSeries.findMany({ where: { userId, startDate: { lte: last } } }),
      prisma.financeSeriesException.findMany({ where: { userId } }),
      prisma.expectedIncome.findMany({ where: { userId, receivedEntryId: null } }),
    ]);
    const result = project({
      openingCents: settings?.openingBalanceCents ?? 0,
      openingDate,
      fromMonth: from,
      months,
      entries,
      series,
      exceptions,
      expected,
    });
    return { from, monthsCount: months, openingBalanceCents: settings?.openingBalanceCents ?? 0, openingDate, ...result };
  });
}
