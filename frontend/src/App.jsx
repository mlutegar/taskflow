import { useState, useEffect } from "react";
import { tasksApi } from "./api/tasks";
import { getStreak } from "./lib/dailyFocusHistory";
import { getDayLevel } from "./lib/dailyFocusDay";
import { useTasks } from "./hooks/useTasks";
import { useRoutines } from "./hooks/useRoutines";
import { useUndoDelete } from "./hooks/useUndoDelete";
import TaskList from "./components/TaskList";
import AddTaskForm from "./components/AddTaskForm";
import RoutineList from "./components/RoutineList";
import RoutineHeatmap from "./components/RoutineHeatmap";
import AddRoutineForm from "./components/AddRoutineForm";
import ModesPanel from "./components/ModesPanel";
import TodayPanel from "./components/TodayPanel";
import styles from "./App.module.css";

const TASK_FILTERS = [
  { label: "Todas", value: "" },
  { label: "Ativas", value: "active" },
  { label: "Concluídas", value: "completed" },
];

const TASK_SORTS = [
  { label: "Prioridade", value: "priority" },
  { label: "Vencimento (mais próximo)", value: "due_date_asc" },
  { label: "Vencimento (mais distante)", value: "due_date_desc" },
  { label: "Vencidas primeiro", value: "overdue" },
  { label: "Data criação", value: "created" },
];

const ROUTINE_FILTERS = [
  { label: "Todas", value: "" },
  { label: "Pendentes", value: "pending" },
  { label: "Feitas hoje", value: "done" },
];

export default function App() {
  const [tab, setTab] = useState("tasks");

  // UI state
  const [taskFilter, setTaskFilter] = useState("");
  const [taskSort, setTaskSort] = useState("due_date_asc");
  const [taskSearch, setTaskSearch] = useState("");
  const [showTaskForm, setShowTaskForm] = useState(false);
  const [routineFilter, setRoutineFilter] = useState("");
  const [showRoutineForm, setShowRoutineForm] = useState(false);
  const [routineView, setRoutineView] = useState("list");

  // Business logic hooks
  const tasksHook = useTasks(taskFilter, taskSort);
  const {
    tasks,
    setTasks,
    tasksLoading,
    tasksError,
    completedToday,
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

  const undoHook = useUndoDelete((id) => tasksApi.delete(id).catch(() => {}));
  const { undoTask, handleDismiss } = undoHook;

  // Wrappers that also manage UI state
  const handleCreateTask = async (data) => {
    await tasksHook.handleCreateTask(data);
    setShowTaskForm(false);
  };

  const handleCreateRoutine = async (data) => {
    await routinesHook.handleCreateRoutine(data);
    setShowRoutineForm(false);
  };

  const handleDeleteTask = (id) => {
    const task = tasks.find((t) => t.id === id);
    if (!task) return;
    setTasks((prev) => prev.filter((t) => t.id !== id));
    undoHook.handleDeleteTask(task);
  };

  const handleUndoDelete = () => {
    const task = undoHook.handleUndoDelete();
    if (task) {
      setTasks((prev) => [task, ...prev]);
    }
  };

  // Search filter
  const search = taskSearch.trim().toLowerCase();
  const visibleTasks = search
    ? tasks.filter((t) => {
        const inTitle = t.title?.toLowerCase().includes(search);
        const inDesc = t.description?.toLowerCase().includes(search);
        const inChecklist = t.checklist?.some((c) =>
          c.description?.toLowerCase().includes(search)
        );
        return inTitle || inDesc || inChecklist;
      })
    : tasks;

  // Stats
  const activeTaskCnt = tasks.filter((t) => !t.completed).length;
  const doneTodayCnt = routines.filter((r) => r.is_completed_today).length;
  const totalRoutineCnt = routines.length;

  return (
    <div className={styles.app}>
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
            >
              Modos
              <span className={styles.tabBadge}>9</span>
            </button>
          </nav>

          {/* Add button + Atualizar */}
          <div className={styles.addBtnWrap}>
            <button
              className={styles.reloadBtn}
              onClick={() => window.location.reload()}
              title="Recarregar a página"
            >
              🔄 Atualizar
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
                  onChange={(e) => setTaskSearch(e.target.value)}
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
                  onChange={(e) => setTaskSort(e.target.value)}
                >
                  {TASK_SORTS.map((s) => (
                    <option key={s.value} value={s.value}>{s.label}</option>
                  ))}
                </select>
              </div>
            </div>

            {tasksLoading && <div className={styles.loading}>Carregando...</div>}
            {tasksError && <div className={styles.error}>Erro: {tasksError}</div>}
            {!tasksLoading && !tasksError && (
              <TaskList
                tasks={visibleTasks}
                onComplete={handleCompleteTask}
                onReopen={handleReopenTask}
                onDelete={handleDeleteTask}
                onUpdate={handleUpdateTask}
                onAddChecklist={handleAddTaskChecklist}
                onToggleChecklist={handleToggleTaskChecklist}
                onUpdateChecklist={handleUpdateTaskChecklist}
                onDeleteChecklist={handleDeleteTaskChecklist}
              />
            )}
          </>
        )}

        {tab === "routines" && (
          <>
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
                onDelete={handleDeleteRoutine}
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
      </main>

      {undoTask && (
        <UndoToast
          task={undoTask.task}
          expiresAt={undoTask.expiresAt}
          onUndo={handleUndoDelete}
          onDismiss={handleDismiss}
        />
      )}
    </div>
  );
}

function DailyWidget() {
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

function UndoToast({ task, expiresAt, onUndo, onDismiss }) {
  const [pct, setPct] = useState(100);

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
          🗑 <strong>{task.title}</strong> excluída
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
