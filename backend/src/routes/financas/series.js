/**
 * routes/financas/series.js — Finanças / Recorrentes e parcelados (prefixo /financas/series).
 * Regra guardada, ocorrências calculadas na leitura. Meses passados nunca são reescritos:
 *  - revise: encerra a série no mês anterior e cria outra a partir de `effectiveMonth`;
 *  - end: só define endDate (ou remove a série se ela ainda nem tinha começado antes de `fromMonth`);
 *  - PATCH: apenas campos cosméticos (descrição/forma de pagamento).
 */
import prisma from "../../prisma.js";
import { authenticate } from "../../auth.js";
import { shapeSeries, categoryOk } from "../../finance/service.js";
import { addMonths, clampDay, lastDayOfMonth, monthOf } from "../../finance/recurrence.js";
import {
  seriesCreate, seriesCosmetic, seriesRevise, seriesEnd, exceptionBody, monthStr, zodMessage,
} from "../../finance/validation.js";

export default async function seriesRoutes(fastify) {
  fastify.addHook("preHandler", authenticate);

  const findOwn = (req) => prisma.financeSeries.findFirst({ where: { id: req.params.id, userId: req.userId } });
  const notFound = (reply) => reply.status(404).send({ error: "Recorrência não encontrada." });

  fastify.get("/", async (req) => {
    const rows = await prisma.financeSeries.findMany({
      where: { userId: req.userId },
      orderBy: { startDate: "desc" },
    });
    return rows.map(shapeSeries);
  });

  fastify.post("/", async (req, reply) => {
    const parsed = seriesCreate.safeParse(req.body ?? {});
    if (!parsed.success) return reply.status(400).send({ error: zodMessage(parsed.error) });
    const d = parsed.data;
    if (!(await categoryOk(req.userId, d.categoryId, d.type)))
      return reply.status(400).send({ error: "Categoria inválida para este tipo." });
    const row = await prisma.financeSeries.create({
      data: { userId: req.userId, ...d, dayOfMonth: Number(d.startDate.slice(8, 10)) },
    });
    return reply.status(201).send(shapeSeries(row));
  });

  fastify.patch("/:id", async (req, reply) => {
    const parsed = seriesCosmetic.safeParse(req.body ?? {});
    if (!parsed.success) return reply.status(400).send({ error: zodMessage(parsed.error) });
    const own = await findOwn(req);
    if (!own) return notFound(reply);
    return shapeSeries(await prisma.financeSeries.update({ where: { id: own.id }, data: parsed.data }));
  });

  // POST /:id/revise — "a partir de <mês>" (só fixo mensal)
  fastify.post("/:id/revise", async (req, reply) => {
    const parsed = seriesRevise.safeParse(req.body ?? {});
    if (!parsed.success) return reply.status(400).send({ error: zodMessage(parsed.error) });
    const own = await findOwn(req);
    if (!own) return notFound(reply);
    if (own.kind !== "monthly") return reply.status(400).send({ error: "Parcelas não podem ser alteradas; apenas encerradas." });
    if (own.endDate) return reply.status(409).send({ error: "Esta recorrência já foi encerrada." });

    const { effectiveMonth, ...changes } = parsed.data;
    const startMonth = monthOf(own.startDate);
    if (effectiveMonth < startMonth) return reply.status(400).send({ error: "Mês anterior ao início da recorrência." });
    if (changes.categoryId !== undefined && !(await categoryOk(req.userId, changes.categoryId, own.type)))
      return reply.status(400).send({ error: "Categoria inválida para este tipo." });

    const merged = {
      amountCents: changes.amountCents ?? own.amountCents,
      categoryId: changes.categoryId === undefined ? own.categoryId : changes.categoryId,
      description: changes.description === undefined ? own.description : changes.description,
      paymentMethod: changes.paymentMethod === undefined ? own.paymentMethod : changes.paymentMethod,
      dayOfMonth: changes.dayOfMonth ?? own.dayOfMonth,
    };

    // Mesmo mês do início: nenhum mês anterior existe → atualiza no lugar (sem reescrever passado).
    if (effectiveMonth === startMonth) {
      const row = await prisma.financeSeries.update({
        where: { id: own.id },
        data: { ...merged, startDate: clampDay(startMonth, merged.dayOfMonth) },
      });
      return shapeSeries(row);
    }

    const row = await prisma.$transaction(async (tx) => {
      await tx.financeSeries.update({
        where: { id: own.id },
        data: { endDate: lastDayOfMonth(addMonths(effectiveMonth, -1)) },
      });
      return tx.financeSeries.create({
        data: {
          userId: req.userId,
          type: own.type,
          kind: "monthly",
          startDate: clampDay(effectiveMonth, merged.dayOfMonth),
          supersedesId: own.id,
          ...merged,
        },
      });
    });
    return reply.status(201).send(shapeSeries(row));
  });

  // POST /:id/end { fromMonth } — encerra a partir de <mês> (esse mês já não ocorre)
  fastify.post("/:id/end", async (req, reply) => {
    const parsed = seriesEnd.safeParse(req.body ?? {});
    if (!parsed.success) return reply.status(400).send({ error: zodMessage(parsed.error) });
    const own = await findOwn(req);
    if (!own) return notFound(reply);
    const { fromMonth } = parsed.data;

    if (fromMonth <= monthOf(own.startDate)) {
      // Nada havia ocorrido antes de `fromMonth`: remove a regra inteira.
      await prisma.$transaction([
        prisma.financeSeriesException.deleteMany({ where: { seriesId: own.id, userId: req.userId } }),
        prisma.financeSeries.delete({ where: { id: own.id } }),
      ]);
      return reply.status(204).send();
    }
    const endDate = lastDayOfMonth(addMonths(fromMonth, -1));
    if (own.endDate && own.endDate <= endDate) return shapeSeries(own); // já termina antes
    return shapeSeries(await prisma.financeSeries.update({ where: { id: own.id }, data: { endDate } }));
  });

  // PUT /:id/exceptions/:month — pular o mês ou ajustar o valor só nele (fixo mensal)
  fastify.put("/:id/exceptions/:month", async (req, reply) => {
    const month = monthStr.safeParse(req.params.month);
    const parsed = exceptionBody.safeParse(req.body ?? {});
    if (!month.success || !parsed.success)
      return reply.status(400).send({ error: zodMessage((month.success ? parsed : month).error) });
    const own = await findOwn(req);
    if (!own) return notFound(reply);
    if (own.kind === "installment" && parsed.data.amountCents)
      return reply.status(400).send({ error: "Parcelas não aceitam ajuste de valor." });

    const data = { skipped: parsed.data.skipped, amountCents: parsed.data.amountCents ?? null };
    const row = await prisma.financeSeriesException.upsert({
      where: { seriesId_month: { seriesId: own.id, month: month.data } },
      create: { userId: req.userId, seriesId: own.id, month: month.data, ...data },
      update: data,
    });
    return { seriesId: row.seriesId, month: row.month, skipped: row.skipped, amountCents: row.amountCents };
  });

  fastify.delete("/:id/exceptions/:month", async (req, reply) => {
    const own = await findOwn(req);
    if (!own) return notFound(reply);
    await prisma.financeSeriesException.deleteMany({
      where: { seriesId: own.id, userId: req.userId, month: req.params.month },
    });
    return reply.status(204).send();
  });
}
