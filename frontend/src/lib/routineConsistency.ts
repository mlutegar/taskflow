/**
 * routineConsistency.ts — lógica pura do heatmap "Consistência das Rotinas".
 *
 * Sem React e sem I/O: recebe os dias agregados do backend
 * (GET /tasks/routines/consistency) e devolve grade + estatísticas.
 *
 * Convenções:
 *  - datas são strings ISO locais (YYYY-MM-DD), já no fuso do usuário;
 *  - dia com `expected === 0` é NEUTRO: não conta no total nem quebra sequência;
 *  - "dia concluído" = 100% das rotinas esperadas feitas.
 */

import type { RoutineConsistencyDay, RoutineConsistencyRoutine } from "../api/tasks";
import { addDaysISO } from "./dailyRoutine";

export type HeatmapRange = "30d" | "3m" | "6m" | "1y";

/** Opções do seletor de período, na ordem em que aparecem na UI. */
export const RANGE_OPTIONS: { value: HeatmapRange; label: string; days: number }[] = [
  { value: "30d", label: "Últimos 30 dias", days: 30 },
  { value: "3m", label: "Últimos 3 meses", days: 90 },
  { value: "6m", label: "Últimos 6 meses", days: 180 },
  { value: "1y", label: "Último ano", days: 365 },
];

export const DEFAULT_RANGE: HeatmapRange = "6m";

export const MONTH_LABELS = ["Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"];
const WEEKDAY_LABELS = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];

/** Nível de cor: null = sem rotina agendada; 0..4 = 0% → 100%. */
export type HeatmapLevel = 0 | 1 | 2 | 3 | 4 | null;

export interface HeatmapCell {
  /** null em células de preenchimento (antes do início / depois de hoje). */
  date: string | null;
  expected: number;
  completed: number;
  level: HeatmapLevel;
  isToday: boolean;
  /** Índices (em `routines`) das rotinas agendadas no dia — alimenta o tooltip. */
  expectedIdx: number[];
  /** Índices das que foram concluídas. */
  completedIdx: number[];
}

/**
 * Dia já achatado em contagens. É a forma com que todo o cálculo trabalha; a
 * resposta da API (que vem com índices) é convertida por `projectDays`, que
 * também aplica o filtro por rotina.
 */
export interface DayCount {
  date: string;
  expected: number;
  completed: number;
  expectedIdx?: number[];
  completedIdx?: number[];
}

/**
 * Converte os dias da API em contagens. Com `routineIndex` preenchido, olha
 * apenas aquela rotina: dias em que ela não estava agendada viram neutros
 * (expected 0), exatamente como um dia sem rotina nenhuma.
 */
export function projectDays(
  days: RoutineConsistencyDay[],
  routineIndex: number | null = null,
): DayCount[] {
  return days.map((day) => {
    const expectedIdx = routineIndex === null
      ? day.expected
      : day.expected.filter((i) => i === routineIndex);
    const completedIdx = routineIndex === null
      ? day.completed
      : day.completed.filter((i) => i === routineIndex);
    return {
      date: day.date,
      expected: expectedIdx.length,
      completed: Math.min(expectedIdx.length, completedIdx.length),
      expectedIdx,
      completedIdx,
    };
  });
}

export interface HeatmapStatsData {
  currentStreak: number;
  bestStreak: number;
  /** Dias 100% concluídos dentro do período. */
  doneDays: number;
  /** Dias elegíveis (com ao menos uma rotina agendada) no período. */
  eligibleDays: number;
  pct: number;
}

/** Converte Date → ISO local (não usa toISOString, que é UTC). */
export function toISO(d: Date): string {
  return [
    d.getFullYear(),
    String(d.getMonth() + 1).padStart(2, "0"),
    String(d.getDate()).padStart(2, "0"),
  ].join("-");
}

/** Dia da semana (0=dom … 6=sáb) de uma data ISO, sem efeito de fuso. */
export function weekdayOf(iso: string): number {
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(y, m - 1, d).getDay();
}

/** Intervalo [from, to] correspondente ao período selecionado. */
export function rangeBounds(range: HeatmapRange, today: string): { from: string; to: string } {
  const option = RANGE_OPTIONS.find((o) => o.value === range) ?? RANGE_OPTIONS[2];
  return { from: addDaysISO(today, -(option.days - 1)), to: today };
}

/** 0% → 0, 1–33% → 1, 34–66% → 2, 67–99% → 3, 100% → 4. Sem rotina → null. */
export function levelOf(expected: number, completed: number): HeatmapLevel {
  if (expected <= 0) return null;
  if (completed <= 0) return 0;
  if (completed >= expected) return 4;
  // Arredonda antes de faixar: 1 de 3 (33,3%) deve cair na faixa 1–33.
  const pct = Math.round((completed / expected) * 100);
  if (pct <= 33) return 1;
  if (pct <= 66) return 2;
  return 3;
}

function isFullDay(day: DayCount): boolean {
  return day.expected > 0 && day.completed >= day.expected;
}

/**
 * Sequência atual: dias concluídos consecutivos até hoje.
 * Se hoje ainda não está completo, NÃO quebra — conta até ontem.
 * Dias sem rotina agendada são pulados.
 */
export function currentStreak(days: DayCount[], today: string): number {
  const byDate = new Map(days.map((d) => [d.date, d]));
  let cursor = today;

  // Hoje incompleto (ou ausente) não zera: começa a contar de ontem.
  const todayEntry = byDate.get(today);
  if (!todayEntry || !isFullDay(todayEntry)) cursor = addDaysISO(today, -1);

  let streak = 0;
  while (byDate.has(cursor)) {
    const day = byDate.get(cursor) as DayCount;
    if (day.expected === 0) {
      cursor = addDaysISO(cursor, -1); // dia neutro: pula sem contar
      continue;
    }
    if (!isFullDay(day)) break;
    streak += 1;
    cursor = addDaysISO(cursor, -1);
  }
  return streak;
}

/** Maior sequência dentro dos dias recebidos (fallback do best_streak do backend). */
export function bestStreak(days: DayCount[]): number {
  let best = 0;
  let run = 0;
  for (const day of days) {
    if (day.expected === 0) continue;
    if (isFullDay(day)) {
      run += 1;
      if (run > best) best = run;
    } else {
      run = 0;
    }
  }
  return best;
}

/** % de dias concluídos, ignorando dias sem nenhuma rotina agendada. */
export function completionRate(days: DayCount[]): { pct: number; done: number; total: number } {
  const eligible = days.filter((d) => d.expected > 0);
  const done = eligible.filter(isFullDay).length;
  const total = eligible.length;
  return { pct: total === 0 ? 0 : Math.round((done / total) * 100), done, total };
}

export function computeStats(
  days: DayCount[],
  today: string,
  backendBestStreak?: number,
): HeatmapStatsData {
  const { pct, done, total } = completionRate(days);
  const localBest = bestStreak(days);
  return {
    currentStreak: currentStreak(days, today),
    bestStreak: Math.max(localBest, backendBestStreak ?? 0),
    doneDays: done,
    eligibleDays: total,
    pct,
  };
}

/**
 * Monta as colunas-semana (domingo → sábado). A primeira coluna é completada
 * com células vazias antes de `from`; a grade termina em `today` (sem futuro).
 */
export function buildHeatmapGrid(
  days: DayCount[],
  today: string,
  /**
   * Início do período. Ancorar a grade aqui (e não no primeiro dia com dado)
   * garante que ela SEMPRE desenhe o período inteiro: dias sem dado viram
   * células neutras em vez de a grade encolher — era o bug do heatmap que
   * colapsava para uma célula só quando havia pouco histórico.
   */
  from?: string,
): HeatmapCell[][] {
  if (days.length === 0 && !from) return [];

  const byDate = new Map(days.map((d) => [d.date, d]));
  const firstWithData = days[0]?.date;
  const first = from && (!firstWithData || from < firstWithData) ? from : firstWithData as string;
  const lastWithData = days[days.length - 1]?.date;
  const last = lastWithData && lastWithData <= today ? lastWithData : today;
  if (!first || first > last) return [];

  const weeks: HeatmapCell[][] = [];
  let week: HeatmapCell[] = [];

  // Preenche os dias da primeira semana anteriores ao início do período.
  for (let i = 0; i < weekdayOf(first); i++) {
    week.push({ date: null, expected: 0, completed: 0, level: null, isToday: false, expectedIdx: [], completedIdx: [] });
  }

  for (let cursor = first; cursor <= last; cursor = addDaysISO(cursor, 1)) {
    const day = byDate.get(cursor) ?? { date: cursor, expected: 0, completed: 0 };
    week.push({
      date: cursor,
      expected: day.expected,
      completed: day.completed,
      level: levelOf(day.expected, day.completed),
      isToday: cursor === today,
      expectedIdx: day.expectedIdx ?? [],
      completedIdx: day.completedIdx ?? [],
    });
    if (week.length === 7) {
      weeks.push(week);
      week = [];
    }
  }
  if (week.length > 0) {
    while (week.length < 7) {
      week.push({ date: null, expected: 0, completed: 0, level: null, isToday: false, expectedIdx: [], completedIdx: [] });
    }
    weeks.push(week);
  }
  return weeks;
}

/** Rótulo de mês por coluna: só na primeira semana de cada mês ("" nas demais). */
export function monthLabels(weeks: HeatmapCell[][]): string[] {
  const labels = new Array<string>(weeks.length).fill("");
  let lastMonth = -1;
  weeks.forEach((week, i) => {
    const firstReal = week.find((c) => c.date);
    if (!firstReal?.date) return;
    const month = Number(firstReal.date.split("-")[1]) - 1;
    if (month !== lastMonth) {
      labels[i] = MONTH_LABELS[month];
      lastMonth = month;
    }
  });
  return labels;
}

/**
 * Rótulos da coluna da esquerda, em linhas alternadas (Seg, Qua, Sex).
 * `short` usa uma letra só — no mobile a coluna precisa caber em ~10px.
 */
export function weekdayRowLabels(short = false): string[] {
  return WEEKDAY_LABELS.map((label, i) =>
    i === 1 || i === 3 || i === 5 ? (short ? label.charAt(0) : label) : "",
  );
}

/** Data por extenso curta: "18 out 2026". */
export function prettyDate(iso: string): string {
  const [y, m, d] = iso.split("-").map(Number);
  return `${d} ${MONTH_LABELS[m - 1].toLowerCase()} ${y}`;
}

/** Texto do tooltip: "18 out 2026 · 2 de 3 rotinas". */
export function cellTooltip(cell: HeatmapCell): string {
  if (!cell.date) return "";
  const pretty = prettyDate(cell.date);
  if (cell.expected === 0) return `${pretty} · sem rotina agendada`;
  return `${pretty} · ${cell.completed} de ${cell.expected} rotina${cell.expected === 1 ? "" : "s"}`;
}

/** Uma linha do detalhamento do tooltip. */
export interface CellRoutineLine {
  id: string;
  title: string;
  done: boolean;
}

/**
 * Quais rotinas estavam agendadas no dia e quais foram feitas — as concluídas
 * primeiro, para a leitura ficar natural.
 */
export function cellRoutines(
  cell: HeatmapCell,
  routines: RoutineConsistencyRoutine[],
): CellRoutineLine[] {
  const done = new Set(cell.completedIdx);
  return cell.expectedIdx
    .map((i) => routines[i])
    .filter(Boolean)
    .map((routine, pos) => ({
      id: routine.id,
      title: routine.title,
      done: done.has(cell.expectedIdx[pos]),
    }))
    .sort((a, b) => Number(b.done) - Number(a.done));
}
