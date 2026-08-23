import { useEffect, ReactNode } from "react";
import SubtaskFlow from "./SubtaskFlow";
import SubtaskInline from "./SubtaskInline";
import styles from "./session.module.css";

interface ChecklistItem {
  id: string | number;
  [key: string]: unknown;
}

interface Task {
  id: string | number;
  title: string;
  description?: string;
  checklist?: ChecklistItem[];
}

interface WorkingTaskProps {
  task: Task;
  badge?: ReactNode;
  completeLabel?: string;
  onComplete?: () => void;
  onToggleChecklist?: (taskId: string | number, itemId: string | number) => void;
  onAddChecklist?: (taskId: string | number, desc: string) => void;
  onSwap?: () => void;
  swapLabel?: string;
  children?: ReactNode;
}

export default function WorkingTask({
  task,
  badge,
  completeLabel = "✅ Concluída!",
  onComplete,
  onToggleChecklist,
  onAddChecklist,
  onSwap,
  swapLabel = "Trocar tarefa",
  children,
}: WorkingTaskProps) {
  const hasChecklist = task.checklist?.length > 0;

  // Atalho de teclado: Enter conclui a tarefa (quando não há checklist e não há input focado)
  useEffect(() => {
    if (hasChecklist || !onComplete) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Enter" && !["INPUT", "TEXTAREA", "SELECT", "BUTTON"].includes((e.target as HTMLElement).tagName)) {
        e.preventDefault();
        onComplete();
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [hasChecklist, onComplete]);

  return (
    <>
      {badge}
      <div className={styles.taskDisplay}>
        <span className={styles.taskName}>{task.title}</span>
        {task.description && <span className={styles.taskMeta}>{task.description}</span>}
        {hasChecklist && (
          <SubtaskFlow
            checklist={task.checklist}
            onToggle={(itemId: string | number) => onToggleChecklist?.(task.id, itemId)}
            onAllDone={onComplete}
            onSkip={onComplete}
          />
        )}
      </div>
      <div className={styles.actions}>
        {!hasChecklist && onComplete && (
          <button className={`${styles.btn} ${styles.btnSuccess}`} onClick={onComplete} title="Enter">
            {completeLabel}
          </button>
        )}
        {children}
        {onSwap && (
          <button className={`${styles.btn} ${styles.btnSecondary}`} onClick={onSwap}>
            {swapLabel}
          </button>
        )}
        {onAddChecklist && <SubtaskInline taskId={task.id} onAdd={onAddChecklist} />}
      </div>
    </>
  );
}
