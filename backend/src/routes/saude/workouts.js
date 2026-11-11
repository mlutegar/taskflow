/**
 * routes/saude/workouts.js — Saúde / Exercícios (prefixo /saude/workouts).
 * Treinos registrados + planejamento semanal. JWT obrigatório, tudo por userId.
 */
import prisma from "../../prisma.js";
import { authenticate } from "../../auth.js";
import { plannedForDate, summarize } from "../../health/workouts.js";
import { dateQuery, rangeQuery, zodMessage } from "../../health/validation.js";
import { workoutCreate, workoutUpdate, planCreate, planUpdate } from "../../health/workoutValidation.js";

function shapeWorkout(w) {
  return { id: w.id, date: w.date, type: w.type, durationMin: w.durationMin, notes: w.notes, planId: w.planId };
}

function shapePlan(p) {
  return { id: p.id, weekday: p.weekday, type: p.type, durationMin: p.durationMin, order: p.order };
}

export default async function workoutsRoutes(fastify) {
  fastify.addHook("preHandler", authenticate);

  // ── Plano semanal ─────────────────────────────────────────────────────────
  fastify.get("/plan", async (req) => {
    const rows = await prisma.workoutPlan.findMany({
      where: { userId: req.userId },
      orderBy: [{ weekday: "asc" }, { order: "asc" }, { createdAt: "asc" }],
    });
    return rows.map(shapePlan);
  });

  fastify.post("/plan", async (req, reply) => {
    const parsed = planCreate.safeParse(req.body ?? {});
    if (!parsed.success) return reply.status(400).send({ error: zodMessage(parsed.error) });
    const v = parsed.data;
    const last = await prisma.workoutPlan.findFirst({
      where: { userId: req.userId, weekday: v.weekday },
      orderBy: { order: "desc" },
    });
    const row = await prisma.workoutPlan.create({
      data: { userId: req.userId, weekday: v.weekday, type: v.type, durationMin: v.durationMin ?? null, order: (last?.order ?? -1) + 1 },
    });
    return reply.status(201).send(shapePlan(row));
  });

  fastify.patch("/plan/:id", async (req, reply) => {
    const parsed = planUpdate.safeParse(req.body ?? {});
    if (!parsed.success) return reply.status(400).send({ error: zodMessage(parsed.error) });
    const own = await prisma.workoutPlan.findFirst({ where: { id: req.params.id, userId: req.userId } });
    if (!own) return reply.status(404).send({ error: "Item do plano não encontrado." });
    const row = await prisma.workoutPlan.update({ where: { id: own.id }, data: parsed.data });
    return shapePlan(row);
  });

  // Apagar do plano não apaga treinos já feitos (planId é só referência).
  fastify.delete("/plan/:id", async (req, reply) => {
    const own = await prisma.workoutPlan.findFirst({ where: { id: req.params.id, userId: req.userId } });
    if (!own) return reply.status(404).send({ error: "Item do plano não encontrado." });
    await prisma.workoutPlan.delete({ where: { id: own.id } });
    return reply.status(204).send();
  });

  // ── Dia: planejados (com "feito") + treinos registrados ───────────────────
  // GET /saude/workouts/today?date=
  fastify.get("/today", async (req, reply) => {
    const q = dateQuery.safeParse(req.query ?? {});
    if (!q.success) return reply.status(400).send({ error: zodMessage(q.error) });
    const { date } = q.data;
    const [plan, workouts] = await Promise.all([
      prisma.workoutPlan.findMany({ where: { userId: req.userId } }),
      prisma.workout.findMany({ where: { userId: req.userId, date }, orderBy: { createdAt: "asc" } }),
    ]);
    return { date, planned: plannedForDate(plan, workouts, date), workouts: workouts.map(shapeWorkout) };
  });

  // ── Treinos ───────────────────────────────────────────────────────────────
  // GET /saude/workouts?from=&to=   → { workouts, summary }
  fastify.get("/", async (req, reply) => {
    const q = rangeQuery.safeParse(req.query ?? {});
    if (!q.success) return reply.status(400).send({ error: zodMessage(q.error) });
    const { from, to } = q.data;
    if (to < from) return reply.status(400).send({ error: "to: Fim antes do início" });
    const rows = await prisma.workout.findMany({
      where: { userId: req.userId, date: { gte: from, lte: to } },
      orderBy: [{ date: "desc" }, { createdAt: "desc" }],
      take: 1000,
    });
    return { workouts: rows.map(shapeWorkout), summary: summarize(rows) };
  });

  fastify.post("/", async (req, reply) => {
    const parsed = workoutCreate.safeParse(req.body ?? {});
    if (!parsed.success) return reply.status(400).send({ error: zodMessage(parsed.error) });
    const v = parsed.data;

    if (v.planId) {
      const plan = await prisma.workoutPlan.findFirst({ where: { id: v.planId, userId: req.userId } });
      if (!plan) return reply.status(400).send({ error: "planId: item do plano não encontrado" });
      const already = await prisma.workout.findFirst({ where: { userId: req.userId, planId: v.planId, date: v.date } });
      if (already) return reply.status(409).send({ error: "Este treino do plano já foi registrado neste dia." });
    }

    const row = await prisma.workout.create({
      data: {
        userId: req.userId,
        date: v.date,
        type: v.type,
        durationMin: v.durationMin,
        notes: v.notes || null,
        planId: v.planId ?? null,
      },
    });
    return reply.status(201).send(shapeWorkout(row));
  });

  fastify.patch("/:id", async (req, reply) => {
    const parsed = workoutUpdate.safeParse(req.body ?? {});
    if (!parsed.success) return reply.status(400).send({ error: zodMessage(parsed.error) });
    const own = await prisma.workout.findFirst({ where: { id: req.params.id, userId: req.userId } });
    if (!own) return reply.status(404).send({ error: "Treino não encontrado." });
    const data = { ...parsed.data };
    if (data.notes !== undefined) data.notes = data.notes || null;
    const row = await prisma.workout.update({ where: { id: own.id }, data });
    return shapeWorkout(row);
  });

  fastify.delete("/:id", async (req, reply) => {
    const own = await prisma.workout.findFirst({ where: { id: req.params.id, userId: req.userId } });
    if (!own) return reply.status(404).send({ error: "Treino não encontrado." });
    await prisma.workout.delete({ where: { id: own.id } });
    return reply.status(204).send();
  });
}
