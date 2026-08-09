import { useState, useEffect } from "react";
import TaskCard from "./TaskCard";
import styles from "./TaskList.module.css";

const PAGE_SIZE = 10;

const PRIORITY_GROUPS = [
  { priority: 1, label: "🔴 Críticas", cls: "groupCritical" },
  { priority: 2, label: "🟠 Altas",    cls: "groupHigh" },
  { priority: 3, label: "🟡 Médias",   cls: "groupMedium" },
  { priority: 4, label: "🟢 Baixas",   cls: "groupLow" },
];

function SkeletonCard() {
  return (
    <div className={styles.skeleton}>
      <div className={styles.skeletonCheck} />
      <div className={styles.skeletonBody}>
        <div className={styles.skeletonTitle} />
        <div className={styles.skeletonMeta} />
      </div>
    </div>
  );
}

export default function TaskList({
  tasks,
  loading = false,
  grouped = false,
  onComplete, onReopen, onDelete, onUpdate,
  onAddChecklist, onToggleChecklist, onUpdateChecklist, onDeleteChecklist,
}) {
  const [page, setPage] = useState(1);

  useEffect(() => { setPage(1); }, [tasks, grouped]);

  const cardProps = { onComplete, onReopen, onDelete, onUpdate, onAddChecklist, onToggleChecklist, onUpdateChecklist, onDeleteChecklist };

  if (loading) {
    return (
      <div className={styles.list}>
        {[1, 2, 3, 4].map((i) => <SkeletonCard key={i} />)}
      </div>
    );
  }

  if (tasks.length === 0) {
    return (
      <div className={styles.empty}>
        <span className={styles.emptyIcon}>✓</span>
        <p>Nenhuma tarefa aqui.</p>
      </div>
    );
  }

  /* ── Modo agrupado por prioridade ── */
  if (grouped) {
    return (
      <div className={styles.groupedList}>
        {PRIORITY_GROUPS.map(({ priority, label, cls }) => {
          const group = tasks.filter((t) => t.priority === priority);
          if (group.length === 0) return null;
          return (
            <div key={priority} className={styles.group}>
              <div className={`${styles.groupHeader} ${styles[cls]}`}>
                <span>{label}</span>
                <span className={styles.groupCount}>{group.length}</span>
              </div>
              <div className={styles.list}>
                {group.map((task) => (
                  <TaskCard key={task.id} task={task} {...cardProps} />
                ))}
              </div>
            </div>
          );
        })}
      </div>
    );
  }

  /* ── Modo lista paginada (padrão) ── */
  const totalPages = Math.ceil(tasks.length / PAGE_SIZE);
  const paginated = tasks.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  return (
    <>
      <div className={styles.list}>
        {paginated.map((task) => (
          <TaskCard key={task.id} task={task} {...cardProps} />
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
