import { useState, useEffect, useRef, useCallback, lazy, Suspense } from "react";
import { tasksApi } from "./api/tasks";
import { routinesApi } from "./api/routines";
import { getStreak } from "./lib/dailyFocusHistory";
import { getDayLevel } from "./lib/dailyFocusDay";
import { useTasks } from "./hooks/useTasks";
import { useRoutines } from "./hooks/useRoutines";
import { useUndoDelete } from "./hooks/useUndoDelete";
import { useConfirm } from "./components/ConfirmDialog";
import TaskList from "./components/TaskList";
import AddTaskForm from "./components/AddTaskForm";
import RoutineList from "./components/RoutineList";
import RoutineHeatmap from "./components/RoutineHeatmap";
import AddRoutineForm from "./components/AddRoutineForm";
import RoutineTemplates from "./components/RoutineTemplates";
import ModesPanel from "./components/ModesPanel";
import TodayPanel from "./components/TodayPanel";
import WeeklyReview from "./components/WeeklyReview";
import styles from "./App.module.css";
import { ToastProvider } from './components/shared/Toast';
import { storageGet, storageSet } from "./lib/storage";
import { SK } from "./lib/storageKeys";
import { getUsageLogs } from "./lib/sessionUsageLog";

/** Retorna a chave ISO da semana atual, ex: "2026-W34". */
function getCurrentWeekKey(): string {
  const now = new Date();
  const jan1 = new Date(now.getFullYear(), 0, 1);
  const week = Math.ceil(((now.getTime() - jan1.getTime()) / 86400000 + jan1.getDay() + 1) / 7);
  return `${now.getFullYear()}-W${String(week).padStart(2, "0")}`;
}

const DashboardPage = lazy(() => import("./components/dashboard/DashboardPage"));

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

const ROUTINE_FILTERS: { label: string; value: string }[] = [
  { label: "Todas", value: "" },
  { label: "Pendentes", value: "pending" },
  { label: "Feitas hoje", value: "done" },
];

export default function App(): JSX.Element {
  const [tab, setTab] = useState<string>(
    () => storageGet<string>(SK.ACTIVE_TAB, "tasks")
  );

  useEffect(() => {
    storageSet(SK.ACTIVE_TAB, tab);
  }, [tab]);

  // ── Resumo semanal automático ──────────────────────────────────────────────
  const [showWeeklySummary, setShowWeeklySummary] = useState<boolean>(false);

  useEffect(() => {
    const lastShown = storageGet<string>(SK.WEEKLY_SUMMARY_LAST_SHOWN, "");
    const currentWeek = getCurrentWeekKey();
    // Só exibe se: semana nova E pelo menos 1 sessão registrada (evita tela vazia)
    if (lastShown !== currentWeek && getUsageLogs().length > 0) {
      setShowWeeklySummary(true);
      storageSet(SK.WEEKLY_SUMMARY_LAST_SHOWN, currentWeek);
    }
  }, []);

  const ACTIVE_SESSION_KEY = "taskflow." + SK.ACTIVE_MULTI_CARD_SESSION;
  const [hasActiveSession, setHasActiveSession] = useState<boolean>(
    () => !!localStorage.getItem(ACTIVE_SESSION_KEY)
  );

  useEffect(() => {
    const sync = (): void =>
      setHasActiveSession(!!localStorage.getItem(ACTIVE_SESSION_KEY));

    const handleStorage = (e: StorageEvent): void => {
      if (e.key === ACTIVE_SESSION_KEY || e.key === null) sync();
    };
    const handleVisibility = (): void => {
      if (document.visibilityState === "visible") sync();
    };

    window.addEventListener("storage", handleStorage);                    // cross-tab
    window.addEventListener("multiCardSessionChanged", sync);             // same-tab
    document.addEventListener("visibilitychange", handleVisibility);      // fallback

    return () => {
      window.removeEventListener("storage", handleStorage);
      window.removeEventListener("multiCardSessionChanged", sync);
      document.removeEventListener("visibilitychange", handleVisibility);
    };
  }, []);

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

  // Sincronizar filtros na URL (replaceState — não cria entrada no histórico)
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);

    if (taskSearch)                              params.set("q",      taskSearch);
    else                                         params.delete("q");

    if (taskFilter)                              params.set("filter", taskFilter);
    else                                         params.delete("filter");

    if (taskSort && taskSort !== "due_date_asc") params.set("sort",   taskSort);
    else                                         params.delete("sort");

    const qs = params.toString();
    const newUrl =
      window.location.pathname +
      (qs ? `?${qs}` : "") +
      window.location.hash;

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
    if (pullPct >= 1) {
      setPullPct(0);
      window.location.reload();
    } else {
      setPullPct(0);
    }
  }, [pullPct]);

  const [showTaskForm, setShowTaskForm] = useState<boolean>(false);
  const [routineFilter, setRoutineFilter] = useState<string>("");
  const [showRoutineForm, setShowRoutineForm] = useState<boolean>(false);
  const [routineView, setRoutineView] = useState<string>("list");

  // Business logic hooks
  const tasksHook = useTasks(taskFilter, taskSort);
  const {
    tasks,
    tasksLoading,
    tasksError,
    completedToday,
    removeTask,
    restoreTask,
    handleCompleteTask,
    handleReopenTask,
    handleUpdateTask,
    handleAddTaskChecklist,
    handleToggleTaskChecklist,
    handleUpdateTaskChecklist,
    handleDeleteTaskChecklist,
  } = tasksHook;

  const routinesHook = useRoutines(routineFilter);
  const {
    routines,
    routinesLoading,
    routinesError,
    removeRoutine,
    restoreRoutine,
    handleCompleteRoutine,
    handleUncompleteRoutine,
    handleDeleteRoutine,
    handleUpdateRoutine,
    handleCompleteRoutineForDate,
    handleAddProgress,
    handleAddRoutineChecklist,
    handleToggleRoutineChecklist,
    handleDeleteRoutineChecklist,
  } = routinesHook;

  const undoHook = useUndoDelete((id: unknown) => tasksApi.delete(id).catch(() => {}));
  const { undoTask, handleDismiss } = undoHook;

  const undoRoutineHook = useUndoDelete((id: unknown) => routinesApi.delete(id).catch(() => {}));
  const { undoTask: undoRoutine, handleDismiss: handleDismissRoutine } = undoRoutineHook;

  const { confirm, ConfirmUI } = useConfirm();

  // Exclusão de rotina com undo de 5 segundos
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

  // Wrappers that also manage UI state
  const handleCreateTask = async (data: unknown): Promise<void> => {
    await tasksHook.handleCreateTask(data);
    setShowTaskForm(false);
  };

  const handleCreateRoutine = async (data: unknown): Promise<void> => {
    await routinesHook.handleCreateRoutine(data);
    setShowRoutineForm(false);
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
        const inTitle = t.title?.toLowerCase().includes(search);
        const inDesc = t.description?.toLowerCase().includes(search);
        const inChecklist = t.checklist?.some((c: any) =>
          c.description?.toLowerCase().includes(search)
        );
        return inTitle || inDesc || inChecklist;
      })
    : tasks;

  // Stats
  const activeTaskCnt = tasks.filter((t: any) => !t.completed).length;
  const criticalTaskCnt = tasks.filter((t: any) => !t.completed && t.priority === 1).length;
  const isFiltered = !!(taskFilter || taskSearch.trim());
  const doneTodayCnt = routines.filter((r: any) => r.is_completed_today).length;
  const totalRoutineCnt = routines.length;

  return (
    <ToastProvider>
    <div
      className={styles.app}
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
    >
      {/* Indicador pull-to-refresh */}
      {pullPct > 0 && (
        <div className={styles.pullIndicator} style={{ opacity: pullPct, transform: `scaleX(${pullPct})` }} />
      )}
      <header className={styles.header}>
        <div className={styles.headerInner}>
          {/* Logo */}
          <div className={styles.logo}>
            <span className={styles.logoIcon}>⚡</span>
            <span className={styles.logoText}>Task<span>Flow</span></span>
          </div>

          {/* Tabs */}
          <nav className={styles.tabs}>
            <button
              className={`${styles.tab} ${tab === "tasks" ? styles.tabActive : ""}`}
              onClick={() => setTab("tasks")}
            >
              Tarefas
              {activeTaskCnt > 0 && <span className={styles.tabBadge}>{activeTaskCnt}</span>}
              {criticalTaskCnt > 0 && (
                <span className={styles.tabBadgeCritical} title={`${criticalTaskCnt} tarefa${criticalTaskCnt !== 1 ? "s" : ""} crítica${criticalTaskCnt !== 1 ? "s" : ""}`}>
                  🔴 {criticalTaskCnt}
                </span>
              )}
            </button>
            <button
              className={`${styles.tab} ${tab === "routines" ? styles.tabActive : ""}`}
              onClick={() => setTab("routines")}
            >
              Rotinas
              {totalRoutineCnt > 0 && (
                <span className={`${styles.tabBadge} ${doneTodayCnt === totalRoutineCnt ? styles.tabBadgeDone : ""}`}>
                  {doneTodayCnt}/{totalRoutineCnt}
                </span>
              )}
            </button>
            <button
              className={`${styles.tab} ${tab === "modes" ? styles.tabActive : ""}`}
              onClick={() => setTab("modes")}
              style={{ position: "relative" }}
            >
              Modos
              {hasActiveSession && (
                <span
                  className={styles.activeSessionDot}
                  title="Sessão ativa"
                />
              )}
              {(() => { const n = storageGet<string[]>(SK.MODES_FAVORITE, []).length; return n > 0 ? <span className={styles.tabBadge}>{n}</span> : null; })()}
            </button>
            <button
              className={`${styles.tab} ${tab === "analytics" ? styles.tabActive : ""}`}
              onClick={() => setTab("analytics")}
            >
              📊 Análises
            </button>
          </nav>

          {/* Add button + Atualizar */}
          <div className={styles.addBtnWrap}>
            <button
              className={styles.reloadBtn}
              onClick={() => window.location.reload()}
              title="Recarregar a página"
            >
              <span>🔄</span>
              <span className={styles.reloadText}>Atualizar</span>
            </button>
            {tab === "tasks" && (
              <button
                className={`${styles.addBtn} ${showTaskForm ? styles.addBtnCancel : ""}`}
                onClick={() => setShowTaskForm((v) => !v)}
              >
                {showTaskForm ? "✕ Cancelar" : <><span>+</span> Nova tarefa</>}
              </button>
            )}
            {tab === "routines" && (
              <button
                className={`${styles.addBtn} ${showRoutineForm ? styles.addBtnCancel : styles.addBtnRoutine}`}
                onClick={() => setShowRoutineForm((v) => !v)}
              >
                {showRoutineForm ? "✕ Cancelar" : <><span>+</span> Nova rotina</>}
              </button>
            )}
          </div>
        </div>
      </header>

      <main className={styles.main}>
        {tab === "tasks" && (
          <>
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
                  <button
                    className={styles.searchClear}
                    onClick={() => setTaskSearch("")}
                    aria-label="Limpar busca"
                  >
                    ✕
                  </button>
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
                  aria-label={grouped ? "Desagrupar tarefas" : "Agrupar por prioridade"}
                >
                  ⊞
                </button>
              </div>
            </div>

            {/* Contador de tarefas filtradas */}
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
          </>
        )}

        {tab === "routines" && (
          <>
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
          </>
        )}

        {tab === "modes" && (
          <ModesPanel
            tasks={tasks}
            routines={routines}
            onCompleteTask={handleCompleteTask}
            onCompleteRoutine={handleCompleteRoutine}
            onAddTask={handleCreateTask}
            onAddChecklist={handleAddTaskChecklist}
            onToggleChecklist={handleToggleTaskChecklist}
            onAddRoutineChecklist={handleAddRoutineChecklist}
            onToggleRoutineChecklist={handleToggleRoutineChecklist}
          />
        )}

        {tab === "analytics" && (
          <Suspense fallback={<div className={styles.loading}>Carregando análises...</div>}>
            <DashboardPage />
          </Suspense>
        )}
      </main>

      {/* FAB mobile — Nova tarefa */}
      {tab === "tasks" && !showTaskForm && (
        <button
          className={styles.fab}
          onClick={() => { setShowTaskForm(true); window.scrollTo({ top: 0, behavior: "smooth" }); }}
          aria-label="Nova tarefa"
          title="Nova tarefa"
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

      {undoRoutine && (
        <UndoToast
          task={undoRoutine.task}
          expiresAt={undoRoutine.expiresAt}
          onUndo={handleUndoDeleteRoutine}
          onDismiss={handleDismissRoutine}
          label="Rotina"
        />
      )}

      {ConfirmUI}

      {showWeeklySummary && (
        <WeeklyReview onClose={() => setShowWeeklySummary(false)} />
      )}
    </div>
    </ToastProvider>
  );
}

function DailyWidget(): JSX.Element | null {
  const streak = getStreak();
  const level  = getDayLevel();
  if (streak < 1 && level <= 1) return null;
  return (
    <div style={{
      display: "flex",
      gap: 8,
      padding: "8px 16px",
      borderBottom: "1px solid var(--border)",
      background: "var(--surface)",
      flexWrap: "wrap",
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
  label?: string;
}

function UndoToast({ task, expiresAt, onUndo, onDismiss, label = "Tarefa" }: UndoToastProps): JSX.Element {
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
        <span className={styles.undoText}>
          🗑 <strong>{task.title}</strong> excluída{label !== "Tarefa" ? ` (${label})` : ""}
        </span>
        <div className={styles.undoActions}>
          <button className={styles.undoBtn} onClick={onUndo}>
            ↩ Desfazer
          </button>
          <button className={styles.undoDismiss} onClick={onDismiss}>
            ✕
          </button>
        </div>
      </div>
    </div>
  );
}
