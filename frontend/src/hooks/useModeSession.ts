import { useState } from "react";
import { useSessionPersist } from "../lib/useSessionPersist";
import type { Task } from "../types/index";

/**
 * useModeSession — núcleo comum das sessões de modo.
 *
 * Encapsula a persistência (localStorage) e o estado repetido em quase todas as
 * sessões: progresso (`completed`), tarefas já concluídas nesta sessão (`doneIds`),
 * tarefa selecionada (reidratada de `tasks`), banner de restauração e a lista de
 * tarefas ainda disponíveis (`available`).
 *
 * Cada sessão mantém seu estado específico (activity, cycle, playlist, queue…) e o
 * seu próprio `persist({...})` num useEffect, já que o payload é específico do modo.
 */
export function useModeSession(key: string, tasks: Task[]) {
  const { saved, persist, clearSaved } = useSessionPersist(key);

  const [completed,    setCompleted]    = useState<number>(saved?.completed ?? 0);
  const [doneIds,      setDoneIds]      = useState<Set<string>>(() => new Set(saved?.doneIds ?? []));
  const [selectedTask, setSelectedTask] = useState<Task | null>(() => {
    if (!saved?.selectedTaskId) return null;
    return tasks.find((t) => t.id === saved.selectedTaskId) || null;
  });
  const [wasRestored,  setWasRestored]  = useState<boolean>(!!saved);

  const available: Task[] = tasks.filter((t) => !t.completed && !doneIds.has(t.id));

  /** Marca a tarefa como concluída nesta sessão. */
  const addDone = (id: string): void => setDoneIds((p) => new Set([...p, id]));

  return {
    saved, persist, clearSaved,
    completed, setCompleted,
    doneIds, setDoneIds, addDone,
    selectedTask, setSelectedTask,
    wasRestored, setWasRestored,
    available,
  };
}
