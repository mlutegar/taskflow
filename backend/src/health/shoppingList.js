/**
 * health/shoppingList.js — lista de compras da Saúde (pura).
 *
 * - Skincare: produtos com status "need_to_buy" (primeiro) e "low" (acabando).
 * - Remédios: ativos com estoque <= lowStockThreshold, do mais crítico (menor estoque) ao menos.
 */
import { isLowStock } from "./stock.js";

export const PRODUCT_STATUSES = ["have", "low", "need_to_buy"];
export const PRODUCT_CATEGORIES = ["protetor", "hidratante", "esfoliante", "limpeza", "serum", "outro"];

const PRODUCT_RANK = { need_to_buy: 0, low: 1 };

export function buildShoppingList(products, medications) {
  const skincare = products
    .filter((p) => p.status === "need_to_buy" || p.status === "low")
    .sort((a, b) => PRODUCT_RANK[a.status] - PRODUCT_RANK[b.status] || a.name.localeCompare(b.name, "pt-BR"))
    .map((p) => ({ id: p.id, name: p.name, category: p.category, status: p.status }));

  const meds = medications
    .filter((m) => m.active && isLowStock(m.stockQty, m.lowStockThreshold))
    .sort((a, b) => a.stockQty - b.stockQty || a.name.localeCompare(b.name, "pt-BR"))
    .map((m) => ({
      id: m.id,
      name: m.name,
      dose: m.dose ?? null,
      stockQty: m.stockQty,
      lowStockThreshold: m.lowStockThreshold,
      empty: m.stockQty <= 0,
    }));

  return { skincare, medications: meds, total: skincare.length + meds.length };
}
