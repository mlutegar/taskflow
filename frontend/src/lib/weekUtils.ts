import { shiftISO } from "./healthFormat";

/** Dia da semana (0=dom … 6=sáb) de "YYYY-MM-DD", sem depender do fuso. */
export function weekdayOf(date: string): number {
  const [y, m, d] = date.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d)).getUTCDay();
}

/** Segunda-feira da semana que contém `date` (a semana de exibição vai de segunda a domingo). */
export function weekStartISO(date: string): string {
  return shiftISO(date, -((weekdayOf(date) + 6) % 7));
}

/** "09 nov – 15 nov" para a semana que começa em `start`. */
export function weekLabel(start: string): string {
  const fmt = (iso: string): string => {
    const [y, m, d] = iso.split("-").map(Number);
    return new Date(y, m - 1, d).toLocaleDateString("pt-BR", { day: "2-digit", month: "short" }).replace(".", "");
  };
  return `${fmt(start)} – ${fmt(shiftISO(start, 6))}`;
}

/** "45 min", "1h", "1h30". */
export function formatDuration(min: number): string {
  if (min < 60) return `${min} min`;
  const h = Math.floor(min / 60);
  const r = min % 60;
  return r ? `${h}h${String(r).padStart(2, "0")}` : `${h}h`;
}
