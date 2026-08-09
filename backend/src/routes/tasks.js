import prisma from "../prisma.js";
import { authenticate } from "../auth.js";

const RECURRENCE_DAYS = { daily: 1, weekly: 7, biweekly: 14 };

function computeNextDueDate(currentDueDate, recurrence) {
  const base = currentDueDate ? new Date(currentDueDate + "T12:00:00") : new Date();
  if (recurrence === "monthly") {
    base.setMonth(base.getMonth() + 1);
  } else {
    base.setDate(base.getDate() + (RECURRENCE_DAYS[recurrence] ?? 7));
  }
  return base.toISOString().split("T")[0];
}

function shapeTask(task) {
  const checklist = (task.checklist ?? []).sort((a, b) => a.order - b.order || Number(a.id) - Number(b.id));
  return {
    ...task,
    checklist,
    checklist_count: checklist.length,
    checklist_completed_count: checklist.filter((c) => c.completed).length,
  };
}

async function fetchWithChecklist(id, userId) {
  const task = await prisma.task.findFirst({
    where: { id, userId },
    include: { checklist: true },
  });
  if (!task) throw new Error("Tarefa não encontrada.");
  return shapeTask({ ...task, checklist: task.checklist });
}

export default async function tasksRoutes(fastify) {
  fastify.addHook("preHandler", authenticate);

  // GET /tasks
  fastify.get("/", async (req) => {
    const { status, sort } = req.query;
    const userId = req.userId;

    const where = { userId };
    if (status === "active") where.completed = false;
    else if (status === "completed") where.completed = true;

    let orderBy;
    if (sort === "due_date_asc" || sort === "due_date") {
      orderBy = [{ dueDate: "asc" }, { priority: "asc" }];
    } else if (sort === "due_date_desc") {
      orderBy = [{ dueDate: "desc" }, { priority: "asc" }];
    } else if (sort === "created") {
      orderBy = [{ createdAt: "desc" }];
    } else {
      orderBy = [{ priority: "asc" }, { createdAt: "desc" }];
    }

    const tasks = await prisma.task.findMany({
      where,
      orderBy,
      include: { checklist: true },
    });

    return tasks.map((t) => shapeTask({ ...t, checklist: t.checklist }));
  });

  // POST /tasks
  fastify.post("/", async (req, reply) => {
    const { title, description, priority, due_date, recurrence } = req.body;
    const task = await prisma.task.create({
      data: {
        userId: req.userId,
        title,
        description,
        priority: priority ?? 4,
        dueDate: due_date ? new Date(due_date) : null,
        recurrence,
      },
      include: { checklist: true },
    });
    reply.status(201);
    return shapeTask({ ...task, checklist: task.checklist });
  });

  // PATCH /tasks/:id
  fastify.patch("/:id", async (req, reply) => {
    const { id } = req.params;
    const body = req.body;

    // Mapeia campos snake_case → camelCase do Prisma
    const data = {};
    if (body.title !== undefined) data.title = body.title;
    if (body.description !== undefined) data.description = body.description;
    if (body.priority !== undefined) data.priority = body.priority;
    if (body.completed !== undefined) data.completed = body.completed;
    if (body.completed_at !== undefined) data.completedAt = body.completed_at ? new Date(body.completed_at) : null;
    if (body.due_date !== undefined) data.dueDate = body.due_date ? new Date(body.due_date) : null;
    if (body.recurrence !== undefined) data.recurrence = body.recurrence;

    const existing = await prisma.task.findFirst({ where: { id, userId: req.userId } });
    if (!existing) return reply.status(404).send({ error: "Tarefa não encontrada." });

    const task = await prisma.task.update({
      where: { id },
      data,
      include: { checklist: true },
    });
    return shapeTask({ ...task, checklist: task.checklist });
  });

  // DELETE /tasks/:id
  fastify.delete("/:id", async (req, reply) => {
    const { id } = req.params;
    const existing = await prisma.task.findFirst({ where: { id, userId: req.userId } });
    if (!existing) return reply.status(404).send({ error: "Tarefa não encontrada." });
    await prisma.task.delete({ where: { id } });
    reply.status(204).send();
  });

  // POST /tasks/:id/complete
  fastify.post("/:id/complete", async (req, reply) => {
    const { id } = req.params;
    const task = await prisma.task.findFirst({ where: { id, userId: req.userId } });
    if (!task) return reply.status(404).send({ error: "Tarefa não encontrada." });

    const completedAt = new Date();
    let data;
    if (task.recurrence) {
      const nextDate = computeNextDueDate(task.dueDate?.toISOString().split("T")[0], task.recurrence);
      data = { dueDate: new Date(nextDate), completed: false, completedAt };
    } else {
      data = { completed: true, completedAt };
    }

    const updated = await prisma.task.update({
      where: { id },
      data,
      include: { checklist: true },
    });
    return shapeTask({ ...updated, checklist: updated.checklist });
  });

  // POST /tasks/:id/reopen
  fastify.post("/:id/reopen", async (req, reply) => {
    const { id } = req.params;
    const existing = await prisma.task.findFirst({ where: { id, userId: req.userId } });
    if (!existing) return reply.status(404).send({ error: "Tarefa não encontrada." });

    const task = await prisma.task.update({
      where: { id },
      data: { completed: false, completedAt: null },
      include: { checklist: true },
    });
    return shapeTask({ ...task, checklist: task.checklist });
  });

  // GET /tasks/due-today
  fastify.get("/due-today", async (req) => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    const tasks = await prisma.task.findMany({
      where: {
        userId: req.userId,
        completed: false,
        dueDate: { gte: today, lt: tomorrow },
      },
      orderBy: { priority: "asc" },
      take: 10,
      select: { id: true, title: true, priority: true, dueDate: true },
    });
    return tasks;
  });

  // GET /tasks/completed-today-count
  fastify.get("/completed-today-count", async (req) => {
    const start = new Date();
    start.setHours(0, 0, 0, 0);
    const count = await prisma.task.count({
      where: {
        userId: req.userId,
        completedAt: { gte: start },
      },
    });
    return { count };
  });

  // POST /tasks/:id/checklist
  fastify.post("/:id/checklist", async (req, reply) => {
    const { id: taskId } = req.params;
    const { description, parent_id: parentId = null } = req.body;

    // Verifica que a tarefa pertence ao usuário
    const task = await prisma.task.findFirst({ where: { id: taskId, userId: req.userId } });
    if (!task) return reply.status(404).send({ error: "Tarefa não encontrada." });

    const count = await prisma.checklistItem.count({
      where: { taskId, parentId: parentId ?? null },
    });

    const item = await prisma.checklistItem.create({
      data: { taskId, parentId, description, order: count },
    });
    reply.status(201);
    return item;
  });

  // PATCH /tasks/:id/checklist/:itemId
  fastify.patch("/:id/checklist/:itemId", async (req, reply) => {
    const { id: taskId, itemId } = req.params;
    const { description, note } = req.body;

    const task = await prisma.task.findFirst({ where: { id: taskId, userId: req.userId } });
    if (!task) return reply.status(404).send({ error: "Tarefa não encontrada." });

    const data = {};
    if (description !== undefined) data.description = description;
    if (note !== undefined) data.note = note;

    const item = await prisma.checklistItem.update({
      where: { id: BigInt(itemId) },
      data,
    });
    return item;
  });

  // PATCH /tasks/:id/checklist/:itemId/toggle
  fastify.patch("/:id/checklist/:itemId/toggle", async (req, reply) => {
    const { id: taskId, itemId } = req.params;

    const task = await prisma.task.findFirst({ where: { id: taskId, userId: req.userId } });
    if (!task) return reply.status(404).send({ error: "Tarefa não encontrada." });

    const current = await prisma.checklistItem.findUnique({ where: { id: BigInt(itemId) } });
    if (!current) return reply.status(404).send({ error: "Item não encontrado." });

    const item = await prisma.checklistItem.update({
      where: { id: BigInt(itemId) },
      data: { completed: !current.completed },
    });
    return item;
  });

  // DELETE /tasks/:id/checklist/:itemId
  fastify.delete("/:id/checklist/:itemId", async (req, reply) => {
    const { id: taskId, itemId } = req.params;

    const task = await prisma.task.findFirst({ where: { id: taskId, userId: req.userId } });
    if (!task) return reply.status(404).send({ error: "Tarefa não encontrada." });

    await prisma.checklistItem.delete({ where: { id: BigInt(itemId) } });
    reply.status(204).send();
  });
}
