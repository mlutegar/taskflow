import prisma from "../prisma.js";
import { authenticate } from "../auth.js";

const DAILY_LIMIT = 5;

/**
 * Converte uma string "YYYY-MM-DD" (dia LOCAL do cliente) num Date estável
 * (meia-noite UTC daquele dia) para usar como chave. O front sempre manda a
 * data local (todayISO), então a chave fica consistente entre add/load/remove.
 * Retorna null se o formato for inválido.
 */
function parseDay(str) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(str || "")) return null;
  const d = new Date(`${str}T00:00:00.000Z`);
  return Number.isNaN(d.getTime()) ? null : d;
}

export default async function dailyTasksRoutes(fastify) {
  fastify.addHook("preHandler", authenticate);

  // GET /daily-tasks/:date
  fastify.get("/:date", async (req, reply) => {
    const date = parseDay(req.params.date);
    if (!date) return reply.status(400).send({ error: "Data inválida (use YYYY-MM-DD)" });
    const items = await prisma.dailyTask.findMany({
      where: { userId: req.userId, date },
      orderBy: { position: "asc" },
    });
    return items.map((i) => i.taskId);
  });

  // POST /daily-tasks/:date/:taskId
  fastify.post("/:date/:taskId", async (req, reply) => {
    const date = parseDay(req.params.date);
    if (!date) return reply.status(400).send({ error: "Data inválida (use YYYY-MM-DD)" });
    const { taskId } = req.params;

    try {
      const count = await prisma.dailyTask.count({ where: { userId: req.userId, date } });
      // Limite diário de foco: no máximo 5 tarefas por dia.
      if (count >= DAILY_LIMIT) {
        return reply.status(409).send({ error: "limit", message: `Limite diário de ${DAILY_LIMIT} tarefas atingido` });
      }
      await prisma.dailyTask.create({
        data: { userId: req.userId, date, taskId, position: count },
      });
      reply.status(201).send({ ok: true });
    } catch (err) {
      // Unique constraint — já existe
      if (err.code === "P2002") {
        return { ok: true };
      }
      throw err;
    }
  });

  // PUT /daily-tasks/:date/reorder  — body: { taskIds: string[] }
  fastify.put("/:date/reorder", async (req, reply) => {
    const date = parseDay(req.params.date);
    if (!date) return reply.status(400).send({ error: "Data inválida (use YYYY-MM-DD)" });
    const taskIds = Array.isArray(req.body?.taskIds) ? req.body.taskIds.map(String) : null;
    if (!taskIds) return reply.status(400).send({ error: "taskIds deve ser um array" });

    // Reescreve as posições numa única transação, respeitando a ordem recebida.
    await prisma.$transaction(
      taskIds.map((taskId, position) =>
        prisma.dailyTask.updateMany({
          where: { userId: req.userId, date, taskId },
          data: { position },
        })
      )
    );
    reply.status(204).send();
  });

  // DELETE /daily-tasks/:date/:taskId
  fastify.delete("/:date/:taskId", async (req, reply) => {
    const date = parseDay(req.params.date);
    if (!date) return reply.status(400).send({ error: "Data inválida (use YYYY-MM-DD)" });
    const { taskId } = req.params;
    await prisma.dailyTask.deleteMany({ where: { userId: req.userId, date, taskId } });
    reply.status(204).send();
  });
}
