import { useState, useEffect, useCallback } from "react";
import { useQuery } from "@tanstack/react-query";
import { routinesApi } from "../api/routines";
import { tasksApi } from "../api/tasks";
import { useRoutines } from "../hooks/useRoutines";
import { useTasks } from "../hooks/useTasks";
import { useTaskDetail } from "../hooks/useTaskDetail";
import { useProjects } from "../hooks/useProjects";
import { useUndoDelete } from "../hooks/useUndoDelete";
import { taskKeys } from "../lib/taskKeys";
import RoutineList from "../components/RoutineList";
import RoutineHeatmap from "../components/RoutineHeatmap";
import AddRoutineForm from "../components/AddRoutineForm";
import RoutineTemplates from "../components/RoutineTemplates";
import DailyRoutinePanel from "../components/DailyRoutinePanel";
import TaskDetailModal from "../components/TaskDetailModal";
import ErrorBoundary from "../components/ErrorBoundary";
import styles from "../App.module.css";

const ROUTINE_FILTERS: { label: string; value: string }[] = [
  { label: "Todas", value: "" },
  { label: "Hoje", value: "today" },
  { label: "Pendentes", value: "pending" },
  { label: "Feitas hoje", value: "done" },
];
const ROUTINE_FILTER_VALUES = new Set(ROUTINE_FILTERS.map((f) => f.value));

/**
 * Lê o filtro inicial da query string (deep-link previsível: ?filter=pending|done).
 * Valores desconhecidos (ex.: `today`, usado pela página de Tarefas) caem em ""
 * (Todas) — a "rotina de hoje" já é representada pelo painel Rotina Diária no topo.
 */
function initialRoutineFilter(): string {
  try {
    const v = new URLSearchParams(window.location.search).get("filter") ?? "";
    return ROUTINE_FILTER_VALUES.has(v) ? v : "";
  } catch {
    return "";
  }
}

export default function RoutinesPage(): JSX.Element {
  const [routineFilter, setRoutineFilter]   = useState<string>(initialRoutineFilter);
  const [showRoutineForm, setShowRoutineForm] = useState<boolean>(false);
  const [routineView, setRoutineView]       = useState<string>("list");

  const routinesHook = useRoutines(routineFilter);
  const {
    routinesLoading, routinesError,
    removeRoutine, restoreRoutine,
    handleCompleteRoutine, handleUncompleteRoutine, handleDeleteRoutine,
    handleUpdateRoutine, handleCompleteRoutineForDate,
    handleAddProgress, handleAddRoutineChecklist,
    handleToggleRoutineChecklist, handleDeleteRoutineChecklist,
  } = routinesHook;
  const routines = routinesHook.routines as any[];

  // Painel "Rotina Diária": tarefas recorrentes (daily/weekdays) válidas hoje.
  // Reaproveita o mesmo componente/lógica da página de Tarefas.
  // - `allTasksForToday`: MESMA queryKey da página de Tarefas → cache compartilhado
  //   (navegar entre Tarefas ⇆ Rotinas não refaz o fetch). Alimenta o painel e o modal.
  // - `useTasks`: fornece as mutações (concluir/reabrir/checklist/editar) e o feedback.
  const { data: allTasksForToday = [] } = useQuery<any[]>({
    queryKey: taskKeys.todayPanelAll(),
    queryFn: () => tasksApi.list({ sort: "due_date_asc" }),
    staleTime: 30_000,
  });
  const {
    completingIds,
    handleCompleteTask, handleUndoCompleteTask, handleReopenTask,
    handleUpdateTask, handleAddTaskChecklist, handleToggleTaskChecklist,
    handleUpdateTaskChecklist, handleDeleteTaskChecklist,
    removeTask,
  } = useTasks("today", "due_date_asc", undefined, undefined);

  const projectsHook = useProjects(true);

  // Modal central de detalhes/edição de tarefa (deep-link ?task=), igual à página
  // de Tarefas. Derivado de `allTasksForToday` para refletir edições em tempo real.
  const { detailTask, openDetail, closeDetail } = useTaskDetail(allTasksForToday as any);

  // Feedback de conclusão de tarefa (toast com "Desfazer"), reaproveitando o padrão
  // da página de Tarefas para consistência de UX.
  const [completionToast, setCompletionToast] = useState<null | {
    taskId: string; completionId: string; message: string; expiresAt: number;
  }>(null);

  const handleCompleteTaskWithFeedback = useCallback(async (id: string): Promise<void> => {
    if (completingIds.has(String(id))) return;
    const result = await handleCompleteTask(id) as any;
    if (result?._completion_id) {
      setCompletionToast({
        taskId: String(id), completionId: result._completion_id,
        message: result._completion_message || "Tarefa concluída.", expiresAt: Date.now() + 8_000,
      });
    }
  }, [completingIds, handleCompleteTask]);

  const handleUndoCompletion = useCallback(async () => {
    if (!completionToast) return;
    await handleUndoCompleteTask(completionToast.taskId, completionToast.completionId);
    setCompletionToast(null);
  }, [completionToast, handleUndoCompleteTask]);

  const handleDeleteTaskFromModal = useCallback((id: unknown): void => {
    removeTask(String(id));
    tasksApi.delete(String(id)).catch(() => {});
    closeDetail();
  }, [removeTask, closeDetail]);

  const undoRoutineHook = useUndoDelete((id: unknown) => routinesApi.delete(String(id)).catch(() => {}));
  const { undoTask: undoRoutine, handleDismiss: handleDismissRoutine } = undoRoutineHook;

  const handleCreateRoutine = async (data: unknown): Promise<void> => {
    await routinesHook.handleCreateRoutine(data);
    setShowRoutineForm(false);
  };

  const handleDeleteRoutineWithUndo = (id: unknown): void => {
    const routine = routines.find((r: any) => r.id === id);
    if (!routine) return;
    removeRoutine(id);
    undoRoutineHook.handleDeleteTask(routine);
  };

  const handleUndoDeleteRoutine = (): void => {
    const routine = undoRoutineHook.handleUndoDelete();
    if (routine) restoreRoutine(routine);
  };

  const doneTodayCnt   = routines.filter((r: any) => r.is_completed_today).length;
  const totalRoutineCnt = routines.length;

  return (
    <div className={styles.app}>
      <header className={styles.header}>
        <div className={styles.headerInner} style={{ gridTemplateColumns: "1fr auto" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, paddingLeft: 4 }}>
            <span style={{ fontSize: 18 }}>🔄</span>
            <span style={{ fontSize: 15, fontWeight: 700, color: "var(--text)" }}>
              Hábitos
              {totalRoutineCnt > 0 && (
                <span
                  className={`${styles.tabBadge} ${doneTodayCnt === totalRoutineCnt ? styles.tabBadgeDone : ""}`}
                  style={{ marginLeft: 8 }}
                >
                  {doneTodayCnt}/{totalRoutineCnt}
                </span>
              )}
            </span>
          </div>

          <div className={styles.addBtnWrap} style={{ borderLeft: "1px solid var(--border)" }}>
            <button
              className={styles.reloadBtn}
              onClick={() => window.location.reload()}
              title="Recarregar"
            >
              <span>🔄</span>
              <span className={styles.reloadText}>Atualizar</span>
            </button>
            <button
              className={`${styles.addBtn} ${showRoutineForm ? styles.addBtnCancel : styles.addBtnRoutine}`}
              onClick={() => setShowRoutineForm((v) => !v)}
            >
              {showRoutineForm ? "✕ Cancelar" : <><span>+</span> Novo hábito</>}
            </button>
          </div>
        </div>
      </header>

      <main className={styles.main}>
        <ErrorBoundary compact label="painel Rotina Diária">
          <DailyRoutinePanel
            tasks={allTasksForToday}
            onComplete={handleCompleteTaskWithFeedback}
            onReopen={handleReopenTask}
            onToggleChecklist={handleToggleTaskChecklist}
            completingIds={completingIds}
            onOpenDetail={openDetail}
          />
        </ErrorBoundary>

        {detailTask && (
          <TaskDetailModal
            task={detailTask}
            onClose={closeDetail}
            onComplete={(id) => handleCompleteTaskWithFeedback(String(id))}
            onReopen={(id) => handleReopenTask(String(id))}
            onDelete={handleDeleteTaskFromModal}
            onUpdate={handleUpdateTask}
            onAddChecklist={handleAddTaskChecklist}
            onToggleChecklist={(taskId, itemId) => handleToggleTaskChecklist(String(taskId), String(itemId))}
            onUpdateChecklist={handleUpdateTaskChecklist}
            onDeleteChecklist={handleDeleteTaskChecklist}
            completing={completingIds?.has(String(detailTask.id))}
            projects={projectsHook.projects}
            onCreateProject={projectsHook.createProject}
          />
        )}

        <RoutineTemplates onCreateRoutine={handleCreateRoutine} />

        {showRoutineForm && (
          <div className={styles.formWrapper}>
            <AddRoutineForm onSubmit={handleCreateRoutine} onCancel={() => setShowRoutineForm(false)} />
          </div>
        )}

        <div className={styles.controls}>
          <div className={styles.filters}>
            {routineView === "list" && ROUTINE_FILTERS.map((f) => (
              <button
                key={f.value}
                className={`${styles.filterBtn} ${routineFilter === f.value ? styles.filterActive : ""}`}
                onClick={() => setRoutineFilter(f.value)}
              >
                {f.label}
              </button>
            ))}
          </div>
          <div className={styles.filters}>
            <button
              className={`${styles.filterBtn} ${routineView === "list" ? styles.filterActive : ""}`}
              onClick={() => setRoutineView("list")}
            >
              Lista
            </button>
            <button
              className={`${styles.filterBtn} ${routineView === "heatmap" ? styles.filterActive : ""}`}
              onClick={() => setRoutineView("heatmap")}
            >
              Heatmap
            </button>
          </div>
          {routineView === "list" && doneTodayCnt > 0 && (
            <span className={styles.routineProgress}>
              {doneTodayCnt} de {totalRoutineCnt} concluídas hoje
            </span>
          )}
        </div>

        {routinesLoading && <div className={styles.loading}>Carregando...</div>}
        {routinesError && <div className={styles.error}>Erro: {routinesError}</div>}
        {!routinesLoading && !routinesError && routineView === "list" && (
          <RoutineList
            routines={routines}
            onComplete={handleCompleteRoutine}
            onUncomplete={handleUncompleteRoutine}
            onCompleteForDate={handleCompleteRoutineForDate}
            onDelete={handleDeleteRoutineWithUndo}
            onUpdate={handleUpdateRoutine}
            onAddProgress={handleAddProgress}
            onAddChecklist={handleAddRoutineChecklist}
            onToggleChecklist={handleToggleRoutineChecklist}
            onDeleteChecklist={handleDeleteRoutineChecklist}
          />
        )}
        {!routinesLoading && !routinesError && routineView === "heatmap" && (
          <RoutineHeatmap routines={routines} />
        )}
      </main>

      {undoRoutine && (
        <UndoToast
          task={undoRoutine.task}
          expiresAt={undoRoutine.expiresAt}
          onUndo={handleUndoDeleteRoutine}
          onDismiss={handleDismissRoutine}
        />
      )}

      {completionToast && (
        <CompletionToast
          message={completionToast.message}
          expiresAt={completionToast.expiresAt}
          onUndo={handleUndoCompletion}
          onDismiss={() => setCompletionToast(null)}
        />
      )}
    </div>
  );
}

interface CompletionToastProps {
  message: string;
  expiresAt: number;
  onUndo: () => void;
  onDismiss: () => void;
}

function CompletionToast({ message, expiresAt, onUndo, onDismiss }: CompletionToastProps): JSX.Element {
  const [pct, setPct] = useState<number>(100);
  useEffect(() => {
    const total = Math.max(1, expiresAt - Date.now());
    const interval = setInterval(() => {
      const remaining = expiresAt - Date.now();
      setPct(Math.max(0, (remaining / total) * 100));
      if (remaining <= 0) { clearInterval(interval); onDismiss(); }
    }, 80);
    return () => clearInterval(interval);
  }, [expiresAt, onDismiss]);
  return (
    <div className={styles.undoToast} role="status" aria-live="polite">
      <div className={`${styles.undoBar} ${styles.completionBar}`} style={{ width: `${pct}%` }} />
      <div className={styles.undoContent}>
        <span className={styles.undoText}>✅ <strong>{message}</strong></span>
        <div className={styles.undoActions}>
          <button className={styles.undoBtn} onClick={onUndo}>↩ Desfazer</button>
          <button className={styles.undoDismiss} onClick={onDismiss}>✕</button>
        </div>
      </div>
    </div>
  );
}

interface UndoToastProps {
  task: any;
  expiresAt: number;
  onUndo: () => void;
  onDismiss: () => void;
}

function UndoToast({ task, expiresAt, onUndo, onDismiss }: UndoToastProps): JSX.Element {
  const [pct, setPct] = useState<number>(100);
  useEffect(() => {
    const total = expiresAt - Date.now();
    const interval = setInterval(() => {
      const remaining = expiresAt - Date.now();
      setPct(Math.max(0, (remaining / total) * 100));
      if (remaining <= 0) clearInterval(interval);
    }, 50);
    return () => clearInterval(interval);
  }, [expiresAt]);
  return (
    <div className={styles.undoToast}>
      <div className={styles.undoBar} style={{ width: `${pct}%` }} />
      <div className={styles.undoContent}>
        <span className={styles.undoText}>🗑 <strong>{task.title}</strong> excluído (Hábito)</span>
        <div className={styles.undoActions}>
          <button className={styles.undoBtn} onClick={onUndo}>↩ Desfazer</button>
          <button className={styles.undoDismiss} onClick={onDismiss}>✕</button>
        </div>
      </div>
    </div>
  );
}
