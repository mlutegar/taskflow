/**
 * dailyRoutine.ts — utilitários do painel "Rotina Diária".
 *
 * Regras de quais recorrências contam como "diárias", cálculo de streak
 * (dias seguidos) e janela dos últimos 7 dias para o mini-heatmap.
 * Tudo em horário LOCAL para evitar bugs de fuso.
 */

/** Recorrências consideradas rotina diária. */
export const DAILY_RECURRENCES = new Set<string>(["daily", "weekdays"]);

function isoOf(d: Date): string {
  return [
    d.getFullYear(),
    String(d.getMonth() + 1).padStart(2, "0"),
    String(d.getDate()).padStart(2, "0"),
  ].join("-");
}

/** true se a recorrência deve aparecer no painel HOJE. */
export function isDailyToday(recurrence: string | null | undefined, ref: Date = new Date()): boolean {
  if (!recurrence || !DAILY_RECURRENCES.has(recurrence)) return false;
  if (recurrence === "weekdays") {
    const dow = ref.getDay(); // 0=dom … 6=sáb
    return dow >= 1 && dow <= 5;
  }
  return true;
}

/** Entrada de histórico vinda de GET /tasks/:id/history. */
export interface HistoryEntry {
  date: string;      // YYYY-MM-DD
  undone?: boolean;
}

/** Conjunto de datas efetivamente concluídas (ignora desfeitas). */
export function completedDateSet(history: HistoryEntry[] = []): Set<string> {
  const set = new Set<string>();
  for (const h of history) {
    if (h && !h.undone && h.date) set.add(h.date);
  }
  return set;
}

/**
 * Streak = dias consecutivos concluídos terminando hoje (ou ontem, se hoje
 * ainda não foi feito — não quebra o streak durante o dia corrente).
 */
export function computeStreak(dateSet: Set<string>, ref: Date = new Date()): number {
  const cursor = new Date(ref.getFullYear(), ref.getMonth(), ref.getDate());
  if (!dateSet.has(isoOf(cursor))) cursor.setDate(cursor.getDate() - 1);
  let streak = 0;
  while (dateSet.has(isoOf(cursor))) {
    streak++;
    cursor.setDate(cursor.getDate() - 1);
  }
  return streak;
}

/** Soma N dias a uma data ISO (YYYY-MM-DD). */
export function addDaysISO(iso: string, days: number): string {
  const [y, m, d] = iso.split("-").map(Number);
  const dt = new Date(y, m - 1, d);
  dt.setDate(dt.getDate() + days);
  return isoOf(dt);
}

/** Diferença em dias entre duas datas ISO (to - from). */
export function daysBetweenISO(fromISO: string, toISO: string): number {
  const [ay, am, ad] = fromISO.split("-").map(Number);
  const [by, bm, bd] = toISO.split("-").map(Number);
  const a = new Date(ay, am - 1, ad).getTime();
  const b = new Date(by, bm - 1, bd).getTime();
  return Math.round((b - a) / 86_400_000);
}

/** Próxima segunda-feira (ISO) a partir de uma data. */
export function nextMondayISO(fromISO: string): string {
  const [y, m, d] = fromISO.split("-").map(Number);
  const dt = new Date(y, m - 1, d);
  const dow = dt.getDay(); // 0=dom … 1=seg
  const delta = ((8 - dow) % 7) || 7; // sempre a PRÓXIMA segunda
  dt.setDate(dt.getDate() + delta);
  return isoOf(dt);
}

/** Janela dos últimos 7 dias (do mais antigo ao mais recente = hoje). */
export function last7Days(ref: Date = new Date()): { iso: string; label: string; done: boolean }[] {
  const base = new Date(ref.getFullYear(), ref.getMonth(), ref.getDate());
  const out: { iso: string; label: string; done: boolean }[] = [];
  const WD = ["D", "S", "T", "Q", "Q", "S", "S"];
  for (let i = 6; i >= 0; i--) {
    const d = new Date(base);
    d.setDate(d.getDate() - i);
    out.push({ iso: isoOf(d), label: WD[d.getDay()], done: false });
  }
  return out;
}
