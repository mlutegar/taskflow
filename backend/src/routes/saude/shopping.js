/**
 * routes/saude/shopping.js — lista de compras da Saúde (prefixo /saude/shopping-list).
 * Gerada automaticamente: produtos de skincare "acabando"/"preciso comprar" e
 * remédios com estoque <= lowStockThreshold (seção separada). JWT obrigatório.
 */
import prisma from "../../prisma.js";
import { authenticate } from "../../auth.js";
import { buildShoppingList } from "../../health/shoppingList.js";

export default async function shoppingRoutes(fastify) {
  fastify.addHook("preHandler", authenticate);

  fastify.get("/", async (req) => {
    const [products, medications] = await Promise.all([
      prisma.skincareProduct.findMany({
        where: { userId: req.userId, status: { in: ["low", "need_to_buy"] } },
      }),
      prisma.medication.findMany({ where: { userId: req.userId, active: true } }),
    ]);
    return buildShoppingList(products, medications);
  });
}
