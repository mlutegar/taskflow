import { useState } from "react";
import { Check, Plus } from "lucide-react";
import { useWorkoutsToday } from "../../hooks/useWorkouts";
import { todayISO } from "../../lib/dateUtils";
import { formatDuration } from "../../lib/weekUtils";
import type { Workout } from "../../api/saudeWorkouts";
import WorkoutForm, { type WorkoutPreset } from "./WorkoutForm";
import WorkoutRow from "./WorkoutRow";
import styles from "./Health.module.css";

type FormState = { kind: "new" } | { kind: "edit"; workout: Workout } | { kind: "plan"; preset: WorkoutPreset };

/** Hoje: treinos planejados com "Fiz" (abre o registro já preenchido) + treinos já registrados. */
export default function TodayWorkouts(): JSX.Element {
  const date = todayISO();
  const { data, isLoading, isError, refetch } = useWorkoutsToday(date);
  const [form, setForm] = useState<FormState | null>(null);

  if (isLoading) return <div className={styles.empty}>Carregando…</div>;
  if (isError || !data) {
    return (
      <div className={styles.empty}>
        Não foi possível carregar os treinos.{" "}
        <button className={styles.btn} onClick={() => refetch()}>Tentar de novo</button>
      </div>
    );
  }

  const pending = data.planned.filter((p) => !p.done);

  return (
    <>
      <div className={styles.toolbar}>
        <div className={styles.progress}>
          {data.planned.length > 0
            ? `${data.planned.length - pending.length} de ${data.planned.length} treinos do plano feitos hoje`
            : "Nenhum treino planejado para hoje"}
        </div>
        <button className={`${styles.btn} ${styles.btnPrimary}`} onClick={() => setForm({ kind: "new" })}>
          <Plus size={16} aria-hidden="true" /> Registrar treino
        </button>
      </div>

      {data.planned.length > 0 && (
        <>
          <h3 className={styles.sectionTitle}>Planejados para hoje</h3>
          <ul className={styles.list}>
            {data.planned.map((p) => (
              <li key={p.planId} className={`${styles.plannedRow} ${p.done ? styles.plannedDone : ""}`}>
                <div className={styles.workoutMain}>
                  <div className={styles.workoutType}>{p.type}</div>
                  <div className={styles.workoutNotes}>
                    {p.durationMin ? formatDuration(p.durationMin) : "sem duração definida"}
                  </div>
                </div>
                {p.done ? (
                  <span className={styles.badgeWarn} style={{ background: "rgba(78,204,163,0.16)", color: "var(--success)" }}>
                    <Check size={12} aria-hidden="true" /> feito
                  </span>
                ) : (
                  <button
                    className={`${styles.btn} ${styles.btnTake}`}
                    onClick={() => setForm({ kind: "plan", preset: { type: p.type, durationMin: p.durationMin, planId: p.planId } })}
                    aria-label={`Fiz ${p.type}`}
                  >
                    <Check size={16} aria-hidden="true" /> Fiz
                  </button>
                )}
              </li>
            ))}
          </ul>
        </>
      )}

      <h3 className={styles.sectionTitle}>Registrados hoje</h3>
      {data.workouts.length === 0 ? (
        <div className={styles.empty}>Nenhum treino registrado hoje.</div>
      ) : (
        <ul className={styles.list}>
          {data.workouts.map((w) => (
            <WorkoutRow key={w.id} workout={w} onEdit={(workout) => setForm({ kind: "edit", workout })} />
          ))}
        </ul>
      )}

      {form && (
        <WorkoutForm
          key={form.kind === "edit" ? form.workout.id : form.kind === "plan" ? form.preset.planId : "new"}
          date={date}
          workout={form.kind === "edit" ? form.workout : null}
          preset={form.kind === "plan" ? form.preset : null}
          onClose={() => setForm(null)}
        />
      )}
    </>
  );
}
