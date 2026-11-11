import { useId, useState, type FormEvent } from "react";
import Modal from "../shared/Modal";
import { useSaveWorkout } from "../../hooks/useWorkouts";
import { WORKOUT_TYPES } from "../../lib/healthLabels";
import type { Workout } from "../../api/saudeWorkouts";
import styles from "./Health.module.css";

export interface WorkoutPreset {
  type: string;
  durationMin: number | null;
  planId: string;
}

interface WorkoutFormProps {
  date: string;
  /** Editando um treino existente. */
  workout?: Workout | null;
  /** "Fiz" a partir do plano: já vem com tipo e duração do plano (editáveis antes de salvar). */
  preset?: WorkoutPreset | null;
  onClose: () => void;
}

export default function WorkoutForm({ date, workout, preset, onClose }: WorkoutFormProps): JSX.Element {
  const save = useSaveWorkout();
  const listId = useId();
  const [type, setType] = useState(workout?.type ?? preset?.type ?? "");
  const [duration, setDuration] = useState(String(workout?.durationMin ?? preset?.durationMin ?? ""));
  const [notes, setNotes] = useState(workout?.notes ?? "");
  const [error, setError] = useState<string | null>(null);

  const title = workout ? "Editar treino" : preset ? "Registrar treino do plano" : "Novo treino";

  const submit = (e: FormEvent): void => {
    e.preventDefault();
    setError(null);
    if (!type.trim()) return setError("Informe o tipo de treino.");
    const min = Number(duration);
    if (!Number.isInteger(min) || min < 1 || min > 1440) return setError("Duração em minutos (inteiro de 1 a 1440).");
    save.mutate(
      {
        id: workout?.id,
        data: { date, type: type.trim(), durationMin: min, notes: notes.trim() || null, planId: preset?.planId ?? null },
      },
      { onSuccess: onClose }
    );
  };

  return (
    <Modal isOpen onClose={onClose} title={title}>
      <form className={styles.form} onSubmit={submit} noValidate>
        <label className={styles.field}>
          Tipo
          <input
            className={styles.input}
            list={listId}
            value={type}
            onChange={(e) => setType(e.target.value)}
            maxLength={60}
            placeholder="Ex.: Corrida"
            autoFocus={!workout && !preset}
          />
          <datalist id={listId}>
            {WORKOUT_TYPES.map((t) => (
              <option key={t} value={t} />
            ))}
          </datalist>
        </label>
        <label className={styles.field}>
          Duração (minutos)
          <input
            className={styles.input}
            inputMode="numeric"
            value={duration}
            onChange={(e) => setDuration(e.target.value.replace(/\D/g, ""))}
            placeholder="Ex.: 45"
          />
        </label>
        <label className={styles.field}>
          Observações (opcional)
          <textarea
            className={`${styles.input} ${styles.textarea}`}
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            maxLength={1000}
            placeholder="Como foi, cargas, distância…"
          />
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
