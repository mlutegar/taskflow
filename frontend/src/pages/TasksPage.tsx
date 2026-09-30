import { useState, useEffect, useRef, useCallback } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { tasksApi } from "../api/tasks";
import { dailyTasksApi } from "../api/dailyTasks";
import { getStreak } from "../lib/dailyFocusHistory";
import { getDayLevel } from "../lib/dailyFocusDay";
import { useTasks } from "../hooks/useTasks";
import { useUndoDelete } from "../hooks/useUndoDelete";
import { useConfirm } from "../components/ConfirmDialog";
import TaskList from "../components/TaskList";
import AddTaskForm from "../components/AddTaskForm";
import TodayPanel, { DAILY_LIMIT } from "../components/TodayPanel";
import { useToast } from "../components/shared/Toast";
import DailyRoutinePanel from "../components/DailyRoutinePanel";
import DueTodayPanel from "../components/DueTodayPanel";
import ErrorBoundary from "../components/ErrorBoundary";
import TaskDetailModal from "../components/TaskDetailModal";
import { useTaskDetail } from "../hooks/useTaskDetail";
import styles from "../App.module.css";
import { todayISO } from "../lib/dateUtils";
import { taskKeys } from "../lib/taskKeys";
import { useProjects } from "../hooks/useProjects";
import ProjectSelect from "../components/ProjectSelect";
import ProjectManager from "../components/ProjectManager";
import { TIME_BUCKETS, sumEstimated, formatMinutes } from "../lib/estimatedTime";
import {
  ListChecks, AlertCircle, Clock, RotateCw, Plus, X, Search,
  Settings2, LayoutGrid, AlertTriangle,
} from "lucide-react";

const TASK_FILTERS: { label: string; value: string }[] = [
  { label: "Hoje", value: "today" },
  { label: "Próximas", value: "upcoming" },
  { label: "Todas", value: "" },
  { label: "Ativas", value: "active" },
  { label: "Concluídas", value: "completed" },
];

const TASK_SORTS: { label: string; value: string }[] = [
  { label: "Prioridade", value: "priority" },
  { label: "Vencimento (mais próximo)", value: "due_date_asc" },
  { label: "Vencimento (mais distante)", value: "due_date_desc" },
  { label: "Vencidas primeiro", value: "overdue" },
  { label: "Tempo estimado", value: "estimated" },
  { label: "Data criação", value: "created" },
];

export default function TasksPage(): JSX.Element {
  const queryClient = useQueryClient();
  const { showToast } = useToast();
  // UI state — inicializados a partir da query string para persistência via URL
  const [taskFilter, setTaskFilter] = useState<string>(() => {
    const params = new URLSearchParams(window.location.search);
    return params.has("filter") ? (params.get("filter") || "") : (localStorage.getItem("taskflow.taskFilter") || "today");
  });
  const [taskSort, setTaskSort] = useState<string>(() =>
    new URLSearchParams(window.location.search).get("sort") ?? "due_date_asc"
  );
  const [taskSearch, setTaskSearch] = useState<string>(() =>
    new URLSearchParams(window.location.search).get("q") ?? ""
  );
  const [timeFilter, setTimeFilter] = useState<string>(() =>
    new URLSearchParams(window.location.search).get("time") ?? ""
  );
  const [grouped, setGrouped] = useState<boolean>(false);
  const [showTaskForm, setShowTaskForm] = useState<boolean>(false);
  const [projectFilter, setProjectFilter] = useState<string>(() =>
    new URLSearchParams(window.location.search).get("project") ?? localStorage.getItem("taskflow.projectFilter") ?? ""
  );
  const [showProjectManager, setShowProjectManager] = useState<boolean>(false);
  const projectsHook = useProjects(true);

  // Sincronizar filtros na URL
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (taskSearch)                              params.set("q",      taskSearch);
    else                                         params.delete("q");
    if (taskFilter)                              params.set("filter", taskFilter);
    else                                         params.delete("filter");
    if (taskSort && taskSort !== "due_date_asc") params.set("sort",   taskSort);
    else                                         params.delete("sort");
    if (projectFilter)                           params.set("project", projectFilter);
    else                                         params.delete("project");
    if (timeFilter)                              params.set("time", timeFilter);
    else                                         params.delete("time");
    const qs = params.toString();
    const newUrl = window.location.pathname + (qs ? `?${qs}` : "") + window.location.hash;
    window.history.replaceState(null, "", newUrl);
    localStorage.setItem("taskflow.taskFilter", taskFilter);
    localStorage.setItem("taskflow.projectFilter", projectFilter);
  }, [taskSearch, taskFilter, taskSort, projectFilter, timeFilter]);

  useEffect(() => {
    if (projectFilter && projectFilter !== "none" && !projectsHook.loading && !projectsHook.projects.some((project) => project.id === projectFilter && !project.archived)) {
      setProjectFilter("");
    }
  }, [projectFilter, projectsHook.loading, projectsHook.projects]);

  // Reabre ocorrências no instante em que o dia muda, mesmo com a tela aberta.
  useEffect(() => {
    let timer: ReturnType<typeof setTimeout>;
    let currentDay = todayISO();
    const refreshDay = () => {
      const nextDay = todayISO();
      if (nextDay !== currentDay) {
        currentDay = nextDay;
        queryClient.invalidateQueries({ queryKey: taskKeys.all });
      }
    };
    const schedule = () => {
      const now = new Date();
      const midnight = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1, 0, 0, 1);
      timer = setTimeout(() => { refreshDay(); schedule(); }, midnight.getTime() - now.getTime());
    };
    const onVisible = () => { if (document.visibilityState === "visible") refreshDay(); };
    document.addEventListener("visibilitychange", onVisible);
    schedule();
    return () => { clearTimeout(timer); document.removeEventListener("visibilitychange", onVisible); };
  }, [queryClient]);

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
  const tasksHook = useTasks(taskFilter, taskSort, projectFilter || undefined, timeFilter || undefined);
  const { data: allTasksForToday = [] } = useQuery<any[]>({
    queryKey: ["tasks", "today-panel-all"],
    queryFn: () => tasksApi.list({ sort: "due_date_asc" }),
    staleTime: 30_000,
  });
  const {
    tasks, tasksLoading, tasksError, refetchTasks, completedToday, completingIds,
    mutationError, clearMutationError, retryLastMutation, syncState,
    removeTask, restoreTask, handleCompleteTask, handleReopenTask,
    handleUndoCompleteTask,
    handleUpdateTask, handleAddTaskChecklist, handleToggleTaskChecklist,
    handleUpdateTaskChecklist, handleDeleteTaskChecklist,
  } = tasksHook;

  // Salvaguarda de UX: se o carregamento demorar demais (rede degradada, cold
  // start extremo), mostra aviso + botão de retry em vez de skeleton eterno.
  const [loadTimedOut, setLoadTimedOut] = useState(false);
  useEffect(() => {
    if (!tasksLoading) { setLoadTimedOut(false); return; }
    const t = setTimeout(() => setLoadTimedOut(true), 12_000);
    return () => clearTimeout(t);
  }, [tasksLoading]);

  const undoHook = useUndoDelete((id: unknown) => tasksApi.delete(id).catch(() => {}));
  const { undoTask, handleDismiss } = undoHook;
  const { confirm, ConfirmUI } = useConfirm();
  const [completionToast, setCompletionToast] = useState<null | {
    taskId: string; completionId: string; message: string; expiresAt: number;
  }>(null);

  const handleCompleteWithFeedback = useCallback(async (id: string): Promise<void> => {
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

  const handleCreateTask = async (data: unknown): Promise<void> => {
    await tasksHook.handleCreateTask(data);
    setShowTaskForm(false);
  };

  // Envia uma tarefa para o painel de foco "Tarefas de Hoje" (persistido no BD).
  const handleAddFocus = useCallback(async (id: string): Promise<void> => {
    try {
      await dailyTasksApi.add(id);
      queryClient.invalidateQueries({ queryKey: ["tasks", "today-panel-all"] });
      showToast("Adicionada ao foco de hoje", "success");
    } catch (err) {
      const status = (err as { status?: number })?.status;
      showToast(status === 409 ? `Limite diário de ${DAILY_LIMIT} tarefas atingido` : "Não foi possível adicionar ao foco", "error");
    }
  }, [queryClient, showToast]);

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

  // Modal central de detalhes/edição (compartilhado por todos os painéis + deep-link ?task=)
  const { detailTask, openDetail, closeDetail } = useTaskDetail(allTasksForToday as any);

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
      if (task && !task.completed) await handleCompleteWithFeedback(String(id));
    }
  }, [selectedIds, tasks, handleCompleteWithFeedback]);

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
  const overdueTaskCnt   = (allTasksForToday as any[]).filter((t: any) => !t.completed && t.due_date && t.due_date < todayISO()).length;
  const isFiltered       = !!(taskFilter || taskSearch.trim() || timeFilter);

  // Soma do tempo estimado das tarefas visíveis não concluídas + alerta de sobrecarga.
  const estimatedTotal   = sumEstimated(visibleTasks as any[]);
  const overloadLimit    = Number(localStorage.getItem("taskflow.overloadMinutes") || 480); // 8 h
  const isOverloaded     = taskFilter === "today" && estimatedTotal > overloadLimit;

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
            <ListChecks size={18} color="var(--accent)" />
            <span style={{ display: "inline-flex", alignItems: "center", gap: 6, fontSize: 15, fontWeight: 700, color: "var(--text)" }}>
              Tarefas
              {activeTaskCnt > 0 && (
                <span className={styles.tabBadge}>{activeTaskCnt}</span>
              )}
              {criticalTaskCnt > 0 && (
                <span className={styles.tabBadgeCritical} style={{ display: "inline-flex", alignItems: "center", gap: 3 }}>
                  <AlertCircle size={12} /> {criticalTaskCnt}
                </span>
              )}
              {overdueTaskCnt > 0 && (
                <span
                  className={styles.tabBadge}
                  style={{ display: "inline-flex", alignItems: "center", gap: 3, background: "var(--critical)", color: "#fff" }}
                  title="Tarefas atrasadas"
                >
                  <Clock size={12} /> {overdueTaskCnt}
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
              <RotateCw size={14} />
              <span className={styles.reloadText}>Atualizar</span>
            </button>
            <button
              className={`${styles.addBtn} ${showTaskForm ? styles.addBtnCancel : ""}`}
              onClick={() => setShowTaskForm((v) => !v)}
              style={{ display: "inline-flex", alignItems: "center", gap: 6 }}
            >
              {showTaskForm ? <><X size={15} /> Cancelar</> : <><Plus size={15} /> Nova tarefa</>}
            </button>
          </div>
        </div>
      </header>

      <main className={styles.main}>
        <DailyWidget />
        <ErrorBoundary compact label="painel Rotina Diária">
          <DailyRoutinePanel
            tasks={allTasksForToday}
            onComplete={handleCompleteWithFeedback}
            onReopen={handleReopenTask}
            onToggleChecklist={handleToggleTaskChecklist}
            completingIds={completingIds}
            onOpenDetail={openDetail}
          />
        </ErrorBoundary>
        <ErrorBoundary compact label="painel Hoje & Atrasadas">
          <DueTodayPanel
            tasks={allTasksForToday}
            onComplete={handleCompleteWithFeedback}
            onUpdate={handleUpdateTask}
            onAddFocus={handleAddFocus}
            onToggleChecklist={handleToggleTaskChecklist}
            completingIds={completingIds}
            onOpenDetail={openDetail}
          />
        </ErrorBoundary>
        <ErrorBoundary compact label="painel Tarefas de Hoje">
          <TodayPanel
            tasks={allTasksForToday}
            completedToday={completedToday}
            onComplete={handleCompleteWithFeedback}
            onReopen={handleReopenTask}
            onToggleChecklist={handleToggleTaskChecklist}
            onUpdate={handleUpdateTask}
            projects={projectsHook.projects}
            onOpenDetail={openDetail}
          />
        </ErrorBoundary>

        {detailTask && (
          <TaskDetailModal
            task={detailTask}
            onClose={closeDetail}
            onComplete={(id) => handleCompleteWithFeedback(String(id))}
            onReopen={(id) => handleReopenTask(String(id))}
            onDelete={handleDeleteTask}
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

        {showTaskForm && (
          <div className={styles.formWrapper}>
            <AddTaskForm projects={projectsHook.projects} onSubmit={handleCreateTask} onCancel={() => setShowTaskForm(false)} onCreateProject={projectsHook.createProject} />
          </div>
        )}

        <div className={styles.controls}>
          <div className={styles.searchWrapper}>
            <span className={styles.searchIcon}><Search size={15} /></span>
            <input
              type="text"
              className={styles.searchInput}
              placeholder="Pesquisar tarefas..."
              value={taskSearch}
              onChange={(e: React.ChangeEvent<HTMLInputElement>) => setTaskSearch(e.target.value)}
            />
            {taskSearch && (
              <button className={styles.searchClear} onClick={() => setTaskSearch("")} aria-label="Limpar busca"><X size={13} /></button>
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
          <div className={styles.projectControls}>
            <ProjectSelect
              projects={projectsHook.projects}
              value={projectFilter}
              onChange={(value) => setProjectFilter(value || "")}
              allowAll
              allowNoneFilter
              className={styles.projectSelect}
            />
            <button className={styles.projectManageBtn} onClick={() => setShowProjectManager(true)} title="Criar e organizar projetos" style={{ display: "inline-flex", alignItems: "center", gap: 6 }}><Settings2 size={14} /> Projetos</button>
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
            <span className={styles.sortLabel}>Tempo:</span>
            <select
              className={styles.sortSelect}
              value={timeFilter}
              onChange={(e: React.ChangeEvent<HTMLSelectElement>) => setTimeFilter(e.target.value)}
              aria-label="Filtrar por tempo estimado"
            >
              {TIME_BUCKETS.map((t) => (
                <option key={t.value} value={t.value}>{t.label}</option>
              ))}
            </select>
            <button
              className={`${styles.groupBtn} ${grouped ? styles.groupBtnActive : ""}`}
              onClick={() => setGrouped((v) => !v)}
              title={grouped ? "Desagrupar" : "Agrupar por prioridade"}
              style={{ display: "inline-flex", alignItems: "center", justifyContent: "center" }}
            >
              <LayoutGrid size={15} />
            </button>
          </div>
        </div>

        {isFiltered && !tasksLoading && (
          <div className={styles.filterCount}>
            Exibindo <strong>{visibleTasks.length}</strong> de {tasks.length} tarefa{tasks.length !== 1 ? "s" : ""}
            {estimatedTotal > 0 && <span> · ~{formatMinutes(estimatedTotal)} estimados</span>}
            {visibleTasks.length === 0 && <span> — tente outro filtro</span>}
          </div>
        )}

        {isOverloaded && !tasksLoading && (
          <div className={styles.overloadAlert} role="status" style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <AlertTriangle size={14} style={{ flexShrink: 0 }} /> Dia sobrecarregado: ~{formatMinutes(estimatedTotal)} estimados (limite {formatMinutes(overloadLimit)}).
            Considere adiar ou delegar algumas tarefas.
          </div>
        )}

        {tasksLoading && !loadTimedOut && <div className={styles.loading}>Carregando...</div>}
        {tasksLoading && loadTimedOut && (
          <div className={styles.error} role="status">
            Está demorando mais que o normal…
            <button type="button" style={{ marginLeft: 8 }} onClick={() => refetchTasks()}>
              Tentar novamente
            </button>
          </div>
        )}
        {tasksError && (
          <div className={styles.error} role="alert">
            Erro: {tasksError}
            <button type="button" style={{ marginLeft: 8 }} onClick={() => refetchTasks()}>
              Tentar novamente
            </button>
          </div>
        )}
        {!tasksError && (
          <TaskList
            tasks={visibleTasks}
            loading={tasksLoading}
            grouped={grouped}
            onComplete={handleCompleteWithFeedback}
            onReopen={handleReopenTask}
            onDelete={handleDeleteTask}
            onUpdate={handleUpdateTask}
            onAddChecklist={handleAddTaskChecklist}
            onToggleChecklist={handleToggleTaskChecklist}
            onUpdateChecklist={handleUpdateTaskChecklist}
            onDeleteChecklist={handleDeleteTaskChecklist}
            completingIds={completingIds}
            projects={projectsHook.projects}
            onCreateProject={projectsHook.createProject}
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

      {completionToast && (
        <CompletionToast
          message={completionToast.message}
          expiresAt={completionToast.expiresAt}
          onUndo={handleUndoCompletion}
          onDismiss={() => setCompletionToast(null)}
        />
      )}

      {showProjectManager && (
        <ProjectManager
          projects={projectsHook.projects}
          onCreate={projectsHook.createProject}
          onUpdate={projectsHook.updateProject}
          onDelete={projectsHook.deleteProject}
          onClose={() => setShowProjectManager(false)}
        />
      )}

      {(syncState === "saving" || syncState === "saved" || syncState === "offline") && (
        <div className={styles.syncIndicator} role="status" aria-live="polite">
          {syncState === "saving" ? "Salvando…" : syncState === "saved" ? "✓ Salvo" : "Sem conexão"}
        </div>
      )}

      {mutationError && (
        <div className={styles.mutationError} role="alert">
          <span>{mutationError}</span>
          <button type="button" onClick={() => retryLastMutation().catch(() => {})}>Tentar novamente</button>
          <button type="button" onClick={clearMutationError} aria-label="Fechar">×</button>
        </div>
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
