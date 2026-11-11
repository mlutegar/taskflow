import { useMemo, useState } from "react";
import { ChevronLeft, ChevronRight, Plus } from "lucide-react";
import { useWorkoutPlan, useWorkoutsRange } from "../../hooks/useWorkouts";
import { todayISO } from "../../lib/dateUtils";
import { shiftISO } from "../../lib/healthFormat";
import { WEEKDAY_SHORT } from "../../lib/healthLabels";
import { formatDuration, weekLabel, weekStartISO, weekdayOf } from "../../lib/weekUtils";
import type { Workout } from "../../api/saudeWorkouts";
import WorkoutForm from "./WorkoutForm";
import WorkoutRow from "./WorkoutRow";
import styles from "./Health.module.css";

type FormState = { date: string; workout: Workout | null };

/** Histórico por semana (segunda a domingo) com resumo, treinos por dia e o que estava planejado. */
export default function WeekHistory(): JSX.Element {
  const today = todayISO();
  const currentWeek = weekStartISO(today);
  const [start, setStart] = useState(currentWeek);
  const end = shiftISO(start, 6);
  const { data, isLoading, isError } = useWorkoutsRange(start, end);
  const { data: plan = [] } = useWorkoutPlan();
  const [form, setForm] = useState<FormState | null>(null);

  const days = useMemo(() => Array.from({ length: 7 }, (_, i) => shiftISO(start, i)), [start]);
  const byDate = useMemo(() => {
    const map = new Map<string, Workout[]>();
    for (const w of data?.workouts ?? []) map.set(w.date, [...(map.get(w.date) ?? []), w]);
    return map;
  }, [data]);

  return (
    <>
      <div className={styles.dayNav}>
        <button className={`${styles.btn} ${styles.btnIcon}`} onClick={() => setStart((s) => shiftISO(s, -7))} aria-label="Semana anterior">
          <ChevronLeft size={18} aria-hidden="true" />
        </button>
        <span className={styles.dayTitle}>
          {start === currentWeek ? "Esta semana" : weekLabel(start)}
          {start === currentWeek && <span className={styles.planHint}> · {weekLabel(start)}</span>}
        </span>
        <button
          className={`${styles.btn} ${styles.btnIcon}`}
          onClick={() => setStart((s) => shiftISO(s, 7))}
          disabled={start >= currentWeek}
          aria-label="Próxima semana"
        >
          <ChevronRight size={18} aria-hidden="true" />
        </button>
      </div>

      {isLoading && <div className={styles.empty}>Carregando…</div>}
      {isError && <div className={styles.empty}>Não foi possível carregar o histórico.</div>}

      {data && (
        <div className={`${styles.card} ${styles.weekSummary}`}>
          <span>
            <strong>{data.summary.count}</strong> {data.summary.count === 1 ? "treino" : "treinos"}
          </span>
          <span>
            <strong>{formatDuration(data.summary.totalMin)}</strong> no total
          </span>
        </div>
      )}

      {data &&
        days.map((d) => {
          const workouts = byDate.get(d) ?? [];
          const planned = plan.filter((p) => p.weekday === weekdayOf(d));
          const future = d > today;
          return (
            <section key={d} className={styles.dayBlock}>
              <div className={`${styles.dayHead} ${d === today ? styles.dayToday : ""}`}>
                <span>
                  {WEEKDAY_SHORT[weekdayOf(d)]} {d.slice(8, 10)}/{d.slice(5, 7)}
                  {d === today ? " · hoje" : ""}
                  {planned.length > 0 && (
                    <span className={styles.planHint}> · plano: {planned.map((p) => p.type).join(", ")}</span>
                  )}
                </span>
                {!future && (
                  <button className={`${styles.btn} ${styles.btnIcon}`} onClick={() => setForm({ date: d, workout: null })} aria-label={`Registrar treino em ${d}`}>
                    <Plus size={14} aria-hidden="true" />
                  </button>
                )}
              </div>
              {workouts.length > 0 && (
                <ul className={styles.list}>
                  {workouts.map((w) => (
                    <WorkoutRow key={w.id} workout={w} onEdit={(workout) => setForm({ date: workout.date, workout })} />
                  ))}
                </ul>
              )}
            </section>
          );
        })}

      {data && data.summary.count === 0 && <div className={styles.empty}>Nenhum treino registrado nesta semana.</div>}

      {form && (
        <WorkoutForm
          key={form.workout?.id ?? `new-${form.date}`}
          date={form.date}
          workout={form.workout}
          onClose={() => setForm(null)}
        />
      )}
    </>
  );
}
