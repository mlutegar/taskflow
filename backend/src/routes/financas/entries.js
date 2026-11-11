/**
 * routes/financas/entries.js — Finanças / Lançamentos (prefixo /financas/entries).
 * GET devolve lançamentos reais + ocorrências de séries do mês (origin "single" | "series").
 * PATCH/DELETE só atuam em lançamentos reais; séries usam /financas/series.
 */
import prisma from "../../prisma.js";
import { authenticate } from "../../auth.js";
import { monthItems, shapeEntry, categoryOk } from "../../finance/service.js";
import { entryCreate, entryUpdate, monthQuery, zodMessage } from "../../finance/validation.js";

export default async function entriesRoutes(fastify) {
  fastify.addHook("preHandler", authenticate);

  fastify.get("/", async (req, reply) => {
    const q = monthQuery.safeParse(req.query ?? {});
    if (!q.success) return reply.status(400).send({ error: zodMessage(q.error) });
    return monthItems(req.userId, q.data.month);
  });

  fastify.post("/", async (req, reply) => {
    const parsed = entryCreate.safeParse(req.body ?? {});
    if (!parsed.success) return reply.status(400).send({ error: zodMessage(parsed.error) });
    if (!(await categoryOk(req.userId, parsed.data.categoryId, parsed.data.type)))
      return reply.status(400).send({ error: "Categoria inválida para este tipo." });
    const row = await prisma.financeEntry.create({ data: { userId: req.userId, ...parsed.data } });
    return reply.status(201).send(shapeEntry(row));
  });

  fastify.patch("/:id", async (req, reply) => {
    const parsed = entryUpdate.safeParse(req.body ?? {});
    if (!parsed.success) return reply.status(400).send({ error: zodMessage(parsed.error) });
    const own = await prisma.financeEntry.findFirst({ where: { id: req.params.id, userId: req.userId } });
    if (!own) return reply.status(404).send({ error: "Lançamento não encontrado." });
    const type = parsed.data.type ?? own.type;
    const categoryId = parsed.data.categoryId === undefined ? own.categoryId : parsed.data.categoryId;
    if (!(await categoryOk(req.userId, categoryId, type)))
      return reply.status(400).send({ error: "Categoria inválida para este tipo." });
    const row = await prisma.financeEntry.update({ where: { id: own.id }, data: parsed.data });
    return shapeEntry(row);
  });

  fastify.delete("/:id", async (req, reply) => {
    const own = await prisma.financeEntry.findFirst({ where: { id: req.params.id, userId: req.userId } });
    if (!own) return reply.status(404).send({ error: "Lançamento não encontrado." });
    // Se veio de um "Recebi", a previsão volta a ficar pendente.
    await prisma.$transaction([
      prisma.expectedIncome.updateMany({ where: { userId: req.userId, receivedEntryId: own.id }, data: { receivedEntryId: null } }),
      prisma.financeEntry.delete({ where: { id: own.id } }),
    ]);
    return reply.status(204).send();
  });
}
