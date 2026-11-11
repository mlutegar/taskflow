/**
 * health/stock.js — regras puras de estoque de remédios.
 *
 * - "tomei" copia doseQty do horário para o intake e baixa o estoque.
 * - taken → skipped/pending devolve EXATAMENTE o doseQty registrado no intake
 *   (mudar a dose do horário depois não altera o histórico).
 * - O estoque nunca fica negativo (a baixa é limitada ao que existe).
 */
import { addDays } from "../recurrenceDays.js";
import { appliesOnDate } from "./schedule.js";

export const INTAKE_STATUSES = ["taken", "skipped", "pending"];

/**
 * @param prev         intake atual ({status, doseQty}) ou null
 * @param nextStatus   "taken" | "skipped" | "pending" (pending = desmarcar)
 * @param scheduleDose doseQty atual do horário (usado só ao passar a "taken")
 * @param stock        estoque atual
 * @returns {{ intake: {status, doseQty}|null, stock: number }}  intake null = remover registro
 */
export function applyIntake(prev, nextStatus, scheduleDose, stock) {
  const prevTaken = prev?.status === "taken";
  const nextTaken = nextStatus === "taken";

  // Idempotente: já estava "tomei" e continua.
  if (prevTaken && nextTaken) return { intake: prev, stock };

  let next = stock;
  if (prevTaken) next += prev.doseQty; // devolve o que foi registrado
  let doseQty = prev?.doseQty ?? scheduleDose;
  if (nextTaken) {
    doseQty = scheduleDose;
    next = Math.max(0, next - doseQty);
  }

  const intake = nextStatus === "pending" ? null : { status: nextStatus, doseQty };
  return { intake, stock: round(next) };
}

export function isLowStock(stockQty, threshold) {
  return stockQty <= threshold;
}

/**
 * Dias de estoque restantes a partir de `fromDate`, simulando as doses dos horários
 * ativos nos dias em que o remédio se aplica. null se não há consumo previsto
 * (sem horários), o tratamento termina antes do estoque, ou dura mais que `horizon` dias.
 */
export function daysOfStockLeft(med, schedules, fromDate, horizon = 400) {
  const perDay = schedules
    .filter((s) => s.active !== false)
    .reduce((acc, s) => acc + s.doseQty, 0);
  if (perDay <= 0) return null;
  let stock = med.stockQty;
  for (let i = 0; i < horizon; i++) {
    const date = addDays(fromDate, i);
    if (med.endDate && date > med.endDate) return null;
    if (!appliesOnDate(med, date)) continue;
    if (stock < perDay) return i;
    stock -= perDay;
  }
  return null;
}

function round(n) {
  return Math.round(n * 1000) / 1000;
}
