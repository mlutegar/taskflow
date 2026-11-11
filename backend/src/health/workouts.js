/**
 * health/workouts.js — regras puras de Exercícios.
 */
import { dayOfWeek } from "../recurrenceDays.js";

/**
 * Treinos planejados para `date` (pelo dia da semana) e se já foram feitos.
 * Um item do plano conta como feito quando existe um treino do mesmo dia com `planId` dele.
 *
 * @param plan     itens do plano ({id, weekday, type, durationMin, order})
 * @param workouts treinos registrados no dia ({id, planId, ...})
 */
export function plannedForDate(plan, workouts, date) {
  const weekday = dayOfWeek(date);
  const byPlan = new Map(workouts.filter((w) => w.planId).map((w) => [w.planId, w]));
  return plan
    .filter((p) => p.weekday === weekday)
    .sort((a, b) => a.order - b.order || a.type.localeCompare(b.type, "pt-BR"))
    .map((p) => {
      const done = byPlan.get(p.id);
      return {
        planId: p.id,
        type: p.type,
        durationMin: p.durationMin ?? null,
        done: !!done,
        workoutId: done?.id ?? null,
      };
    });
}

/** Totais de um conjunto de treinos (resumo da semana). */
export function summarize(workouts) {
  return {
    count: workouts.length,
    totalMin: workouts.reduce((acc, w) => acc + w.durationMin, 0),
  };
}
