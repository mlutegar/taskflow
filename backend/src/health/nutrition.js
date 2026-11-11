/**
 * health/nutrition.js — regras puras de Alimentação (sem calorias nesta versão).
 */

export const MEAL_TYPES = ["breakfast", "lunch", "snack", "dinner"];
export const DEFAULT_GLASS_ML = 250;
export const WATER_GOAL_GLASSES = 8;

/** Novo contador de copos após `delta` (+1 adiciona, -1 desfaz). Nunca negativo. */
export function applyWater(count, delta) {
  return Math.max(0, count + delta);
}

const TYPE_RANK = Object.fromEntries(MEAL_TYPES.map((t, i) => [t, i]));

/** Ordena refeições do dia: tipo (café → jantar) e, dentro do tipo, por horário. */
export function sortMeals(meals) {
  return [...meals].sort(
    (a, b) => TYPE_RANK[a.type] - TYPE_RANK[b.type] || a.time.localeCompare(b.time) || a.description.localeCompare(b.description)
  );
}
