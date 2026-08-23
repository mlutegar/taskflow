import prisma from "../prisma.js";
import { authenticate } from "../auth.js";

function parseJson(val, fallback) {
  try { return JSON.parse(val); } catch { return fallback; }
}

export default async function modeComboLogRoutes(fastify) {
  fastify.addHook("preHandler", authenticate);

  // GET /mode-combo-log — retorna registros do usuário (últimos 90 dias)
  fastify.get("/", async (req) => {
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - 90);
    const cutoffIso = cutoff.toISOString().slice(0, 10);

    const logs = await prisma.modeComboLog.findMany({
      where: {
        userId: req.userId,
        date: { gte: cutoffIso },
      },
      orderBy: { createdAt: "desc" },
    });

    return logs.map((l) => ({
      id: l.id,
      modeIdA: l.modeIdA,
      modeIdB: l.modeIdB,
      date: l.date,
      hour: l.hour,
      worked: l.worked,
      focusedMinutes: l.focusedMinutes,
      feeling: parseJson(l.feeling, []),
      createdAt: l.createdAt,
    }));
  });

  // POST /mode-combo-log — upsert de log de combo de modos
  fastify.post("/", async (req, reply) => {
    const { modeIdA, modeIdB, date, hour, worked, focusedMinutes, feeling } =
      req.body ?? {};

    if (!modeIdA || !modeIdB || !date || hour === undefined) {
      return reply
        .status(400)
        .send({ error: "modeIdA, modeIdB, date e hour são obrigatórios." });
    }
    if (typeof hour !== "number" || hour < 0 || hour > 23) {
      return reply.status(400).send({ error: "hour deve ser um número entre 0 e 23." });
    }

    await prisma.modeComboLog.upsert({
      where: {
        userId_modeIdA_modeIdB_date_hour: {
          userId: req.userId,
          modeIdA,
          modeIdB,
          date,
          hour,
        },
      },
      update: {
        worked: worked ?? null,
        focusedMinutes: focusedMinutes ?? 0,
        feeling: JSON.stringify(feeling ?? []),
      },
      create: {
        userId: req.userId,
        modeIdA,
        modeIdB,
        date,
        hour,
        worked: worked ?? null,
        focusedMinutes: focusedMinutes ?? 0,
        feeling: JSON.stringify(feeling ?? []),
      },
    });

    return { ok: true };
  });
}
