/** routes/financas/summary.js — Finanças / Visão do mês (prefixo /financas/summary). */
import { authenticate } from "../../auth.js";
import { monthItems } from "../../finance/service.js";
import { monthSummary } from "../../finance/monthSummary.js";
import { addMonths } from "../../finance/recurrence.js";
import { monthQuery, zodMessage } from "../../finance/validation.js";

export default async function summaryRoutes(fastify) {
  fastify.addHook("preHandler", authenticate);

  // GET /financas/summary?month=YYYY-MM
  fastify.get("/", async (req, reply) => {
    const q = monthQuery.safeParse(req.query ?? {});
    if (!q.success) return reply.status(400).send({ error: zodMessage(q.error) });
    const { month } = q.data;
    const [cur, prev] = await Promise.all([
      monthItems(req.userId, month),
      monthItems(req.userId, addMonths(month, -1)),
    ]);
    return { month, previousMonth: addMonths(month, -1), ...monthSummary(cur, prev) };
  });
}
