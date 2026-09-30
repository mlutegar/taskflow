import prisma from "../prisma.js";
import { authenticate } from "../auth.js";

function todayIso() {
  const d = new Date();
  return [d.getFullYear(), String(d.getMonth() + 1).padStart(2, "0"), String(d.getDate()).padStart(2, "0")].join("-");
}

function ptBRToIso(str) {
  const [d, m, y] = (str || "").split("/");
  return `${y}-${m}-${d}`;
}

function isoToPtBR(str) {
  const [y, m, d] = (str || "").split("-");
  return `${d}/${m}/${y}`;
}

function parseJson(val, fallback) {
  try { return JSON.parse(val); } catch { return fallback; }
}

export default async function dailyFocusRoutes(fastify) {
  fastify.addHook("preHandler", authenticate);

  // ── Sessões ────────────────────────────────────────────────────────────────

  // POST /daily-focus/sessions
  fastify.post("/sessions", async (req, reply) => {
    const { clientId, date, completedAt, level, tasks, timings, rushMode, estadoId, tabMode, cycleCount, tabsOpened } = req.body ?? {};

    if (!date || !/^\d{2}\/\d{2}\/\d{4}$/.test(date)) {
      return reply.status(400).send({ error: "date obrigatório no formato DD/MM/YYYY." });
    }

    const data = {
      userId: req.userId,
      date: new Date(ptBRToIso(date)),
      completedAt: completedAt || null,
      level: level ?? 1,
      tasks: JSON.stringify(tasks ?? []),
      timings: JSON.stringify(timings ?? []),
      rushMode: rushMode ?? false,
      estadoId: estadoId || null,
      tabMode: tabMode ?? false,
      cycleCount: cycleCount ?? 0,
      tabsOpened: tabsOpened ?? 0,
    };

    // Com clientId → upsert idempotente: reenvios (retry/offline/multi-device)
    // não criam duplicatas. Sem clientId → create (compatibilidade com clientes antigos).
    let session;
    if (clientId && typeof clientId === "string") {
      session = await prisma.dailyFocusSession.upsert({
        where: { userId_clientId: { userId: req.userId, clientId } },
        create: { ...data, clientId },
        update: data,
      });
    } else {
      session = await prisma.dailyFocusSession.create({ data });
    }
    reply.status(201);
    return { id: session.id };
  });

  // GET /daily-focus/sessions?page=1&limit=50
  fastify.get("/sessions", async (req) => {
    const page  = Math.max(1, parseInt(req.query.page  ?? "1",  10));
    const limit = Math.min(200, Math.max(1, parseInt(req.query.limit ?? "50", 10)));
    const skip  = (page - 1) * limit;

    const [total, sessions] = await Promise.all([
      prisma.dailyFocusSession.count({ where: { userId: req.userId } }),
      prisma.dailyFocusSession.findMany({
        where: { userId: req.userId },
        orderBy: { createdAt: "desc" },
        skip,
        take: limit,
      }),
    ]);

    return {
      data: sessions.map((s) => ({
        clientId: s.clientId ?? null,
        date: isoToPtBR(s.date.toISOString().split("T")[0]),
        completedAt: s.completedAt || "",
        level: s.level,
        tasks: parseJson(s.tasks, []),
        timings: parseJson(s.timings, []),
        rushMode: s.rushMode,
        estadoId: s.estadoId,
        tabMode: s.tabMode,
        cycleCount: s.cycleCount,
        tabsOpened: s.tabsOpened,
      })),
      pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
    };
  });

  // DELETE /daily-focus/sessions?days=N — apaga histórico de sessões (escopo opcional por período)
  fastify.delete("/sessions", async (req, reply) => {
    const { days } = req.query ?? {};
    const where = { userId: req.userId };
    const nDays = Number(days);
    if (Number.isFinite(nDays) && nDays > 0) {
      const cutoff = new Date();
      cutoff.setDate(cutoff.getDate() - nDays);
      where.date = { gte: cutoff };
    }
    const { count } = await prisma.dailyFocusSession.deleteMany({ where });
    reply.status(200).send({ ok: true, deleted: count });
  });

  // ── Check-ins ─────────────────────────────────────────────────────────────

  // POST /daily-focus/checkins
  fastify.post("/checkins", async (req, reply) => {
    const { estadoId, modeId, date, hour } = req.body ?? {};

    if (!estadoId || typeof estadoId !== "string") {
      return reply.status(400).send({ error: "estadoId obrigatório." });
    }
    if (!modeId || typeof modeId !== "string") {
      return reply.status(400).send({ error: "modeId obrigatório." });
    }
    if (!date) {
      return reply.status(400).send({ error: "date obrigatório." });
    }
    if (hour === undefined || hour === null || hour < 0 || hour > 23) {
      return reply.status(400).send({ error: "hour deve ser entre 0 e 23." });
    }

    await prisma.dailyFocusCheckin.create({
      data: {
        userId: req.userId,
        estadoId,
        modeId,
        date: new Date(date),
        hour,
      },
    });
    reply.status(201).send({ ok: true });
  });

  // GET /daily-focus/checkins
  fastify.get("/checkins", async (req) => {
    const rows = await prisma.dailyFocusCheckin.findMany({
      where: { userId: req.userId },
      orderBy: { createdAt: "asc" },
    });

    const checkins = rows.map((r) => ({
      estadoId: r.estadoId,
      modeId: r.modeId,
      date: r.date.toISOString().split("T")[0],
      hour: r.hour,
    }));

    const feedbacks = rows
      .filter((r) => r.rating !== null)
      .map((r) => ({
        estadoId: r.estadoId,
        modeId: r.modeId,
        rating: r.rating,
        date: r.date.toISOString().split("T")[0],
      }));

    return { checkins, feedbacks };
  });

  // DELETE /daily-focus/checkins?modeId=X&days=N — apaga check-ins/feedbacks (escopo opcional)
  fastify.delete("/checkins", async (req, reply) => {
    const { modeId, days } = req.query ?? {};
    const where = { userId: req.userId };
    if (modeId) where.modeId = modeId;
    const nDays = Number(days);
    if (Number.isFinite(nDays) && nDays > 0) {
      const cutoff = new Date();
      cutoff.setDate(cutoff.getDate() - nDays);
      where.date = { gte: cutoff };
    }
    const { count } = await prisma.dailyFocusCheckin.deleteMany({ where });
    reply.status(200).send({ ok: true, deleted: count });
  });

  // PATCH /daily-focus/checkins/feedback
  fastify.patch("/checkins/feedback", async (req, reply) => {
    const { estadoId, modeId, date, rating } = req.body ?? {};

    if (rating !== -1 && rating !== 1) {
      return reply.status(400).send({ error: "rating deve ser -1 ou 1." });
    }

    const existing = await prisma.dailyFocusCheckin.findFirst({
      where: {
        userId: req.userId,
        estadoId,
        modeId,
        date: new Date(date),
      },
      orderBy: { createdAt: "desc" },
    });

    if (existing) {
      await prisma.dailyFocusCheckin.update({
        where: { id: existing.id },
        data: { rating },
      });
    } else {
      await prisma.dailyFocusCheckin.create({
        data: {
          userId: req.userId,
          estadoId,
          modeId,
          date: new Date(date),
          hour: new Date().getHours(),
          rating,
        },
      });
    }

    reply.status(200).send({ ok: true });
  });

  // ── Emoções (checkpoint emocional por sessão) ───────────────────────────────

  // POST /daily-focus/emotions
  fastify.post("/emotions", async (req, reply) => {
    const {
      emotion, moment, intensity, date, hour, timestamp,
      taskTitle, taskIndex, taskId, modeIds, level,
      rushMode, tabMode, pauseSecs, completed, usedSecs, totalSecs,
    } = req.body ?? {};

    if (!emotion || typeof emotion !== "string") {
      return reply.status(400).send({ error: "emotion obrigatório." });
    }
    if (moment !== "start" && moment !== "resume" && moment !== "end") {
      return reply.status(400).send({ error: "moment deve ser 'start', 'resume' ou 'end'." });
    }
    if (!date) {
      return reply.status(400).send({ error: "date obrigatório." });
    }
    if (hour === undefined || hour === null || hour < 0 || hour > 23) {
      return reply.status(400).send({ error: "hour deve ser entre 0 e 23." });
    }
    if (intensity && intensity !== "leve" && intensity !== "forte") {
      return reply.status(400).send({ error: "intensity deve ser 'leve' ou 'forte'." });
    }

    // Dedup: mesmo (userId, timestamp, moment) já gravado → idempotente.
    if (timestamp) {
      const dup = await prisma.dailyFocusEmotion.findFirst({
        where: { userId: req.userId, timestamp, moment },
      });
      if (dup) return reply.status(200).send({ ok: true, deduped: true });
    }

    await prisma.dailyFocusEmotion.create({
      data: {
        userId: req.userId,
        emotion,
        moment,
        intensity: intensity || null,
        date: new Date(date),
        hour,
        timestamp: timestamp || null,
        taskTitle: taskTitle || null,
        taskIndex: taskIndex ?? null,
        taskId: taskId || null,
        modeIds: Array.isArray(modeIds) ? JSON.stringify(modeIds) : null,
        level: level ?? null,
        rushMode: rushMode ?? null,
        tabMode: tabMode ?? null,
        pauseSecs: pauseSecs ?? null,
        completed: completed ?? null,
        usedSecs: usedSecs ?? null,
        totalSecs: totalSecs ?? null,
      },
    });
    reply.status(201).send({ ok: true });
  });

  // GET /daily-focus/emotions
  fastify.get("/emotions", async (req) => {
    const rows = await prisma.dailyFocusEmotion.findMany({
      where: { userId: req.userId },
      orderBy: { createdAt: "asc" },
    });

    const emotions = rows.map((r) => ({
      emotion: r.emotion,
      moment: r.moment,
      intensity: r.intensity ?? undefined,
      date: r.date.toISOString().split("T")[0],
      hour: r.hour,
      timestamp: r.timestamp || r.createdAt.toISOString(),
      taskTitle: r.taskTitle ?? undefined,
      taskIndex: r.taskIndex ?? undefined,
      taskId: r.taskId ?? undefined,
      modeIds: r.modeIds ? parseJson(r.modeIds, undefined) : undefined,
      level: r.level ?? undefined,
      rushMode: r.rushMode ?? undefined,
      tabMode: r.tabMode ?? undefined,
      pauseSecs: r.pauseSecs ?? undefined,
      completed: r.completed ?? undefined,
      usedSecs: r.usedSecs ?? undefined,
      totalSecs: r.totalSecs ?? undefined,
    }));

    return { emotions };
  });

  // ── Estado do dia ──────────────────────────────────────────────────────────

  // GET /daily-focus/day-state
  fastify.get("/day-state", async (req) => {
    const today = new Date(todayIso());
    const state = await prisma.dailyFocusDayState.findUnique({
      where: { userId_date: { userId: req.userId, date: today } },
    });

    if (!state) return null;

    return {
      date: state.date.toISOString().split("T")[0],
      level: state.level,
      usedModes: parseJson(state.usedModes, {}),
      continuousActivity: state.continuousActivity ? parseJson(state.continuousActivity, null) : null,
      continuousCompleted: state.continuousCompleted ? parseJson(state.continuousCompleted, []) : [],
    };
  });

  // PUT /daily-focus/day-state
  // Atualização parcial: só toca nos campos presentes no body (level / usedModes / continuousActivity).
  fastify.put("/day-state", async (req, reply) => {
    const { level, usedModes, continuousActivity, continuousCompleted } = req.body ?? {};
    const today = new Date(todayIso());

    const update = { updatedAt: new Date() };
    if (level !== undefined) update.level = level;
    if (usedModes !== undefined) update.usedModes = JSON.stringify(usedModes ?? {});
    if (continuousActivity !== undefined) {
      update.continuousActivity = continuousActivity ? JSON.stringify(continuousActivity) : null;
    }
    if (continuousCompleted !== undefined) {
      update.continuousCompleted = continuousCompleted ? JSON.stringify(continuousCompleted) : null;
    }

    await prisma.dailyFocusDayState.upsert({
      where: { userId_date: { userId: req.userId, date: today } },
      update,
      create: {
        userId: req.userId,
        date: today,
        level: level ?? 0,
        usedModes: JSON.stringify(usedModes ?? {}),
        continuousActivity: continuousActivity ? JSON.stringify(continuousActivity) : null,
        continuousCompleted: continuousCompleted ? JSON.stringify(continuousCompleted) : null,
      },
    });

    reply.status(200).send({ ok: true });
  });

  // ── Sessão ativa (cross-device) ──────────────────────────────────────────────
  // Persiste a sessão de foco EM ANDAMENTO para reidratar em outro dispositivo.
  // Uma por usuário; last-write-wins. Só vale para o dia corrente.

  // Limite de tamanho do payload (evita gravar blobs enormes por bug/abuso).
  const ACTIVE_SESSION_MAX_BYTES = 128 * 1024; // 128 KB

  // GET /daily-focus/active-session
  fastify.get("/active-session", async (req) => {
    const row = await prisma.dailyFocusActiveSession.findUnique({
      where: { userId: req.userId },
    });
    if (!row) return null;

    // Higiene: se a linha é de outro dia, apaga e não devolve (evita lixo acumulando).
    const rowDate = row.date.toISOString().split("T")[0];
    if (rowDate !== todayIso()) {
      await prisma.dailyFocusActiveSession.deleteMany({ where: { userId: req.userId } });
      return null;
    }

    return {
      date: rowDate,
      live: parseJson(row.live, null),
      session: parseJson(row.session, {}),
      focusTimer: row.focusTimer ? parseJson(row.focusTimer, null) : null,
      version: row.version,
      endedAt: row.endedAt ? row.endedAt.toISOString() : null,
      updatedAt: row.updatedAt.toISOString(),
    };
  });

  // PUT /daily-focus/active-session
  // Concorrência otimística: se `baseVersion` for enviado e não bater com a versão
  // atual do servidor, responde 409 com a versão vigente (o cliente decide re-tentar).
  // A versão é um contador monotônico — imune a divergências de relógio entre devices.
  fastify.put("/active-session", async (req, reply) => {
    const { live, session, focusTimer, baseVersion } = req.body ?? {};

    // Guarda de tamanho.
    const rawSize = Buffer.byteLength(JSON.stringify({ live, session, focusTimer }), "utf8");
    if (rawSize > ACTIVE_SESSION_MAX_BYTES) {
      return reply.status(413).send({ error: "Payload da sessão ativa excede o limite." });
    }

    const today = new Date(todayIso());
    const now = new Date();

    const existing = await prisma.dailyFocusActiveSession.findUnique({
      where: { userId: req.userId },
    });

    // Conflito de versão: alguém gravou entre o read e o write do cliente.
    if (existing && typeof baseVersion === "number" && existing.version !== baseVersion) {
      return reply.status(409).send({
        error: "conflict",
        version: existing.version,
        updatedAt: existing.updatedAt.toISOString(),
      });
    }

    const nextVersion = (existing?.version ?? 0) + 1;
    const data = {
      date: today,
      live: JSON.stringify(live ?? null),
      session: JSON.stringify(session ?? {}),
      focusTimer: focusTimer != null ? JSON.stringify(focusTimer) : null,
      version: nextVersion,
      endedAt: null, // um PUT reabre/reativa (limpa tombstone)
      updatedAt: now,
    };

    await prisma.dailyFocusActiveSession.upsert({
      where: { userId: req.userId },
      update: data,
      create: { userId: req.userId, ...data },
    });

    reply.status(200).send({ ok: true, version: nextVersion, updatedAt: now.toISOString() });
  });

  // DELETE /daily-focus/active-session
  // Tombstone: marca `endedAt` (mantém a linha p/ o outro device detectar o fim no
  // próximo GET/poll). A limpeza física acontece no GET de outro dia. `?hard=1` apaga já.
  fastify.delete("/active-session", async (req, reply) => {
    if (req.query?.hard === "1") {
      await prisma.dailyFocusActiveSession.deleteMany({ where: { userId: req.userId } });
      return reply.status(200).send({ ok: true, ended: true });
    }

    const existing = await prisma.dailyFocusActiveSession.findUnique({
      where: { userId: req.userId },
    });
    if (!existing) return reply.status(200).send({ ok: true, ended: true });

    await prisma.dailyFocusActiveSession.update({
      where: { userId: req.userId },
      data: { endedAt: new Date(), version: existing.version + 1, updatedAt: new Date() },
    });
    reply.status(200).send({ ok: true, ended: true, version: existing.version + 1 });
  });

  // ── Achievements ───────────────────────────────────────────────────────────

  // GET /daily-focus/achievements
  fastify.get("/achievements", async (req) => {
    const row = await prisma.dailyFocusAchievement.findUnique({
      where: { userId: req.userId },
    });
    return parseJson(row?.achievementIds, []);
  });

  // POST /daily-focus/achievements/:id
  fastify.post("/achievements/:id", async (req, reply) => {
    const { id } = req.params;
    const userId = req.userId;

    const existing = await prisma.dailyFocusAchievement.findUnique({ where: { userId } });
    const current = parseJson(existing?.achievementIds, []);

    if (!current.includes(id)) {
      await prisma.dailyFocusAchievement.upsert({
        where: { userId },
        update: { achievementIds: JSON.stringify([...current, id]), updatedAt: new Date() },
        create: { userId, achievementIds: JSON.stringify([id]) },
      });
    }

    reply.status(200).send({ ok: true });
  });
}
