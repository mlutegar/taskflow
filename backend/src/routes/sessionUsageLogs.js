import prisma from "../prisma.js";
import { authenticate } from "../auth.js";

function parseJson(val, fallback) {
  try { return JSON.parse(val); } catch { return fallback; }
}

export default async function sessionUsageLogsRoutes(fastify) {
  fastify.addHook("preHandler", authenticate);

  // POST /session-usage-logs
  fastify.post("/", async (req, reply) => {
    const {
      client_id, id, mode_id, date, hour, worked, focused_minutes, idle_minutes, idle_reason, feeling, combo_with,
      started_at, ended_at, session_duration_minutes, efficiency_pct,
      pause_count, paused_minutes, focus_blocks, tasks_completed, note,
    } = req.body ?? {};

    if (!mode_id || !date) {
      return reply.status(400).send({ error: "mode_id e date são obrigatórios." });
    }

    // UUID gerado no cliente — chave de idempotência/dedupe. `id` é o nome legado do campo.
    const clientId = client_id ?? id ?? null;

    const optionalFields = {
      ...(started_at              ? { startedAt: new Date(started_at) }                                  : {}),
      ...(ended_at                ? { endedAt:   new Date(ended_at)   }                                  : {}),
      ...(session_duration_minutes !== undefined ? { sessionDurationMinutes: session_duration_minutes }  : {}),
      ...(efficiency_pct           !== undefined ? { efficiencyPct:          efficiency_pct }            : {}),
      ...(pause_count              !== undefined ? { pauseCount:             pause_count }               : {}),
      ...(paused_minutes           !== undefined ? { pausedMinutes:          paused_minutes }            : {}),
      ...(focus_blocks             !== undefined ? { focusBlocks:            focus_blocks }              : {}),
      ...(tasks_completed          !== undefined ? { tasksCompleted:         tasks_completed }           : {}),
      ...(note                     !== undefined ? { note }                                              : {}),
    };

    const baseFields = {
      worked:         worked !== undefined ? worked : null,
      focusedMinutes: focused_minutes ?? 0,
      idleMinutes:    idle_minutes ?? 0,
      idleReason:     JSON.stringify(idle_reason ?? []),
      feeling:        JSON.stringify(feeling ?? []),
      comboWith:      combo_with ?? null,
      ...optionalFields,
    };

    if (clientId) {
      // Idempotente por clientId: reenvio (retry/offline) atualiza a mesma linha.
      await prisma.sessionUsageLog.upsert({
        where: { clientId },
        update: baseFields,
        create: {
          clientId,
          userId: req.userId,
          modeId: mode_id,
          date,
          hour:   hour ?? 0,
          ...baseFields,
        },
      });
    } else {
      // Sem clientId (registros legados/offline antigos): insere como evento novo.
      await prisma.sessionUsageLog.create({
        data: {
          userId: req.userId,
          modeId: mode_id,
          date,
          hour:   hour ?? 0,
          ...baseFields,
        },
      });
    }

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
        client_id:                r.clientId                ?? null,
        mode_id:                  r.modeId,
        date:                     r.date,
        hour:                     r.hour,
        worked:                   r.worked,
        focused_minutes:          r.focusedMinutes,
        idle_minutes:             r.idleMinutes,
        idle_reason:              parseJson(r.idleReason, []),
        feeling:                  parseJson(r.feeling, []),
        combo_with:               r.comboWith               ?? null,
        started_at:               r.startedAt?.toISOString() ?? null,
        ended_at:                 r.endedAt?.toISOString()   ?? null,
        session_duration_minutes: r.sessionDurationMinutes  ?? null,
        efficiency_pct:           r.efficiencyPct           ?? null,
        pause_count:              r.pauseCount              ?? null,
        paused_minutes:           r.pausedMinutes           ?? null,
        focus_blocks:             r.focusBlocks             ?? null,
        tasks_completed:          r.tasksCompleted          ?? null,
        note:                     r.note                    ?? null,
      })),
      nextCursor,
    };
  });

  // DELETE /session-usage-logs?modeId=X&days=N — apaga histórico de uso (escopo opcional)
  fastify.delete("/", async (req, reply) => {
    const { modeId, days } = req.query ?? {};
    const where = { userId: req.userId };
    if (modeId) where.modeId = modeId;
    const nDays = Number(days);
    if (Number.isFinite(nDays) && nDays > 0) {
      const cutoff = new Date();
      cutoff.setDate(cutoff.getDate() - nDays);
      where.date = { gte: cutoff.toISOString().slice(0, 10) };
    }
    const { count } = await prisma.sessionUsageLog.deleteMany({ where });
    reply.status(200).send({ ok: true, deleted: count });
  });

  // POST /session-usage-logs/bulk — importação de dados locais (usado no primeiro login)
  fastify.post("/bulk", async (req, reply) => {
    const entries = req.body?.entries;
    if (!Array.isArray(entries) || entries.length === 0) {
      return reply.status(400).send({ error: "entries deve ser um array não-vazio." });
    }

    let saved = 0;
    for (const e of entries.slice(0, 1000)) { // máximo 1000 por chamada
      const { client_id, id, mode_id, date, hour, worked, focused_minutes, idle_minutes, idle_reason, feeling, tasks_completed } = e;
      if (!mode_id || !date) continue;
      // Valida campos numéricos para evitar dados corrompidos
      const safeHour = typeof hour === "number" && hour >= 0 && hour <= 23 ? hour : 0;
      const safeFocused = typeof focused_minutes === "number" && focused_minutes >= 0 ? Math.min(focused_minutes, 1440) : 0;
      const safeIdle = typeof idle_minutes === "number" && idle_minutes >= 0 ? Math.min(idle_minutes, 1440) : 0;
      const clientId = client_id ?? id ?? null;
      const createData = {
        userId:         req.userId,
        modeId:         mode_id,
        date,
        hour:           safeHour,
        worked:         worked ?? false,
        focusedMinutes: safeFocused,
        idleMinutes:    safeIdle,
        idleReason:     JSON.stringify(idle_reason ?? []),
        feeling:        JSON.stringify(feeling ?? []),
        ...(tasks_completed !== undefined ? { tasksCompleted: tasks_completed } : {}),
      };
      try {
        if (clientId) {
          await prisma.sessionUsageLog.upsert({
            where:  { clientId },
            update: {},  // não sobrescreve dados existentes no bulk
            create: { clientId, ...createData },
          });
        } else {
          await prisma.sessionUsageLog.create({ data: createData });
        }
        saved++;
      } catch { /* ignora duplicatas */ }
    }

    reply.status(201).send({ ok: true, saved });
  });
}
