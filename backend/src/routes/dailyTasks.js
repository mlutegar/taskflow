import prisma from "../prisma.js";
import { authenticate } from "../auth.js";

export default async function dailyTasksRoutes(fastify) {
  fastify.addHook("preHandler", authenticate);

  // GET /daily-tasks/:date
  fastify.get("/:date", async (req) => {
    const date = new Date(req.params.date);
    const items = await prisma.dailyTask.findMany({
      where: { userId: req.userId, date },
      orderBy: { position: "asc" },
    });
    return items.map((i) => i.taskId);
  });

  // POST /daily-tasks/:date/:taskId
  fastify.post("/:date/:taskId", async (req, reply) => {
    const date = new Date(req.params.date);
    const { taskId } = req.params;

    try {
      const count = await prisma.dailyTask.count({ where: { userId: req.userId, date } });
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

  // DELETE /daily-tasks/:date/:taskId
  fastify.delete("/:date/:taskId", async (req, reply) => {
    const date = new Date(req.params.date);
    const { taskId } = req.params;
    await prisma.dailyTask.deleteMany({ where: { userId: req.userId, date, taskId } });
    reply.status(204).send();
  });
}
