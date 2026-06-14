import { useState, useEffect } from "react";
import RoutineCard from "./RoutineCard";
import styles from "./RoutineList.module.css";

const PAGE_SIZE = 8;

export default function RoutineList({ routines, ...handlers }) {
  const [page, setPage] = useState(1);

  useEffect(() => {
    setPage(1);
  }, [routines]);

  if (routines.length === 0) {
    return (
      <div className={styles.empty}>
        <span className={styles.emptyIcon}>🔄</span>
        <p>Nenhuma rotina aqui.</p>
      </div>
    );
  }

  const totalPages = Math.ceil(routines.length / PAGE_SIZE);
  const paginated = routines.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  return (
    <>
      <div className={styles.list}>
        {paginated.map((r) => (
          <RoutineCard key={r.id} routine={r} {...handlers} />
        ))}
      </div>
      {routines.length > PAGE_SIZE && (
        <div className={styles.pagination}>
          <button
            className={styles.pageBtn}
            onClick={() => setPage((p) => p - 1)}
            disabled={page === 1}
          >
            ← Anterior
          </button>
          <span className={styles.pageInfo}>Página {page} de {totalPages}</span>
          <button
            className={styles.pageBtn}
            onClick={() => setPage((p) => p + 1)}
            disabled={page === totalPages}
          >
            Próxima →
          </button>
        </div>
      )}
    </>
  );
}
