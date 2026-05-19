import RoutineCard from "./RoutineCard";
import styles from "./RoutineList.module.css";

export default function RoutineList({ routines, ...handlers }) {
  if (routines.length === 0) {
    return (
      <div className={styles.empty}>
        <span className={styles.emptyIcon}>🔄</span>
        <p>Nenhuma rotina aqui.</p>
      </div>
    );
  }

  return (
    <div className={styles.list}>
      {routines.map((r) => (
        <RoutineCard key={r.id} routine={r} {...handlers} />
      ))}
    </div>
  );
}
