import { useState, useEffect, useRef, useCallback } from "react";
import { tasksApi } from "../api/tasks";
import { getStreak } from "../lib/dailyFocusHistory";
import { getDayLevel } from "../lib/dailyFocusDay";
import { useTasks } from "../hooks/useTasks";
import { useUndoDelete } from "../hooks/useUndoDelete";
import { useConfirm } from "../components/ConfirmDialog";
import TaskList from "../components/TaskList";
import AddTaskForm from "../components/AddTaskForm";
import TodayPanel from "../components/TodayPanel";
import styles from "../App.module.css";

const TASK_FILTERS: { label: string; value: string }[] = [
  { label: "Todas", value: "" },
  { label: "Ativas", value: "active" },
  { label: "Concluídas", value: "completed" },
];

const TASK_SORTS: { label: string; value: string }[] = [
  { label: "Prioridade", value: "priority" },
  { label: "Vencimento (mais próximo)", value: "due_date_asc" },
  { label: "Vencimento (mais distante)", value: "due_date_desc" },
  { label: "Vencidas primeiro", value: "overdue" },
  { label: "Data criação", value: "created" },
];

export default function TasksPage(): JSX.Element {
  // UI state — inicializados a partir da query string para persistência via URL
  const [taskFilter, setTaskFilter] = useState<string>(() =>
    new URLSearchParams(window.location.search).get("filter") ?? ""
  );
  const [taskSort, setTaskSort] = useState<string>(() =>
    new URLSearchParams(window.location.search).get("sort") ?? "due_date_asc"
  );
  const [taskSearch, setTaskSearch] = useState<string>(() =>
    new URLSearchParams(window.location.search).get("q") ?? ""
  );
  const [grouped, setGrouped] = useState<boolean>(false);
  const [showTaskForm, setShowTaskForm] = useState<boolean>(false);

  // Sincronizar filtros na URL
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (taskSearch)                              params.set("q",      taskSearch);
    else                                         params.delete("q");
    if (taskFilter)                              params.set("filter", taskFilter);
    else                                         params.delete("filter");
    if (taskSort && taskSort !== "due_date_asc") params.set("sort",   taskSort);
    else                                         params.delete("sort");
    const qs = params.toString();
    const newUrl = window.location.pathname + (qs ? `?${qs}` : "") + window.location.hash;
    window.history.replaceState(null, "", newUrl);
  }, [taskSearch, taskFilter, taskSort]);

  // Pull-to-refresh
  const pullStartY = useRef<number>(0);
  const [pullPct, setPullPct] = useState<number>(0);
  const PULL_THRESHOLD = 72;

  const handleTouchStart = useCallback((e: React.TouchEvent<HTMLDivElement>) => {
    if (window.scrollY === 0) pullStartY.current = e.touches[0].clientY;
  }, []);
  const handleTouchMove = useCallback((e: React.TouchEvent<HTMLDivElement>) => {
    if (window.scrollY > 0) return;
    const dy = e.touches[0].clientY - pullStartY.current;
    if (dy > 0) setPullPct(Math.min(dy / PULL_THRESHOLD, 1));
  }, []);
  const handleTouchEnd = useCallback(() => {
    if (pullPct >= 1) { setPullPct(0); window.location.reload(); }
    else setPullPct(0);
  }, [pullPct]);

  // Business logic
  const tasksHook = useTasks(taskFilter, taskSort);
  const {
    tasks, tasksLoading, tasksError, completedToday,
    removeTask, restoreTask, handleCompleteTask, handleReopenTask,
    handleUpdateTask, handleAddTaskChecklist, handleToggleTaskChecklist,
    handleUpdateTaskChecklist, handleDeleteTaskChecklist,
  } = tasksHook;

  const undoHook = useUndoDelete((id: unknown) => tasksApi.delete(id).catch(() => {}));
  const { undoTask, handleDismiss } = undoHook;
  const { confirm, ConfirmUI } = useConfirm();

  const handleCreateTask = async (data: unknown): Promise<void> => {
    await tasksHook.handleCreateTask(data);
    setShowTaskForm(false);
  };

  const handleDeleteTask = (id: unknown): void => {
    const task = tasks.find((t: any) => t.id === id);
    if (!task) return;
    removeTask(id);
    undoHook.handleDeleteTask(task);
  };

  const handleUndoDelete = (): void => {
    const task = undoHook.handleUndoDelete();
    if (task) restoreTask(task);
  };

  // Bulk selection
  const [selectedIds, setSelectedIds] = useState<Set<unknown>>(new Set());

  const handleSelect = useCallback((id: unknown) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }, []);

  const handleBulkComplete = useCallback(async () => {
    const ids = [...selectedIds];
    setSelectedIds(new Set());
    for (const id of ids) {
      const task = tasks.find((t: any) => t.id === id);
      if (task && !task.completed) await handleCompleteTask(id);
    }
  }, [selectedIds, tasks, handleCompleteTask]);

  const handleBulkDelete = useCallback(async () => {
    const ids = [...selectedIds];
    setSelectedIds(new Set());
    for (const id of ids) handleDeleteTask(id);
  }, [selectedIds, handleDeleteTask]);

  const handleClearSelection = useCallback(() => setSelectedIds(new Set()), []);

  // Search filter
  const search = taskSearch.trim().toLowerCase();
  const visibleTasks = search
    ? tasks.filter((t: any) => {
        const inTitle    = t.title?.toLowerCase().includes(search);
        const inDesc     = t.description?.toLowerCase().includes(search);
        const inChecklist = t.checklist?.some((c: any) => c.description?.toLowerCase().includes(search));
        return inTitle || inDesc || inChecklist;
      })
    : tasks;

  const activeTaskCnt    = tasks.filter((t: any) => !t.completed).length;
  const criticalTaskCnt  = tasks.filter((t: any) => !t.completed && t.priority === 1).length;
  const isFiltered       = !!(taskFilter || taskSearch.trim());

  return (
    <div
      className={styles.app}
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
    >
      {pullPct > 0 && (
        <div className={styles.pullIndicator} style={{ opacity: pullPct, transform: `scaleX(${pullPct})` }} />
      )}

      <header className={styles.header}>
        <div className={styles.headerInner} style={{ gridTemplateColumns: "1fr auto" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, paddingLeft: 4 }}>
            <span style={{ fontSize: 18 }}>✅</span>
            <span style={{ fontSize: 15, fontWeight: 700, color: "var(--text)" }}>
              Tarefas
              {activeTaskCnt > 0 && (
                <span className={styles.tabBadge} style={{ marginLeft: 8 }}>{activeTaskCnt}</span>
              )}
              {criticalTaskCnt > 0 && (
                <span className={styles.tabBadgeCritical} style={{ marginLeft: 4 }}>🔴 {criticalTaskCnt}</span>
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
              className={`${styles.addBtn} ${showTaskForm ? styles.addBtnCancel : ""}`}
              onClick={() => setShowTaskForm((v) => !v)}
            >
              {showTaskForm ? "✕ Cancelar" : <><span>+</span> Nova tarefa</>}
            </button>
          </div>
        </div>
      </header>

      <main className={styles.main}>
        <DailyWidget />
        <TodayPanel
          tasks={tasks}
          completedToday={completedToday}
          onComplete={handleCompleteTask}
          onReopen={handleReopenTask}
          onToggleChecklist={handleToggleTaskChecklist}
          onUpdate={handleUpdateTask}
        />

        {showTaskForm && (
          <div className={styles.formWrapper}>
            <AddTaskForm onSubmit={handleCreateTask} onCancel={() => setShowTaskForm(false)} />
          </div>
        )}

        <div className={styles.controls}>
          <div className={styles.searchWrapper}>
            <span className={styles.searchIcon}>🔍</span>
            <input
              type="text"
              className={styles.searchInput}
              placeholder="Pesquisar tarefas..."
              value={taskSearch}
              onChange={(e: React.ChangeEvent<HTMLInputElement>) => setTaskSearch(e.target.value)}
            />
            {taskSearch && (
              <button className={styles.searchClear} onClick={() => setTaskSearch("")} aria-label="Limpar busca">✕</button>
            )}
          </div>
          <div className={styles.filters}>
            {TASK_FILTERS.map((f) => (
              <button
                key={f.value}
                className={`${styles.filterBtn} ${taskFilter === f.value ? styles.filterActive : ""}`}
                onClick={() => setTaskFilter(f.value)}
              >
                {f.label}
              </button>
            ))}
          </div>
          <div className={styles.sortWrapper}>
            <span className={styles.sortLabel}>Ordenar:</span>
            <select
              className={styles.sortSelect}
              value={taskSort}
              onChange={(e: React.ChangeEvent<HTMLSelectElement>) => setTaskSort(e.target.value)}
            >
              {TASK_SORTS.map((s) => (
                <option key={s.value} value={s.value}>{s.label}</option>
              ))}
            </select>
            <button
              className={`${styles.groupBtn} ${grouped ? styles.groupBtnActive : ""}`}
              onClick={() => setGrouped((v) => !v)}
              title={grouped ? "Desagrupar" : "Agrupar por prioridade"}
            >
              ⊞
            </button>
          </div>
        </div>

        {isFiltered && !tasksLoading && (
          <div className={styles.filterCount}>
            Exibindo <strong>{visibleTasks.length}</strong> de {tasks.length} tarefa{tasks.length !== 1 ? "s" : ""}
            {visibleTasks.length === 0 && <span> — tente outro filtro</span>}
          </div>
        )}

        {tasksLoading && <div className={styles.loading}>Carregando...</div>}
        {tasksError && <div className={styles.error}>Erro: {tasksError}</div>}
        {!tasksError && (
          <TaskList
            tasks={visibleTasks}
            loading={tasksLoading}
            grouped={grouped}
            onComplete={handleCompleteTask}
            onReopen={handleReopenTask}
            onDelete={handleDeleteTask}
            onUpdate={handleUpdateTask}
            onAddChecklist={handleAddTaskChecklist}
            onToggleChecklist={handleToggleTaskChecklist}
            onUpdateChecklist={handleUpdateTaskChecklist}
            onDeleteChecklist={handleDeleteTaskChecklist}
            selectedIds={selectedIds}
            onSelect={handleSelect}
            onBulkComplete={handleBulkComplete}
            onBulkDelete={handleBulkDelete}
            onClearSelection={handleClearSelection}
          />
        )}
      </main>

      {/* FAB mobile */}
      {!showTaskForm && (
        <button
          className={styles.fab}
          onClick={() => { setShowTaskForm(true); window.scrollTo({ top: 0, behavior: "smooth" }); }}
          aria-label="Nova tarefa"
        >
          +
        </button>
      )}

      {undoTask && (
        <UndoToast
          task={undoTask.task}
          expiresAt={undoTask.expiresAt}
          onUndo={handleUndoDelete}
          onDismiss={handleDismiss}
        />
      )}

      {ConfirmUI}
    </div>
  );
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function DailyWidget(): JSX.Element | null {
  const streak = getStreak();
  const level  = getDayLevel();
  if (streak < 1 && level <= 1) return null;
  return (
    <div style={{
      display: "flex", gap: 8, padding: "8px 16px",
      borderBottom: "1px solid var(--border)", background: "var(--surface)", flexWrap: "wrap",
    }}>
      {level > 1 && (
        <span style={{
          fontSize: 12, fontWeight: 600, color: "var(--accent)",
          background: "rgba(124,110,245,0.1)", border: "1px solid rgba(124,110,245,0.25)",
          borderRadius: 20, padding: "3px 10px",
        }}>
          ⚡ Nível {level} hoje
        </span>
      )}
      {streak >= 1 && (
        <span style={{
          fontSize: 12, fontWeight: 600, color: "#f0a540",
          background: "rgba(240,165,64,0.1)", border: "1px solid rgba(240,165,64,0.25)",
          borderRadius: 20, padding: "3px 10px",
        }}>
          🔥 {streak} dia{streak !== 1 ? "s" : ""} seguido{streak !== 1 ? "s" : ""}
        </span>
      )}
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
        <span className={styles.undoText}>🗑 <strong>{task.title}</strong> excluída</span>
        <div className={styles.undoActions}>
          <button className={styles.undoBtn} onClick={onUndo}>↩ Desfazer</button>
          <button className={styles.undoDismiss} onClick={onDismiss}>✕</button>
        </div>
      </div>
    </div>
  );
}
