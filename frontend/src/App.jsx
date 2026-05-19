import { useState, useEffect, useCallback } from "react";
import { tasksApi } from "./api/tasks";
import { routinesApi } from "./api/routines";
import TaskList from "./components/TaskList";
import AddTaskForm from "./components/AddTaskForm";
import RoutineList from "./components/RoutineList";
import RoutineHeatmap from "./components/RoutineHeatmap";
import AddRoutineForm from "./components/AddRoutineForm";
import ModesPanel from "./components/ModesPanel";
import styles from "./App.module.css";

const TASK_FILTERS = [
  { label: "Todas", value: "" },
  { label: "Ativas", value: "active" },
  { label: "Concluídas", value: "completed" },
];

const TASK_SORTS = [
  { label: "Prioridade", value: "priority" },
  { label: "Data criação", value: "created" },
  { label: "Vencimento", value: "due_date" },
];

const ROUTINE_FILTERS = [
  { label: "Todas", value: "" },
  { label: "Pendentes", value: "pending" },
  { label: "Feitas hoje", value: "done" },
];

export default function App() {
  const [tab, setTab] = useState("tasks");

  // Tasks state
  const [tasks, setTasks] = useState([]);
  const [taskFilter, setTaskFilter] = useState("");
  const [taskSort, setTaskSort] = useState("priority");
  const [showTaskForm, setShowTaskForm] = useState(false);
  const [tasksLoading, setTasksLoading] = useState(true);
  const [tasksError, setTasksError] = useState(null);

  // Routines state
  const [routines, setRoutines] = useState([]);
  const [routineFilter, setRoutineFilter] = useState("");
  const [showRoutineForm, setShowRoutineForm] = useState(false);
  const [routinesLoading, setRoutinesLoading] = useState(true);
  const [routinesError, setRoutinesError] = useState(null);
  const [routineView, setRoutineView] = useState("list");

  // --- Tasks ---
  const fetchTasks = useCallback(async () => {
    try {
      setTasksError(null);
      const params = {};
      if (taskFilter) params.status = taskFilter;
      if (taskSort) params.sort = taskSort;
      setTasks(await tasksApi.list(params));
    } catch (e) {
      setTasksError(e.message);
    } finally {
      setTasksLoading(false);
    }
  }, [taskFilter, taskSort]);

  useEffect(() => { fetchTasks(); }, [fetchTasks]);

  const handleCreateTask = async (data) => {
    const task = await tasksApi.create(data);
    setTasks((prev) => [task, ...prev]);
    setShowTaskForm(false);
  };

  const handleCompleteTask = async (id) => {
    const task = await tasksApi.complete(id);
    setTasks((prev) => prev.map((t) => (t.id === id ? task : t)));
  };

  const handleReopenTask = async (id) => {
    const task = await tasksApi.reopen(id);
    setTasks((prev) => prev.map((t) => (t.id === id ? task : t)));
  };

  const handleDeleteTask = async (id) => {
    await tasksApi.delete(id);
    setTasks((prev) => prev.filter((t) => t.id !== id));
  };

  const handleUpdateTask = async (id, data) => {
    const task = await tasksApi.update(id, data);
    setTasks((prev) => prev.map((t) => (t.id === id ? task : t)));
  };

  const handleAddTaskChecklist = async (taskId, description) => {
    const item = await tasksApi.addChecklistItem(taskId, description);
    setTasks((prev) => prev.map((t) =>
      t.id === taskId ? { ...t, checklist: [...t.checklist, item], checklist_count: t.checklist_count + 1 } : t
    ));
  };

  const handleToggleTaskChecklist = async (taskId, itemId) => {
    const item = await tasksApi.toggleChecklistItem(taskId, itemId);
    setTasks((prev) => prev.map((t) => {
      if (t.id !== taskId) return t;
      const newChecklist = t.checklist.map((c) => (c.id === itemId ? item : c));
      return { ...t, checklist: newChecklist, checklist_completed_count: newChecklist.filter((c) => c.completed).length };
    }));
  };

  const handleDeleteTaskChecklist = async (taskId, itemId) => {
    await tasksApi.deleteChecklistItem(taskId, itemId);
    setTasks((prev) => prev.map((t) => {
      if (t.id !== taskId) return t;
      const newChecklist = t.checklist.filter((c) => c.id !== itemId);
      return { ...t, checklist: newChecklist, checklist_count: newChecklist.length };
    }));
  };

  // --- Routines ---
  const fetchRoutines = useCallback(async () => {
    try {
      setRoutinesError(null);
      const params = {};
      if (routineFilter) params.status = routineFilter;
      setRoutines(await routinesApi.list(params));
    } catch (e) {
      setRoutinesError(e.message);
    } finally {
      setRoutinesLoading(false);
    }
  }, [routineFilter]);

  useEffect(() => { fetchRoutines(); }, [fetchRoutines]);

  const handleCreateRoutine = async (data) => {
    const routine = await routinesApi.create(data);
    setRoutines((prev) => [...prev, routine]);
    setShowRoutineForm(false);
  };

  const handleCompleteRoutine = async (id) => {
    const routine = await routinesApi.complete(id);
    setRoutines((prev) => prev.map((r) => (r.id === id ? routine : r)));
  };

  const handleUncompleteRoutine = async (id) => {
    const routine = await routinesApi.uncomplete(id);
    setRoutines((prev) => prev.map((r) => (r.id === id ? routine : r)));
  };

  const handleDeleteRoutine = async (id) => {
    await routinesApi.delete(id);
    setRoutines((prev) => prev.filter((r) => r.id !== id));
  };

  const handleUpdateRoutine = async (id, data) => {
    const routine = await routinesApi.update(id, data);
    setRoutines((prev) => prev.map((r) => (r.id === id ? routine : r)));
  };

  const handleCompleteRoutineForDate = async (id, dateStr) => {
    const routine = await routinesApi.completeForDate(id, dateStr);
    setRoutines((prev) => prev.map((r) => (r.id === id ? routine : r)));
  };

  const handleAddProgress = async (id, amount) => {
    const routine = await routinesApi.addProgress(id, amount);
    setRoutines((prev) => prev.map((r) => (r.id === id ? routine : r)));
  };

  const handleAddRoutineChecklist = async (routineId, description) => {
    const item = await routinesApi.addChecklistItem(routineId, description);
    setRoutines((prev) => prev.map((r) =>
      r.id === routineId ? { ...r, checklist: [...r.checklist, item], checklist_count: r.checklist_count + 1 } : r
    ));
  };

  const handleToggleRoutineChecklist = async (routineId, itemId) => {
    const item = await routinesApi.toggleChecklistItem(routineId, itemId);
    setRoutines((prev) => prev.map((r) => {
      if (r.id !== routineId) return r;
      const newChecklist = r.checklist.map((c) => (c.id === itemId ? item : c));
      return { ...r, checklist: newChecklist, checklist_completed_count: newChecklist.filter((c) => c.completed).length };
    }));
    // Re-fetch to update is_completed_today if auto-completed
    fetchRoutines();
  };

  const handleDeleteRoutineChecklist = async (routineId, itemId) => {
    await routinesApi.deleteChecklistItem(routineId, itemId);
    setRoutines((prev) => prev.map((r) => {
      if (r.id !== routineId) return r;
      const newChecklist = r.checklist.filter((c) => c.id !== itemId);
      return { ...r, checklist: newChecklist, checklist_count: newChecklist.length };
    }));
  };

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
              <span className={styles.tabBadge}>7</span>
            </button>
          </nav>

          {/* Add button */}
          <div className={styles.addBtnWrap}>
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
            {showTaskForm && (
              <div className={styles.formWrapper}>
                <AddTaskForm onSubmit={handleCreateTask} onCancel={() => setShowTaskForm(false)} />
              </div>
            )}

            <div className={styles.controls}>
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
                tasks={tasks}
                onComplete={handleCompleteTask}
                onReopen={handleReopenTask}
                onDelete={handleDeleteTask}
                onUpdate={handleUpdateTask}
                onAddChecklist={handleAddTaskChecklist}
                onToggleChecklist={handleToggleTaskChecklist}
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
          <ModesPanel tasks={tasks} onCompleteTask={handleCompleteTask} />
        )}
      </main>
    </div>
  );
}
