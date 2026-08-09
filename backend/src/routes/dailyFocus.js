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
    const { date, completedAt, level, tasks, timings, rushMode, estadoId, tabMode, cycleCount, tabsOpened } = req.body;
    const session = await prisma.dailyFocusSession.create({
      data: {
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
      },
    });
    reply.status(201);
    return { id: session.id };
  });

  // GET /daily-focus/sessions
  fastify.get("/sessions", async (req) => {
    const sessions = await prisma.dailyFocusSession.findMany({
      where: { userId: req.userId },
      orderBy: { createdAt: "desc" },
      take: 200,
    });

    return sessions.map((s) => ({
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
    }));
  });

  // ── Check-ins ─────────────────────────────────────────────────────────────

  // POST /daily-focus/checkins
  fastify.post("/checkins", async (req, reply) => {
    const { estadoId, modeId, date, hour } = req.body;
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

  // PATCH /daily-focus/checkins/feedback
  fastify.patch("/checkins/feedback", async (req, reply) => {
    const { estadoId, modeId, date, rating } = req.body;

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
    };
  });

  // PUT /daily-focus/day-state
  fastify.put("/day-state", async (req, reply) => {
    const { level, usedModes } = req.body;
    const today = new Date(todayIso());

    await prisma.dailyFocusDayState.upsert({
      where: { userId_date: { userId: req.userId, date: today } },
      update: { level, usedModes: JSON.stringify(usedModes ?? {}), updatedAt: new Date() },
      create: { userId: req.userId, date: today, level, usedModes: JSON.stringify(usedModes ?? {}) },
    });

    reply.status(200).send({ ok: true });
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
