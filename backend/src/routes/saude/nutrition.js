/**
 * routes/saude/nutrition.js — Saúde / Alimentação (prefixo /saude/nutrition).
 * Refeições do dia + contador de água. Sem calorias. JWT obrigatório, tudo por userId.
 */
import prisma from "../../prisma.js";
import { authenticate } from "../../auth.js";
import { applyWater, sortMeals, DEFAULT_GLASS_ML, WATER_GOAL_GLASSES } from "../../health/nutrition.js";
import { mealCreate, mealUpdate, waterAdd, dateQuery, zodMessage } from "../../health/validation.js";

function shapeMeal(m) {
  return { id: m.id, date: m.date, type: m.type, time: m.time, description: m.description };
}

function shapeWater(date, log) {
  const glassMl = log?.glassMl ?? DEFAULT_GLASS_ML;
  const count = log?.count ?? 0;
  return { date, count, glassMl, totalMl: count * glassMl, goalGlasses: WATER_GOAL_GLASSES };
}

export default async function nutritionRoutes(fastify) {
  fastify.addHook("preHandler", authenticate);

  // GET /saude/nutrition/meals?date=
  fastify.get("/meals", async (req, reply) => {
    const q = dateQuery.safeParse(req.query ?? {});
    if (!q.success) return reply.status(400).send({ error: zodMessage(q.error) });
    const rows = await prisma.meal.findMany({ where: { userId: req.userId, date: q.data.date } });
    return sortMeals(rows).map(shapeMeal);
  });

  fastify.post("/meals", async (req, reply) => {
    const parsed = mealCreate.safeParse(req.body ?? {});
    if (!parsed.success) return reply.status(400).send({ error: zodMessage(parsed.error) });
    const row = await prisma.meal.create({ data: { userId: req.userId, ...parsed.data } });
    return reply.status(201).send(shapeMeal(row));
  });

  fastify.patch("/meals/:id", async (req, reply) => {
    const parsed = mealUpdate.safeParse(req.body ?? {});
    if (!parsed.success) return reply.status(400).send({ error: zodMessage(parsed.error) });
    const own = await prisma.meal.findFirst({ where: { id: req.params.id, userId: req.userId } });
    if (!own) return reply.status(404).send({ error: "Refeição não encontrada." });
    const row = await prisma.meal.update({ where: { id: own.id }, data: parsed.data });
    return shapeMeal(row);
  });

  fastify.delete("/meals/:id", async (req, reply) => {
    const own = await prisma.meal.findFirst({ where: { id: req.params.id, userId: req.userId } });
    if (!own) return reply.status(404).send({ error: "Refeição não encontrada." });
    await prisma.meal.delete({ where: { id: own.id } });
    return reply.status(204).send();
  });

  // GET /saude/nutrition/water?date=
  fastify.get("/water", async (req, reply) => {
    const q = dateQuery.safeParse(req.query ?? {});
    if (!q.success) return reply.status(400).send({ error: zodMessage(q.error) });
    const log = await prisma.waterLog.findFirst({ where: { userId: req.userId, date: q.data.date } });
    return shapeWater(q.data.date, log);
  });

  // POST /saude/nutrition/water/add { date, delta }  (+1 copo; -1 desfaz; nunca abaixo de 0)
  fastify.post("/water/add", async (req, reply) => {
    const parsed = waterAdd.safeParse(req.body ?? {});
    if (!parsed.success) return reply.status(400).send({ error: zodMessage(parsed.error) });
    const { date, delta } = parsed.data;

    const log = await prisma.$transaction(async (tx) => {
      const existing = await tx.waterLog.findFirst({ where: { userId: req.userId, date } });
      if (!existing) {
        return tx.waterLog.create({ data: { userId: req.userId, date, count: applyWater(0, delta) } });
      }
      return tx.waterLog.update({ where: { id: existing.id }, data: { count: applyWater(existing.count, delta) } });
    });
    return shapeWater(date, log);
  });
}
