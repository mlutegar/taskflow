/**
 * routes/financas/categories.js — Finanças / Categorias (prefixo /financas/categories).
 * Editáveis; já com padrão na primeira leitura. Excluir = arquivar (histórico preservado).
 */
import prisma from "../../prisma.js";
import { authenticate } from "../../auth.js";
import { DEFAULT_CATEGORIES } from "../../finance/defaultCategories.js";
import { categoryCreate, categoryUpdate, zodMessage } from "../../finance/validation.js";

const shape = (c) => ({
  id: c.id, name: c.name, kind: c.kind, emoji: c.emoji, color: c.color, order: c.order, active: c.active,
});

export default async function categoriesRoutes(fastify) {
  fastify.addHook("preHandler", authenticate);

  // GET /financas/categories?all=1 (all inclui arquivadas)
  fastify.get("/", async (req) => {
    const userId = req.userId;
    if ((await prisma.financeCategory.count({ where: { userId } })) === 0) {
      await prisma.financeCategory.createMany({
        data: DEFAULT_CATEGORIES.map((c, i) => ({ userId, order: i, ...c })),
      });
    }
    const all = req.query?.all === "1";
    const rows = await prisma.financeCategory.findMany({
      where: { userId, ...(all ? {} : { active: true }) },
      orderBy: [{ order: "asc" }, { createdAt: "asc" }],
    });
    return rows.map(shape);
  });

  fastify.post("/", async (req, reply) => {
    const parsed = categoryCreate.safeParse(req.body ?? {});
    if (!parsed.success) return reply.status(400).send({ error: zodMessage(parsed.error) });
    const last = await prisma.financeCategory.findFirst({ where: { userId: req.userId }, orderBy: { order: "desc" } });
    const row = await prisma.financeCategory.create({
      data: { userId: req.userId, order: (last?.order ?? -1) + 1, ...parsed.data },
    });
    return reply.status(201).send(shape(row));
  });

  fastify.patch("/:id", async (req, reply) => {
    const parsed = categoryUpdate.safeParse(req.body ?? {});
    if (!parsed.success) return reply.status(400).send({ error: zodMessage(parsed.error) });
    const own = await prisma.financeCategory.findFirst({ where: { id: req.params.id, userId: req.userId } });
    if (!own) return reply.status(404).send({ error: "Categoria não encontrada." });
    return shape(await prisma.financeCategory.update({ where: { id: own.id }, data: parsed.data }));
  });

  // DELETE = arquivar (lançamentos antigos continuam apontando para ela)
  fastify.delete("/:id", async (req, reply) => {
    const own = await prisma.financeCategory.findFirst({ where: { id: req.params.id, userId: req.userId } });
    if (!own) return reply.status(404).send({ error: "Categoria não encontrada." });
    await prisma.financeCategory.update({ where: { id: own.id }, data: { active: false } });
    return reply.status(204).send();
  });
}
