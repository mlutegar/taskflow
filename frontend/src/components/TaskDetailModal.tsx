import { RefObject, useId } from "react";
import ModalOverlay from "./shared/ModalOverlay";
import ErrorBoundary from "./ErrorBoundary";
import { useDialog } from "../lib/useDialog";
import TaskCard from "./TaskCard";
import OrbitaLauncher from "./OrbitaLauncher";
import { TaskRecord } from "../types/tasks";
import { Project, ProjectInput } from "../api/projects";
import styles from "./TaskDetailModal.module.css";

interface TaskDetailModalProps {
  task: TaskRecord;
  onClose: () => void;
  onComplete: (id: number | string) => void;
  onReopen: (id: number | string) => void;
  onDelete: (id: number | string) => void;
  onUpdate: (id: number | string, payload: Record<string, unknown>) => Promise<unknown>;
  onAddChecklist: (taskId: number | string, text: string, parentId?: number | string | null) => Promise<unknown>;
  onToggleChecklist: (taskId: number | string, itemId: number | string) => void;
  onUpdateChecklist: (taskId: number | string, itemId: number | string, updates: Record<string, unknown>) => Promise<unknown>;
  onDeleteChecklist: (taskId: number | string, itemId: number | string) => void;
  completing?: boolean;
  projects?: Project[];
  onCreateProject?: (data: ProjectInput) => Promise<Project>;
}

export default function TaskDetailModal({
  task,
  onClose,
  onComplete,
  onReopen,
  onDelete,
  ...handlers
}: TaskDetailModalProps): JSX.Element {
  const dialogRef = useDialog(onClose);
  const titleId = useId();

  // Concluir/reabrir/deletar encerram a visualização (ação finalizada).
  const handleComplete = (id: number | string): void => { onComplete(id); onClose(); };
  const handleReopen = (id: number | string): void => { onReopen(id); onClose(); };
  const handleDelete = (id: number | string): void => { onDelete(id); onClose(); };

  return (
    <ModalOverlay onClose={onClose}>
      <div
        ref={dialogRef as RefObject<HTMLDivElement>}
        role="document"
        aria-labelledby={titleId}
        tabIndex={-1}
        className={styles.body}
        onClick={(e) => e.stopPropagation()}
      >
        <div className={styles.head}>
          <h2 id={titleId} className={styles.title}>{task.title}</h2>
          <button className={styles.closeBtn} onClick={onClose} aria-label="Fechar" title="Fechar">
            ✕
          </button>
        </div>
        <ErrorBoundary compact label="os detalhes da tarefa">
          <TaskCard
            task={task}
            defaultExpanded
            onComplete={handleComplete}
            onReopen={handleReopen}
            onDelete={handleDelete}
            {...handlers}
          />
          <OrbitaLauncher task={task} onUpdate={handlers.onUpdate} />
        </ErrorBoundary>
      </div>
    </ModalOverlay>
  );
}
