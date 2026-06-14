import { useState, useEffect } from "react";
import TaskCard from "./TaskCard";
import styles from "./TaskList.module.css";

const PAGE_SIZE = 10;

export default function TaskList({ tasks, onComplete, onReopen, onDelete, onUpdate, onAddChecklist, onToggleChecklist, onUpdateChecklist, onDeleteChecklist }) {
  const [page, setPage] = useState(1);

  useEffect(() => {
    setPage(1);
  }, [tasks]);

  if (tasks.length === 0) {
    return (
      <div className={styles.empty}>
        <span className={styles.emptyIcon}>✓</span>
        <p>Nenhuma tarefa aqui.</p>
      </div>
    );
  }

  const totalPages = Math.ceil(tasks.length / PAGE_SIZE);
  const paginated = tasks.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  return (
    <>
      <div className={styles.list}>
        {paginated.map((task) => (
          <TaskCard
            key={task.id}
            task={task}
            onComplete={onComplete}
            onReopen={onReopen}
            onDelete={onDelete}
            onUpdate={onUpdate}
            onAddChecklist={onAddChecklist}
            onToggleChecklist={onToggleChecklist}
            onUpdateChecklist={onUpdateChecklist}
            onDeleteChecklist={onDeleteChecklist}
          />
        ))}
      </div>
      {tasks.length > PAGE_SIZE && (
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
