import prisma from "../prisma.js";
import { authenticate } from "../auth.js";

const TODAY = () => new Date().toISOString().split("T")[0];

function parseJson(val, fallback) {
  try { return JSON.parse(val); } catch { return fallback; }
}

function shapeRoutine(routine) {
  const checklist = (routine.checklist ?? []).sort((a, b) => a.order - b.order || Number(a.id) - Number(b.id));
  const today = TODAY();
  const lastDate = routine.lastCompletedDate?.toISOString().split("T")[0] ?? null;
  const isCompletedToday = lastDate === today;
  const progressPercentage = routine.targetValue
    ? Math.min(100, (routine.currentProgress / routine.targetValue) * 100)
    : null;
  const completionHistory = parseJson(routine.completionHistory, []);

  return {
    id: routine.id,
    user_id: routine.userId,
    title: routine.title,
    description: routine.description,
    target_value: routine.targetValue,
    unit: routine.unit,
    current_progress: routine.currentProgress,
    last_completed_date: lastDate,
    completion_history: completionHistory,
    created_at: routine.createdAt,
    checklist,
    checklist_count: checklist.length,
    checklist_completed_count: checklist.filter((c) => c.completed).length,
    is_completed_today: isCompletedToday,
    progress_percentage: progressPercentage,
  };
}

async function fetchRoutine(id, userId) {
  const routine = await prisma.routine.findFirst({
    where: { id, userId },
    include: { checklist: true },
  });
  if (!routine) throw new Error("Rotina não encontrada.");
  return routine;
}

async function ensureDailyReset(routine) {
  const today = TODAY();
  const lastDate = routine.lastCompletedDate?.toISOString().split("T")[0] ?? null;

  if (lastDate && lastDate < today) {
    const updates = [];
    if (routine.currentProgress > 0) {
      updates.push(prisma.routine.update({ where: { id: routine.id }, data: { currentProgress: 0 } }));
      routine.currentProgress = 0;
    }
    updates.push(
      prisma.routineChecklistItem.updateMany({
        where: { routineId: routine.id, completed: true },
        data: { completed: false },
      })
    );
    await Promise.all(updates);
    if (routine.checklist) {
      routine.checklist = routine.checklist.map((c) => ({ ...c, completed: false }));
    }
  }
  return routine;
}

const MUTATION_RATE_LIMIT = {
  config: {
    rateLimit: {
      max: 100,
      timeWindow: 5 * 60 * 1000,
      keyGenerator: (req) => req.userId ?? req.ip,
      errorResponseBuilder: () => ({
        statusCode: 429,
        error: "Too Many Requests",
        message: "Muitas requisições. Tente novamente em alguns minutos.",
      }),
    },
  },
};

export default async function routinesRoutes(fastify) {
  fastify.addHook("preHandler", authenticate);

  // GET /routines
  fastify.get("/", async (req) => {
    const { status } = req.query;
    const routines = await prisma.routine.findMany({
      where: { userId: req.userId },
      orderBy: { title: "asc" },
      include: { checklist: true },
    });

    const reset = await Promise.all(routines.map(ensureDailyReset));
    const shaped = reset.map(shapeRoutine);

    if (status === "pending") return shaped.filter((r) => !r.is_completed_today);
    if (status === "done") return shaped.filter((r) => r.is_completed_today);
    return shaped;
  });

  // POST /routines
  fastify.post("/", MUTATION_RATE_LIMIT, async (req, reply) => {
    const { title, description, target_value, unit } = req.body;
    const routine = await prisma.routine.create({
      data: {
        userId: req.userId,
        title,
        description,
        targetValue: target_value ?? null,
        unit: unit ?? null,
      },
      include: { checklist: true },
    });
    reply.status(201);
    return shapeRoutine(routine);
  });

  // PATCH /routines/:id
  fastify.patch("/:id", MUTATION_RATE_LIMIT, async (req, reply) => {
    const { id } = req.params;
    const existing = await prisma.routine.findFirst({ where: { id, userId: req.userId } });
    if (!existing) return reply.status(404).send({ error: "Rotina não encontrada." });

    const body = req.body;
    const data = {};
    if (body.title !== undefined) data.title = body.title;
    if (body.description !== undefined) data.description = body.description;
    if (body.target_value !== undefined) data.targetValue = body.target_value;
    if (body.unit !== undefined) data.unit = body.unit;
    if (body.current_progress !== undefined) data.currentProgress = body.current_progress;
    if (body.last_completed_date !== undefined) data.lastCompletedDate = body.last_completed_date ? new Date(body.last_completed_date) : null;
    if (body.completion_history !== undefined) data.completionHistory = JSON.stringify(body.completion_history);

    const routine = await prisma.routine.update({
      where: { id },
      data,
      include: { checklist: true },
    });
    return shapeRoutine(routine);
  });

  // DELETE /routines/:id
  fastify.delete("/:id", MUTATION_RATE_LIMIT, async (req, reply) => {
    const existing = await prisma.routine.findFirst({ where: { id: req.params.id, userId: req.userId } });
    if (!existing) return reply.status(404).send({ error: "Rotina não encontrada." });
    await prisma.routine.delete({ where: { id: req.params.id } });
    reply.status(204).send();
  });

  // POST /routines/:id/complete
  fastify.post("/:id/complete", MUTATION_RATE_LIMIT, async (req, reply) => {
    const today = TODAY();
    const routine = await fetchRoutine(req.params.id, req.userId);
    const currentHistory = parseJson(routine.completionHistory, []);
    const history = [...new Set([...currentHistory, today])];
    const data = {
      lastCompletedDate: new Date(today),
      completionHistory: JSON.stringify(history),
      ...(routine.targetValue ? { currentProgress: routine.targetValue } : {}),
    };
    await prisma.routineChecklistItem.updateMany({ where: { routineId: routine.id }, data: { completed: true } });
    const updated = await prisma.routine.update({ where: { id: routine.id }, data, include: { checklist: true } });
    return shapeRoutine(updated);
  });

  // POST /routines/:id/uncomplete
  fastify.post("/:id/uncomplete", MUTATION_RATE_LIMIT, async (req, reply) => {
    const today = TODAY();
    const routine = await fetchRoutine(req.params.id, req.userId);
    const currentHistory = parseJson(routine.completionHistory, []);
    const history = currentHistory.filter((d) => d !== today);
    const lastDate = history.length > 0 ? history[history.length - 1] : null;
    const data = {
      lastCompletedDate: lastDate ? new Date(lastDate) : null,
      completionHistory: JSON.stringify(history),
      ...(routine.targetValue ? { currentProgress: 0 } : {}),
    };
    await prisma.routineChecklistItem.updateMany({ where: { routineId: routine.id }, data: { completed: false } });
    const updated = await prisma.routine.update({ where: { id: routine.id }, data, include: { checklist: true } });
    return shapeRoutine(updated);
  });

  // POST /routines/:id/complete-date
  fastify.post("/:id/complete-date", MUTATION_RATE_LIMIT, async (req, reply) => {
    const { date } = req.body;
    const today = TODAY();
    if (date > today) return reply.status(400).send({ error: "Não é possível marcar para data futura." });

    const routine = await fetchRoutine(req.params.id, req.userId);
    const currentHistory = parseJson(routine.completionHistory, []);
    const history = [...new Set([...currentHistory, date])].sort();
    const lastDate =
      !routine.lastCompletedDate || date > routine.lastCompletedDate.toISOString().split("T")[0]
        ? date
        : routine.lastCompletedDate.toISOString().split("T")[0];

    const updated = await prisma.routine.update({
      where: { id: routine.id },
      data: { completionHistory: JSON.stringify(history), lastCompletedDate: new Date(lastDate) },
      include: { checklist: true },
    });
    return shapeRoutine(updated);
  });

  // POST /routines/:id/progress
  fastify.post("/:id/progress", MUTATION_RATE_LIMIT, async (req, reply) => {
    const { amount } = req.body;
    const today = TODAY();
    const routine = await fetchRoutine(req.params.id, req.userId);
    await ensureDailyReset(routine);

    if (!routine.targetValue) return reply.status(400).send({ error: "Rotina não tem valor alvo." });

    const newProgress = Math.min(routine.targetValue, routine.currentProgress + amount);
    const data = { currentProgress: newProgress };

    if (newProgress >= routine.targetValue) {
      const currentHistory = parseJson(routine.completionHistory, []);
      const history = [...new Set([...currentHistory, today])];
      data.lastCompletedDate = new Date(today);
      data.completionHistory = JSON.stringify(history);
    }

    const updated = await prisma.routine.update({ where: { id: routine.id }, data, include: { checklist: true } });
    return shapeRoutine(updated);
  });

  // POST /routines/:id/checklist
  fastify.post("/:id/checklist", MUTATION_RATE_LIMIT, async (req, reply) => {
    const routine = await prisma.routine.findFirst({ where: { id: req.params.id, userId: req.userId } });
    if (!routine) return reply.status(404).send({ error: "Rotina não encontrada." });

    const count = await prisma.routineChecklistItem.count({ where: { routineId: routine.id } });
    const item = await prisma.routineChecklistItem.create({
      data: { routineId: routine.id, description: req.body.description, order: count },
    });
    reply.status(201);
    return item;
  });

  // PATCH /routines/:id/checklist/:itemId/toggle
  fastify.patch("/:id/checklist/:itemId/toggle", MUTATION_RATE_LIMIT, async (req, reply) => {
    const routine = await prisma.routine.findFirst({ where: { id: req.params.id, userId: req.userId } });
    if (!routine) return reply.status(404).send({ error: "Rotina não encontrada." });

    const current = await prisma.routineChecklistItem.findUnique({ where: { id: BigInt(req.params.itemId) } });
    if (!current) return reply.status(404).send({ error: "Item não encontrado." });

    const newCompleted = !current.completed;
    const item = await prisma.routineChecklistItem.update({
      where: { id: BigInt(req.params.itemId) },
      data: { completed: newCompleted },
    });

    if (newCompleted) {
      const allItems = await prisma.routineChecklistItem.findMany({ where: { routineId: routine.id } });
      if (allItems.length > 0 && allItems.every((i) => i.completed)) {
        const today = TODAY();
        if (routine.lastCompletedDate?.toISOString().split("T")[0] !== today) {
          const currentHistory = parseJson(routine.completionHistory, []);
          const history = [...new Set([...currentHistory, today])];
          await prisma.routine.update({
            where: { id: routine.id },
            data: { lastCompletedDate: new Date(today), completionHistory: JSON.stringify(history) },
          });
        }
      }
    }

    return item;
  });

  // DELETE /routines/:id/checklist/:itemId
  fastify.delete("/:id/checklist/:itemId", MUTATION_RATE_LIMIT, async (req, reply) => {
    const routine = await prisma.routine.findFirst({ where: { id: req.params.id, userId: req.userId } });
    if (!routine) return reply.status(404).send({ error: "Rotina não encontrada." });
    await prisma.routineChecklistItem.delete({ where: { id: BigInt(req.params.itemId) } });
    reply.status(204).send();
  });
}
