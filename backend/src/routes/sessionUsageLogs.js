import prisma from "../prisma.js";
import { authenticate } from "../auth.js";

function parseJson(val, fallback) {
  try { return JSON.parse(val); } catch { return fallback; }
}

export default async function sessionUsageLogsRoutes(fastify) {
  fastify.addHook("preHandler", authenticate);

  // POST /session-usage-logs
  fastify.post("/", async (req, reply) => {
    const { mode_id, date, hour, worked, focused_minutes, idle_minutes, idle_reason, feeling, combo_with } = req.body ?? {};

    if (!mode_id || !date) {
      return reply.status(400).send({ error: "mode_id e date são obrigatórios." });
    }

    await prisma.sessionUsageLog.upsert({
      where: { userId_modeId_date_hour: { userId: req.userId, modeId: mode_id, date, hour: hour ?? 0 } },
      update: {
        worked:         worked !== undefined ? worked : null,
        focusedMinutes: focused_minutes ?? 0,
        idleMinutes:    idle_minutes ?? 0,
        idleReason:     JSON.stringify(idle_reason ?? []),
        feeling:        JSON.stringify(feeling ?? []),
        comboWith:      combo_with ?? null,
      },
      create: {
        userId:         req.userId,
        modeId:         mode_id,
        date,
        hour:           hour ?? 0,
        worked:         worked !== undefined ? worked : null,
        focusedMinutes: focused_minutes ?? 0,
        idleMinutes:    idle_minutes ?? 0,
        idleReason:     JSON.stringify(idle_reason ?? []),
        feeling:        JSON.stringify(feeling ?? []),
        comboWith:      combo_with ?? null,
      },
    });

    reply.status(201).send({ ok: true });
  });

  // GET /session-usage-logs?limit=200&cursor=<id>
  fastify.get("/", async (req) => {
    const limit  = Math.min(Number(req.query.limit) || 200, 500);
    const cursor = req.query.cursor ? Number(req.query.cursor) : undefined;

    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - 365);
    const cutoffStr = cutoff.toISOString().slice(0, 10);

    const rows = await prisma.sessionUsageLog.findMany({
      where: { userId: req.userId, date: { gte: cutoffStr } },
      orderBy: { id: "asc" },
      take: limit + 1,
      ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
    });

    const hasMore  = rows.length > limit;
    const items    = hasMore ? rows.slice(0, limit) : rows;
    const nextCursor = hasMore ? items[items.length - 1].id : null;

    return {
      items: items.map((r) => ({
        mode_id:          r.modeId,
        date:             r.date,
        hour:             r.hour,
        worked:           r.worked,
        focused_minutes:  r.focusedMinutes,
        idle_minutes:     r.idleMinutes,
        idle_reason:      parseJson(r.idleReason, []),
        feeling:          parseJson(r.feeling, []),
        combo_with:       r.comboWith ?? null,
      })),
      nextCursor,
    };
  });

  // POST /session-usage-logs/bulk — importação de dados locais (usado no primeiro login)
  fastify.post("/bulk", async (req, reply) => {
    const entries = req.body?.entries;
    if (!Array.isArray(entries) || entries.length === 0) {
      return reply.status(400).send({ error: "entries deve ser um array não-vazio." });
    }

    let saved = 0;
    for (const e of entries.slice(0, 1000)) { // máximo 1000 por chamada
      const { mode_id, date, hour, worked, focused_minutes, idle_minutes, idle_reason, feeling } = e;
      if (!mode_id || !date) continue;
      // Valida campos numéricos para evitar dados corrompidos
      const safeHour = typeof hour === "number" && hour >= 0 && hour <= 23 ? hour : 0;
      const safeFocused = typeof focused_minutes === "number" && focused_minutes >= 0 ? Math.min(focused_minutes, 1440) : 0;
      const safeIdle = typeof idle_minutes === "number" && idle_minutes >= 0 ? Math.min(idle_minutes, 1440) : 0;
      try {
        await prisma.sessionUsageLog.upsert({
          where: { userId_modeId_date_hour: { userId: req.userId, modeId: mode_id, date, hour: safeHour } },
          update: {},  // não sobrescreve dados existentes no bulk
          create: {
            userId:         req.userId,
            modeId:         mode_id,
            date,
            hour:           safeHour,
            worked:         worked ?? false,
            focusedMinutes: safeFocused,
            idleMinutes:    safeIdle,
            idleReason:     JSON.stringify(idle_reason ?? []),
            feeling:        JSON.stringify(feeling ?? []),
          },
        });
        saved++;
      } catch { /* ignora duplicatas */ }
    }

    reply.status(201).send({ ok: true, saved });
  });
}
