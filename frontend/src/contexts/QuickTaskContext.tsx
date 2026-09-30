import { createContext, useCallback, useContext, useMemo, useState, ReactNode } from "react";
import { useTasks } from "../hooks/useTasks";
import { useProjects } from "../hooks/useProjects";
import { tasksApi } from "../api/tasks";
import { dailyTasksApi } from "../api/dailyTasks";
import { parseQuickTask } from "../lib/quickTaskParse";
import { ApiError } from "../lib/apiClient";
import type { TaskCreateInput, TaskRecord } from "../types/tasks";

interface QuickTaskContextValue {
  isOpen: boolean;
  open: () => void;
  close: () => void;
}

const QuickTaskContext = createContext<QuickTaskContextValue | null>(null);

/**
 * Provider da captura rápida global de tarefas.
 *
 * Reaproveita `useTasks` (mesma queryKey → o React Query deduplica com a lista
 * já montada em outras páginas, então NÃO há fetch duplicado) e `useProjects`.
 * A criação usa `handleCreateTask`, que já faz update otimista + invalida
 * `taskKeys.lists()`, mantendo TODAS as páginas em sincronia automaticamente.
 */
export function QuickTaskProvider({ children }: { children: ReactNode }): JSX.Element {
  const [isOpen, setIsOpen] = useState(false);
  const open = useCallback(() => setIsOpen(true), []);
  const close = useCallback(() => setIsOpen(false), []);

  const value = useMemo(() => ({ isOpen, open, close }), [isOpen, open, close]);

  return <QuickTaskContext.Provider value={value}>{children}</QuickTaskContext.Provider>;
}

export function useQuickTask(): QuickTaskContextValue {
  const ctx = useContext(QuickTaskContext);
  if (!ctx) throw new Error("useQuickTask deve ser usado dentro de QuickTaskProvider");
  return ctx;
}

export interface QuickSaveResult {
  task?: TaskRecord;
  /** Criação foi enfileirada offline (sem id retornado). */
  offline: boolean;
  /** Adicionou às Tarefas de Hoje com sucesso. */
  addedToToday: boolean;
  /** Não coube em Hoje (limite de 5 atingido). */
  todayLimitReached: boolean;
}

type QuickSaveInput = TaskCreateInput & { checklist?: string[]; add_to_today?: boolean };

/**
 * Aplica os campos detectados no título (linguagem natural) SEM sobrescrever o
 * que o usuário definiu explicitamente nos controles do formulário.
 */
function applyNaturalLanguage(data: QuickSaveInput): QuickSaveInput {
  const parsed = parseQuickTask(String(data.title ?? ""));
  const merged: QuickSaveInput = { ...data, title: parsed.title };
  if (!data.due_date && parsed.due_date) merged.due_date = parsed.due_date;
  // Hora só faz sentido com data; usa a data resultante (explícita ou detectada).
  if (!data.due_time && parsed.due_time && (merged.due_date || data.due_date)) {
    merged.due_time = parsed.due_time;
  }
  // priority default do form é 4 (baixa) → só aplica a detectada se ainda for o default.
  if ((data.priority == null || data.priority === 4) && parsed.priority) {
    merged.priority = parsed.priority;
  }
  return merged;
}

/**
 * Encapsula os dados/handlers de criação usados pelo formulário rápido.
 * Mantido separado para ser chamado só onde o form está montado.
 */
export function useQuickTaskCreate() {
  const { handleCreateTask, handleAddTaskChecklist, removeTask } = useTasks(undefined, undefined);
  const { projects, createProject } = useProjects(false);

  const save = useCallback(
    async (input: QuickSaveInput): Promise<QuickSaveResult> => {
      const { checklist = [], add_to_today = false, ...rest } = applyNaturalLanguage(input);
      const created = await handleCreateTask(rest as TaskCreateInput);
      const task = created as TaskRecord | undefined;
      const taskId = task?.id;

      // Offline: create enfileirado sem id → não dá para anexar subtarefas/Hoje.
      if (!taskId) {
        return { offline: true, addedToToday: false, todayLimitReached: false };
      }

      for (const item of checklist) {
        const description = item.trim();
        if (description) {
          try { await handleAddTaskChecklist(taskId, description); } catch { /* segue com as demais */ }
        }
      }

      let addedToToday = false;
      let todayLimitReached = false;
      if (add_to_today) {
        try {
          await dailyTasksApi.add(taskId);
          addedToToday = true;
        } catch (err) {
          if (err instanceof ApiError && err.status === 409) todayLimitReached = true;
        }
      }

      return { task, offline: false, addedToToday, todayLimitReached };
    },
    [handleCreateTask, handleAddTaskChecklist]
  );

  // Desfazer: remove do cache imediatamente e apaga no servidor (soft-delete).
  const undoCreate = useCallback(
    async (taskId: string): Promise<void> => {
      removeTask(taskId);
      try { await tasksApi.delete(taskId); } catch { /* já removido/indisponível */ }
    },
    [removeTask]
  );

  return { save, undoCreate, projects, createProject };
}
