import prisma from "../prisma.js";
import { authenticate } from "../auth.js";

function parseJson(val, fallback) {
  try { return JSON.parse(val); } catch { return fallback; }
}

export default async function sessionUsageLogsRoutes(fastify) {
  fastify.addHook("preHandler", authenticate);

  // POST /session-usage-logs
  fastify.post("/", async (req, reply) => {
    const { mode_id, date, hour, worked, focused_minutes, idle_minutes, idle_reason, feeling } = req.body ?? {};

    if (!mode_id || !date) {
      return reply.status(400).send({ error: "mode_id e date são obrigatórios." });
    }

    try {
      await prisma.sessionUsageLog.upsert({
        where: { userId_modeId_date_hour: { userId: req.userId, modeId: mode_id, date, hour: hour ?? 0 } },
        update: {
          worked:         worked ?? false,
          focusedMinutes: focused_minutes ?? 0,
          idleMinutes:    idle_minutes ?? 0,
          idleReason:     JSON.stringify(idle_reason ?? []),
          feeling:        JSON.stringify(feeling ?? []),
        },
        create: {
          userId:         req.userId,
          modeId:         mode_id,
          date,
          hour:           hour ?? 0,
          worked:         worked ?? false,
          focusedMinutes: focused_minutes ?? 0,
          idleMinutes:    idle_minutes ?? 0,
          idleReason:     JSON.stringify(idle_reason ?? []),
          feeling:        JSON.stringify(feeling ?? []),
        },
      });
    } catch {
      // ignora conflitos de unicidade
    }

    reply.status(201).send({ ok: true });
  });

  // GET /session-usage-logs
  fastify.get("/", async (req) => {
    // Últimos 365 dias
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - 365);
    const cutoffStr = cutoff.toISOString().slice(0, 10);

    const rows = await prisma.sessionUsageLog.findMany({
      where: { userId: req.userId, date: { gte: cutoffStr } },
      orderBy: { createdAt: "asc" },
    });

    return rows.map((r) => ({
      mode_id:          r.modeId,
      date:             r.date,
      hour:             r.hour,
      worked:           r.worked,
      focused_minutes:  r.focusedMinutes,
      idle_minutes:     r.idleMinutes,
      idle_reason:      parseJson(r.idleReason, []),
      feeling:          parseJson(r.feeling, []),
    }));
  });
}
