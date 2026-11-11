import { useId, useState, type FormEvent } from "react";
import { Pencil, Plus, Trash2 } from "lucide-react";
import Modal from "../shared/Modal";
import { useDeletePlanItem, useSavePlanItem, useWorkoutPlan } from "../../hooks/useWorkouts";
import { WEEKDAY_LONG, WEEK_ORDER, WORKOUT_TYPES } from "../../lib/healthLabels";
import { formatDuration } from "../../lib/weekUtils";
import type { WorkoutPlanItem } from "../../api/saudeWorkouts";
import styles from "./Health.module.css";

interface PlanFormProps {
  weekday: number;
  item: WorkoutPlanItem | null;
  onClose: () => void;
}

function PlanForm({ weekday, item, onClose }: PlanFormProps): JSX.Element {
  const save = useSavePlanItem();
  const listId = useId();
  const [day, setDay] = useState(item?.weekday ?? weekday);
  const [type, setType] = useState(item?.type ?? "");
  const [duration, setDuration] = useState(item?.durationMin ? String(item.durationMin) : "");
  const [error, setError] = useState<string | null>(null);

  const submit = (e: FormEvent): void => {
    e.preventDefault();
    if (!type.trim()) return setError("Informe o tipo de treino.");
    const min = duration ? Number(duration) : null;
    if (min !== null && (!Number.isInteger(min) || min < 1 || min > 1440)) return setError("Duração em minutos (1 a 1440).");
    save.mutate(
      { id: item?.id, data: { weekday: day, type: type.trim(), durationMin: min } },
      { onSuccess: onClose }
    );
  };

  return (
    <Modal isOpen onClose={onClose} title={item ? "Editar treino do plano" : "Novo treino no plano"}>
      <form className={styles.form} onSubmit={submit} noValidate>
        <label className={styles.field}>
          Dia da semana
          <select className={styles.input} value={day} onChange={(e) => setDay(Number(e.target.value))}>
            {WEEK_ORDER.map((d) => (
              <option key={d} value={d}>{WEEKDAY_LONG[d]}</option>
            ))}
          </select>
        </label>
        <label className={styles.field}>
          Tipo
          <input className={styles.input} list={listId} value={type} onChange={(e) => setType(e.target.value)} maxLength={60} autoFocus={!item} />
          <datalist id={listId}>
            {WORKOUT_TYPES.map((t) => (
              <option key={t} value={t} />
            ))}
          </datalist>
        </label>
        <label className={styles.field}>
          Duração prevista em minutos (opcional)
          <input className={styles.input} inputMode="numeric" value={duration} onChange={(e) => setDuration(e.target.value.replace(/\D/g, ""))} />
        </label>
        {error && <div className={styles.error} role="alert">{error}</div>}
        <div className={styles.formActions}>
          <button type="button" className={styles.btn} onClick={onClose}>Cancelar</button>
          <button type="submit" className={`${styles.btn} ${styles.btnPrimary}`} disabled={save.isPending}>
            {save.isPending ? "Salvando…" : "Salvar"}
          </button>
        </div>
      </form>
    </Modal>
  );
}

/** Planejamento semanal: quais treinos em quais dias. */
export default function WeekPlan(): JSX.Element {
  const { data, isLoading, isError } = useWorkoutPlan();
  const remove = useDeletePlanItem();
  const [form, setForm] = useState<{ weekday: number; item: WorkoutPlanItem | null } | null>(null);

  const confirmDelete = (p: WorkoutPlanItem): void => {
    if (window.confirm(`Remover "${p.type}" de ${WEEKDAY_LONG[p.weekday]}?\n\nOs treinos já registrados continuam no histórico.`)) {
      remove.mutate(p.id);
    }
  };

  return (
    <>
      <div className={styles.progress}>Defina o que você pretende treinar em cada dia. No dia, o treino aparece em “Hoje” com o botão “Fiz”.</div>
      {isLoading && <div className={styles.empty}>Carregando…</div>}
      {isError && <div className={styles.empty}>Não foi possível carregar o plano.</div>}

      {data &&
        WEEK_ORDER.map((d) => {
          const items = data.filter((p) => p.weekday === d);
          return (
            <section key={d} className={styles.planDay}>
              <div className={styles.dayHead}>
                <span>{WEEKDAY_LONG[d]}</span>
                <button className={`${styles.btn} ${styles.btnIcon}`} onClick={() => setForm({ weekday: d, item: null })} aria-label={`Adicionar treino na ${WEEKDAY_LONG[d]}`}>
                  <Plus size={14} aria-hidden="true" />
                </button>
              </div>
              {items.length === 0 ? (
                <div className={styles.planHint}>Dia de descanso</div>
              ) : (
                <ul className={styles.list}>
                  {items.map((p) => (
                    <li key={p.id} className={styles.workoutRow}>
                      <div className={styles.workoutMain}>
                        <div className={styles.workoutType}>{p.type}</div>
                        <div className={styles.workoutNotes}>{p.durationMin ? formatDuration(p.durationMin) : "sem duração definida"}</div>
                      </div>
                      <div className={styles.doseActions}>
                        <button className={`${styles.btn} ${styles.btnIcon}`} onClick={() => setForm({ weekday: d, item: p })} aria-label={`Editar ${p.type}`}>
                          <Pencil size={16} aria-hidden="true" />
                        </button>
                        <button className={`${styles.btn} ${styles.btnIcon} ${styles.btnDanger}`} onClick={() => confirmDelete(p)} aria-label={`Remover ${p.type}`}>
                          <Trash2 size={16} aria-hidden="true" />
                        </button>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </section>
          );
        })}

      {form && <PlanForm key={form.item?.id ?? `new-${form.weekday}`} weekday={form.weekday} item={form.item} onClose={() => setForm(null)} />}
    </>
  );
}
