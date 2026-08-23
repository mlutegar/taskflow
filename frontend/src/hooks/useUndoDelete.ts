import { useState, useRef } from "react";

interface Task {
  id: string | number;
  [key: string]: unknown;
}

interface UndoTask {
  task: Task;
  expiresAt: number;
}

interface UndoTimerRef {
  timerId: ReturnType<typeof setTimeout>;
  taskId: string | number;
}

export function useUndoDelete(onConfirmDelete: (taskId: string | number) => void): {
  undoTask: UndoTask | null;
  handleDeleteTask: (task: Task) => void;
  handleUndoDelete: () => Task | undefined;
  handleDismiss: () => void;
} {
  const [undoTask, setUndoTask] = useState<UndoTask | null>(null);
  const undoTimerRef = useRef<UndoTimerRef | null>(null);

  const handleDeleteTask = (task: Task): void => {
    if (!task) return;

    if (undoTimerRef.current) {
      clearTimeout(undoTimerRef.current.timerId);
      onConfirmDelete(undoTimerRef.current.taskId);
    }

    const UNDO_MS = 5000;
    const expiresAt = Date.now() + UNDO_MS;
    setUndoTask({ task, expiresAt });

    const timerId = setTimeout(() => {
      onConfirmDelete(task.id);
      setUndoTask(null);
      undoTimerRef.current = null;
    }, UNDO_MS);

    undoTimerRef.current = { timerId, taskId: task.id };
  };

  const handleUndoDelete = (): Task | undefined => {
    if (!undoTimerRef.current || !undoTask) return;
    clearTimeout(undoTimerRef.current.timerId);
    undoTimerRef.current = null;
    setUndoTask(null);
    return undoTask.task; // return task so caller can restore it
  };

  const handleDismiss = (): void => {
    if (undoTimerRef.current) {
      clearTimeout(undoTimerRef.current.timerId);
      onConfirmDelete(undoTimerRef.current.taskId);
      undoTimerRef.current = null;
    }
    setUndoTask(null);
  };

  return { undoTask, handleDeleteTask, handleUndoDelete, handleDismiss };
}
