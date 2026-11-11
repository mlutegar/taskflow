/** Formata quantidades de unidades (1, 0.5, 2.25) sem zeros sobrando. */
export function formatQty(n: number): string {
  return Number.isInteger(n) ? String(n) : n.toFixed(2).replace(/\.?0+$/, "");
}

/** Soma `n` dias a uma data "YYYY-MM-DD" (calendário civil, sem depender de fuso/DST). */
export function shiftISO(date: string, n: number): string {
  const [y, m, d] = date.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d + n)).toISOString().slice(0, 10);
}

/** Hora local atual como "HH:MM". */
export function nowHHMM(now: Date = new Date()): string {
  return `${String(now.getHours()).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")}`;
}

/** Rótulo do dia: "Hoje", "Ontem" ou "qua., 11 de nov.". */
export function dayTitle(date: string, today: string): string {
  if (date === today) return "Hoje";
  if (date === shiftISO(today, -1)) return "Ontem";
  const [y, m, d] = date.split("-").map(Number);
  return new Date(y, m - 1, d).toLocaleDateString("pt-BR", { weekday: "short", day: "2-digit", month: "short" });
}
