import prisma from "../prisma.js";
import { authenticate } from "../auth.js";

export default async function modeStatsRoutes(fastify) {
  fastify.addHook("preHandler", authenticate);

  // GET /mode-stats
  fastify.get("/", async (req) => {
    const stats = await prisma.modeStat.findMany({ where: { userId: req.userId } });
    const map = {};
    for (const s of stats) map[s.modeId] = s.taskCount;
    return map;
  });

  // POST /mode-stats/:modeId/increment
  fastify.post("/:modeId/increment", async (req) => {
    const { modeId } = req.params;
    const userId = req.userId;

    const stat = await prisma.modeStat.upsert({
      where: { modeId_userId: { modeId, userId } },
      update: { taskCount: { increment: 1 }, updatedAt: new Date() },
      create: { modeId, userId, taskCount: 1 },
    });

    return { count: stat.taskCount };
  });
}
