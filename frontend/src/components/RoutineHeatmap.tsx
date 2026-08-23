import styles from "./RoutineHeatmap.module.css";

const MONTHS: string[] = ["Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"];

interface DayCell {
  date: string;
  done: boolean;
  before: boolean;
  isToday: boolean;
  isFuture: boolean;
}

interface Routine {
  id: string | number;
  title: string;
  completion_history?: string[];
  last_completed_date?: string;
  created_at?: string;
}

interface StreakResult {
  current: number;
  longest: number;
}

function isoToDate(s: string): Date {
  return new Date(s + "T00:00:00");
}

function calculateStreaks(completionSet: Set<string>, today: Date): StreakResult {
  if (!completionSet.size) return { current: 0, longest: 0 };

  const todayIso = today.toISOString().split("T")[0];
  const yesterdayIso = new Date(today.getTime() - 86400000).toISOString().split("T")[0];

  let current = 0;
  let d = new Date(completionSet.has(todayIso) ? today : isoToDate(yesterdayIso));
  while (true) {
    const iso = d.toISOString().split("T")[0];
    if (!completionSet.has(iso)) break;
    current++;
    d = new Date(d.getTime() - 86400000);
  }

  const sorted = [...completionSet].map(isoToDate).sort((a, b) => a.getTime() - b.getTime());
  let longest = 1;
  let run = 1;
  for (let i = 1; i < sorted.length; i++) {
    if ((sorted[i].getTime() - sorted[i - 1].getTime()) / 86400000 === 1) {
      run++;
      if (run > longest) longest = run;
    } else {
      run = 1;
    }
  }

  return { current, longest };
}

function buildWeeks(completionSet: Set<string>, today: Date, created: Date): DayCell[][] {
  const anchor = new Date(today);
  anchor.setDate(anchor.getDate() - anchor.getDay());
  anchor.setDate(anchor.getDate() - 51 * 7);

  const weeks: DayCell[][] = [];
  const cur = new Date(anchor);

  while (cur <= today) {
    const week: DayCell[] = [];
    for (let d = 0; d < 7; d++) {
      const iso = cur.toISOString().split("T")[0];
      week.push({
        date: iso,
        done: completionSet.has(iso),
        before: cur < created,
        isToday: iso === today.toISOString().split("T")[0],
        isFuture: cur > today,
      });
      cur.setDate(cur.getDate() + 1);
    }
    weeks.push(week);
  }
  return weeks;
}

function monthLabels(weeks: DayCell[][]): string[] {
  const labels = new Array<string>(weeks.length).fill("");
  let last = -1;
  weeks.forEach((week, i) => {
    const first = week.find((d) => !d.before && !d.isFuture);
    if (!first) return;
    const m = isoToDate(first.date).getMonth();
    if (m !== last) { labels[i] = MONTHS[m]; last = m; }
  });
  return labels;
}

interface RoutineHeatmapCardProps {
  routine: Routine;
  today: Date;
}

function RoutineHeatmapCard({ routine, today }: RoutineHeatmapCardProps): JSX.Element {
  const history = [...(routine.completion_history || [])];
  if (routine.last_completed_date && !history.includes(routine.last_completed_date)) {
    history.push(routine.last_completed_date);
  }
  const completionSet = new Set<string>(history);

  const createdStr = (routine.created_at || today.toISOString()).slice(0, 10);
  const created = isoToDate(createdStr);

  const daysSince = Math.floor((today.getTime() - created.getTime()) / 86400000) + 1;
  const total = completionSet.size;
  const rate = Math.round((total / Math.max(1, daysSince)) * 1000) / 10;

  const { current, longest } = calculateStreaks(completionSet, today);
  const weeks = buildWeeks(completionSet, today, created);
  const labels = monthLabels(weeks);

  const plural = (n: number): string => (n === 1 ? "dia" : "dias");

  return (
    <div className={styles.card}>
      <div className={styles.routineTitle}>{routine.title}</div>

      <div className={styles.heatmapScroll}>
        <div className={styles.heatmapOuter}>
          <div className={styles.monthRow}>
            {labels.map((label, i) => (
              <div key={i} className={styles.monthCell}>{label}</div>
            ))}
          </div>

          <div className={styles.heatmapGrid}>
            {weeks.map((week, wi) => (
              <div key={wi} className={styles.heatmapCol}>
                {week.map((day) => {
                  let cls = styles.cell;
                  if (day.before || day.isFuture) cls += " " + styles.cellEmpty;
                  else if (day.done) cls += " " + styles.cellDone;
                  if (day.isToday) cls += " " + styles.cellToday;
                  return (
                    <div
                      key={day.date}
                      className={cls}
                      title={!day.before && !day.isFuture ? day.date + (day.done ? " ✓" : "") : undefined}
                    />
                  );
                })}
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className={styles.stats}>
        <span>Dias concluídos: <strong>{total} {plural(total)}</strong></span>
        <span>Taxa de conclusão: <strong>{rate}%</strong></span>
        <span>Maior sequência: <strong>{longest} {plural(longest)}</strong></span>
        <span>Sequência atual: <strong>{current} {plural(current)}</strong></span>
      </div>
    </div>
  );
}

interface RoutineHeatmapProps {
  routines: Routine[];
}

export default function RoutineHeatmap({ routines }: RoutineHeatmapProps): JSX.Element {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  if (!routines.length) {
    return (
      <div className={styles.empty}>
        <span>Nenhuma rotina encontrada.</span>
      </div>
    );
  }

  return (
    <div>
      {routines.map((r) => (
        <RoutineHeatmapCard key={r.id} routine={r} today={today} />
      ))}
    </div>
  );
}
