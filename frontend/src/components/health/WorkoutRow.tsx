import { Pencil, Trash2 } from "lucide-react";
import { useDeleteWorkout } from "../../hooks/useWorkouts";
import { formatDuration } from "../../lib/weekUtils";
import type { Workout } from "../../api/saudeWorkouts";
import styles from "./Health.module.css";

interface WorkoutRowProps {
  workout: Workout;
  onEdit: (w: Workout) => void;
}

/** Linha de um treino registrado, com editar e excluir. */
export default function WorkoutRow({ workout, onEdit }: WorkoutRowProps): JSX.Element {
  const remove = useDeleteWorkout();
  const confirmDelete = (): void => {
    if (window.confirm(`Excluir o treino "${workout.type}" (${formatDuration(workout.durationMin)})?`)) {
      remove.mutate(workout.id);
    }
  };
  return (
    <li className={styles.workoutRow}>
      <div className={styles.workoutMain}>
        <div className={styles.workoutType}>
          {workout.type} · {formatDuration(workout.durationMin)}
        </div>
        {workout.notes && <div className={styles.workoutNotes}>{workout.notes}</div>}
      </div>
      <div className={styles.doseActions}>
        <button className={`${styles.btn} ${styles.btnIcon}`} onClick={() => onEdit(workout)} aria-label={`Editar treino ${workout.type}`}>
          <Pencil size={16} aria-hidden="true" />
        </button>
        <button
          className={`${styles.btn} ${styles.btnIcon} ${styles.btnDanger}`}
          onClick={confirmDelete}
          disabled={remove.isPending}
          aria-label={`Excluir treino ${workout.type}`}
        >
          <Trash2 size={16} aria-hidden="true" />
        </button>
      </div>
    </li>
  );
}
