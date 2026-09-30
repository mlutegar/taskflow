// NOTE: List virtualization with @tanstack/react-virtual is ready to enable.
// To activate it:
//   1. Run: npm install @tanstack/react-virtual
//   2. Replace this file's flat-list render with the virtualized version below.
//
// ─── VIRTUALIZED IMPLEMENTATION ───────────────────────────────────────────────
// import { useRef } from "react";
// import { useVirtualizer } from "@tanstack/react-virtual";
//
// Inside the flat-list branch (replace the paginated section):
//
//   function VirtualTaskList({ tasks, cardProps }) {
//     const parentRef = useRef(null);
//     const rowVirtualizer = useVirtualizer({
//       count: tasks.length,
//       getScrollElement: () => parentRef.current,
//       estimateSize: () => 80, // px — measured from TaskCard .main padding (14px*2) + content (~52px)
//       overscan: 5,
//     });
//
//     return (
//       <div
//         ref={parentRef}
//         style={{ height: "600px", overflowY: "auto" }}
//         className={styles.virtualContainer}
//       >
//         <div style={{ height: `${rowVirtualizer.getTotalSize()}px`, position: "relative" }}>
//           {rowVirtualizer.getVirtualItems().map((virtualRow) => {
//             const task = tasks[virtualRow.index];
//             return (
//               <div
//                 key={task.id}
//                 data-index={virtualRow.index}
//                 ref={rowVirtualizer.measureElement}
//                 style={{
//                   position: "absolute",
//                   top: 0,
//                   left: 0,
//                   width: "100%",
//                   transform: `translateY(${virtualRow.start}px)`,
//                   paddingBottom: "8px",
//                 }}
//               >
//                 <TaskCard key={task.id} task={task} {...cardProps} />
//               </div>
//             );
//           })}
//         </div>
//       </div>
//     );
//   }
//
// Then in the main export, replace the paginated block with:
//   return <VirtualTaskList tasks={tasks} cardProps={cardProps} />;
//
// Also add to TaskList.module.css:
//   .virtualContainer { contain: strict; }
// ──────────────────────────────────────────────────────────────────────────────

import { useState, useEffect } from "react";
import TaskCard from "./TaskCard";
import styles from "./TaskList.module.css";
import { Project, ProjectInput } from "../api/projects";
import type { TaskUpdateInput } from "../types/tasks";

interface TaskItem {
  id: string;
  priority: number;
  [key: string]: unknown;
}

// Os handlers recebem IDs (o TaskCard chama `onComplete(task.id)`, etc.), não o
// objeto da tarefa. As assinaturas abaixo refletem o contrato real usado por
// `useTasks` e pelo `TaskCard`.
type TaskHandler = (id: string) => void | Promise<unknown>;
type ItemHandler = (taskId: string, itemId: string) => void | Promise<unknown>;

interface CardProps {
  onComplete: TaskHandler | undefined;
  onReopen: TaskHandler | undefined;
  onDelete: TaskHandler | undefined;
  onUpdate: ((id: string, payload: TaskUpdateInput) => void | Promise<unknown>) | undefined;
  onAddChecklist: ((taskId: string, text: string, parentId?: string | null) => void | Promise<unknown>) | undefined;
  onToggleChecklist: ItemHandler | undefined;
  onUpdateChecklist: ((taskId: string, itemId: string, updates: unknown) => void | Promise<unknown>) | undefined;
  onDeleteChecklist: ItemHandler | undefined;
}

interface TaskListProps {
  tasks: TaskItem[];
  loading?: boolean;
  grouped?: boolean;
  onComplete?: TaskHandler;
  onReopen?: TaskHandler;
  onDelete?: TaskHandler;
  onUpdate?: (id: string, payload: TaskUpdateInput) => void | Promise<unknown>;
  onAddChecklist?: (taskId: string, text: string, parentId?: string | null) => void | Promise<unknown>;
  onToggleChecklist?: ItemHandler;
  onUpdateChecklist?: (taskId: string, itemId: string, updates: unknown) => void | Promise<unknown>;
  onDeleteChecklist?: ItemHandler;
  completingIds?: Set<string>;
  projects?: Project[];
  onCreateProject?: (data: ProjectInput) => Promise<Project>;
}

const PAGE_SIZE = 10;

const PRIORITY_GROUPS: { priority: number; label: string; cls: string }[] = [
  { priority: 1, label: "🔴 Críticas", cls: "groupCritical" },
  { priority: 2, label: "🟠 Altas",    cls: "groupHigh" },
  { priority: 3, label: "🟡 Médias",   cls: "groupMedium" },
  { priority: 4, label: "🟢 Baixas",   cls: "groupLow" },
];

function SkeletonCard(): JSX.Element {
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
  completingIds = new Set(),
  projects = [],
  onCreateProject,
}: TaskListProps): JSX.Element {
  const [page, setPage] = useState<number>(1);

  useEffect(() => { setPage(1); }, [tasks, grouped]);

  const cardProps: CardProps = { onComplete, onReopen, onDelete, onUpdate, onAddChecklist, onToggleChecklist, onUpdateChecklist, onDeleteChecklist };

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
                  <TaskCard key={task.id} task={task} {...cardProps} projects={projects} onCreateProject={onCreateProject} completing={completingIds.has(String(task.id))} />
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
          <TaskCard key={task.id} task={task} {...cardProps} projects={projects} onCreateProject={onCreateProject} completing={completingIds.has(String(task.id))} />
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
