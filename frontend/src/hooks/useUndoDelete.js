import { useState, useRef } from "react";

export function useUndoDelete(onConfirmDelete) {
  const [undoTask, setUndoTask] = useState(null);
  const undoTimerRef = useRef(null);

  const handleDeleteTask = (task) => {
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

  const handleUndoDelete = () => {
    if (!undoTimerRef.current || !undoTask) return;
    clearTimeout(undoTimerRef.current.timerId);
    undoTimerRef.current = null;
    setUndoTask(null);
    return undoTask.task; // return task so caller can restore it
  };

  const handleDismiss = () => {
    if (undoTimerRef.current) {
      clearTimeout(undoTimerRef.current.timerId);
      onConfirmDelete(undoTimerRef.current.taskId);
      undoTimerRef.current = null;
    }
    setUndoTask(null);
  };

  return { undoTask, handleDeleteTask, handleUndoDelete, handleDismiss };
}
