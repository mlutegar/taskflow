import prisma from "../prisma.js";
import { authenticate } from "../auth.js";

function parseJson(val, fallback) {
  try { return JSON.parse(val); } catch { return fallback; }
}

function todayIso() {
  const d = new Date();
  return [d.getFullYear(), String(d.getMonth() + 1).padStart(2, "0"), String(d.getDate()).padStart(2, "0")].join("-");
}

const RETENTION_DAYS = 365;

export default async function preferencesRoutes(fastify) {
  fastify.addHook("preHandler", authenticate);

  // ── Preferências do usuário ────────────────────────────────────────────────

  // GET /preferences
  fastify.get("/", async (req) => {
    const row = await prisma.userPreferences.findUnique({
      where: { userId: req.userId },
    });

    return {
      customModes:    parseJson(row?.customModes,    []),
      deletedModeIds: parseJson(row?.deletedModeIds, []),
      weeklyGoal:     row?.weeklyGoal ?? 5,
      activities:     parseJson(row?.activities,     []),
      estadosCustom:  parseJson(row?.estadosCustom,  []),
      paperReminders: parseJson(row?.paperReminders, []),
      lastEstadoId:   row?.lastEstadoId ?? null,
      onboarded:      row?.onboarded ?? false,
    };
  });

  // PUT /preferences  — aceita patch parcial (campos omitidos não são alterados)
  fastify.put("/", async (req, reply) => {
    const {
      customModes, deletedModeIds, weeklyGoal, activities,
      estadosCustom, paperReminders, lastEstadoId, onboarded,
    } = req.body ?? {};

    const existing = await prisma.userPreferences.findUnique({
      where: { userId: req.userId },
    });

    const updateData = {};
    if (customModes    !== undefined) updateData.customModes    = JSON.stringify(customModes);
    if (deletedModeIds !== undefined) updateData.deletedModeIds = JSON.stringify(deletedModeIds);
    if (weeklyGoal     !== undefined) updateData.weeklyGoal     = weeklyGoal;
    if (activities     !== undefined) updateData.activities     = JSON.stringify(activities);
    if (estadosCustom  !== undefined) updateData.estadosCustom  = JSON.stringify(estadosCustom);
    if (paperReminders !== undefined) updateData.paperReminders = JSON.stringify(paperReminders);
    if (lastEstadoId   !== undefined) updateData.lastEstadoId   = lastEstadoId;
    if (onboarded      !== undefined) updateData.onboarded      = onboarded;

    if (existing) {
      await prisma.userPreferences.update({
        where: { userId: req.userId },
        data: updateData,
      });
    } else {
      await prisma.userPreferences.create({
        data: {
          userId:         req.userId,
          customModes:    updateData.customModes    ?? "[]",
          deletedModeIds: updateData.deletedModeIds ?? "[]",
          weeklyGoal:     updateData.weeklyGoal     ?? 5,
          activities:     updateData.activities     ?? "[]",
          estadosCustom:  updateData.estadosCustom  ?? "[]",
          paperReminders: updateData.paperReminders ?? "[]",
          lastEstadoId:   updateData.lastEstadoId   ?? null,
          onboarded:      updateData.onboarded      ?? false,
        },
      });
    }

    reply.status(200).send({ ok: true });
  });

  // ── Ativações de modo ──────────────────────────────────────────────────────

  // POST /preferences/mode-activations  { modeId, date }
  fastify.post("/mode-activations", async (req, reply) => {
    const { modeId, date } = req.body ?? {};
    if (!modeId || !date) return reply.status(400).send({ error: "modeId e date são obrigatórios." });

    await prisma.userModeActivation.upsert({
      where: { userId_modeId_date: { userId: req.userId, modeId, date } },
      update: {},
      create: { userId: req.userId, modeId, date },
    });

    reply.status(201).send({ ok: true });
  });

  // GET /preferences/mode-activations  — últimos 365 dias
  fastify.get("/mode-activations", async (req) => {
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - RETENTION_DAYS);
    const cutoffStr = cutoff.toISOString().slice(0, 10);

    const rows = await prisma.userModeActivation.findMany({
      where: {
        userId: req.userId,
        date: { gte: cutoffStr },
      },
      orderBy: { createdAt: "asc" },
    });

    return rows.map((r) => ({ modeId: r.modeId, date: r.date }));
  });
}
