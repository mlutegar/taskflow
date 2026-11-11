import { todayISO } from "./dateUtils";
import type { PaymentMethod } from "../api/financas";

/** Mês "YYYY-MM" de hoje (dia civil local). */
export const currentMonth = (): string => todayISO().slice(0, 7);

/** "YYYY-MM" + k meses. */
export function shiftMonth(month: string, k: number): string {
  const [y, m] = month.split("-").map(Number);
  const idx = y * 12 + (m - 1) + k;
  return `${Math.floor(idx / 12)}-${String((idx % 12) + 1).padStart(2, "0")}`;
}

const MONTHS = ["Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho", "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"];

export function monthTitle(month: string): string {
  const [y, m] = month.split("-").map(Number);
  return `${MONTHS[m - 1]} de ${y}`;
}

/** "2026-11-05" → "05/11". */
export const dayLabel = (date: string): string => `${date.slice(8, 10)}/${date.slice(5, 7)}`;

/** Primeiro dia do mês, ou hoje se for o mês atual (data padrão ao lançar). */
export function defaultDateFor(month: string): string {
  const today = todayISO();
  return today.startsWith(month) ? today : `${month}-01`;
}

export const PAYMENT_LABELS: Record<PaymentMethod, string> = {
  pix: "Pix",
  dinheiro: "Dinheiro",
  debito: "Débito",
  credito: "Crédito",
  boleto: "Boleto",
  outro: "Outro",
};
export const PAYMENT_METHODS = Object.keys(PAYMENT_LABELS) as PaymentMethod[];
