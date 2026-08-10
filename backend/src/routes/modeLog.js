import prisma from "../prisma.js";
import { authenticate } from "../auth.js";

export default async function modeLogRoutes(fastify) {
  fastify.addHook("preHandler", authenticate);

  // GET /mode-log — retorna todos os registros do usuário (últimos 90 dias)
  fastify.get("/", async (req) => {
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - 90);
    const cutoffIso = cutoff.toISOString().slice(0, 10);

    const logs = await prisma.modeLog.findMany({
      where: {
        userId: req.userId,
        date: { gte: cutoffIso },
      },
      orderBy: { createdAt: "desc" },
    });

    return logs.map((l) => ({ modeId: l.modeId, date: l.date }));
  });

  // POST /mode-log — registra uma conclusão de modo
  fastify.post("/", async (req, reply) => {
    const { modeId, date } = req.body ?? {};
    if (!modeId || !date) {
      return reply.status(400).send({ error: "modeId e date são obrigatórios." });
    }

    await prisma.modeLog.upsert({
      where: { userId_modeId_date: { userId: req.userId, modeId, date } },
      update: {},
      create: { userId: req.userId, modeId, date },
    });

    return { ok: true };
  });
}
