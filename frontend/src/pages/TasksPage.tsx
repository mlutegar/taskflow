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
import RoutineConsistencyCard from "../components/routine-heatmap/RoutineConsistencyCard";
import MobileHeader from "../components/tasks-mobile/MobileHeader";
import TodayProgressCard from "../components/tasks-mobile/TodayProgressCard";
import { useIsMobile } from "../hooks/useIsMobile";
import { isDailyToday } from "../lib/dailyRoutine";
import DueTodayPanel from "../components/DueTodayPanel";
import ErrorBoundary from "../components/ErrorBoundary";
import TaskDetailModal from "../components/TaskDetailModal";
import { useTaskDetail } from "../hooks/useTaskDetail";
import styles from "../App.module.css";
import { todayISO } from "../lib/dateUtils";
import { taskKeys } from "../lib/taskKeys";
import type { TaskCreateInput } from "../types/tasks";
import { useProjects } from "../hooks/useProjects";
import ProjectSelect from "../components/ProjectSelect";
import ProjectManager from "../components/ProjectManager";
import { TIME_BUCKETS, sumEstimated, formatMinutes } from "../lib/estimatedTime";
import {
  ListChecks, AlertCircle, Clock, RotateCw, Plus, X, Search,
  Settings2, LayoutGrid, AlertTriangle, Filter, ArrowUpDown, Calendar,
} from "lucide-react";
import { exportYearlyTasksToCalendar } from "../lib/exportIcal";
import { FilterSheet } from "../components/FilterSheet";
import { FilterChips } from "../components/FilterChips";
import { SegmentedControl } from "../components/SegmentedControl";
import { useTaskFilters } from "../hooks/useTaskFilters";
import { TaskDetailPage } from "./TaskDetailPage";

const TASK_FILTERS: { label: string; value: string }[] = [
  { label: "Hoje", value: "today" },
  { label: "Próximas", value: "upcoming" },
  { label: "Todas", value: "" },
  { label: "Ativas", value: "active" },
  { label: "Concluídas", value: "completed" },
  { label: "📅 Anuais", value: "yearly" },
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
  const isMobile = useIsMobile();
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

  // Novo sistema de filtros
  const { filters, setFilters, activeCount, clearAll, removeFilter, toAPIParams } = useTaskFilters();
  const [isFilterSheetOpen, setIsFilterSheetOpen] = useState(false);

  // Hash routing para TaskDetailPage
  const [taskDetailId, setTaskDetailId] = useState<string | null>(() => {
    const hash = window.location.hash;
    if (hash.startsWith("#task-")) {
      return hash.substring(6); // Remove "#task-"
    }
    return null;
  });

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

  // Hash routing listener
  useEffect(() => {
    const handleHashChange = () => {
      const hash = window.location.hash;
      if (hash.startsWith("#task-")) {
        setTaskDetailId(hash.substring(6));
      } else {
        setTaskDetailId(null);
      }
    };
    window.addEventListener("hashchange", handleHashChange);
    return () => window.removeEventListener("hashchange", handleHashChange);
  }, []);

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
  const apiParams = toAPIParams();
  const tasksHook = useTasks(
    taskFilter,
    taskSort,
    projectFilter || apiParams.projectId || undefined,
    apiParams.time || undefined,
    apiParams.assignedTo || undefined,
    apiParams.priorities || undefined,
    apiParams.dueFilter || undefined
  );
  const { data: allTasksForToday = [] } = useQuery<any[]>({
    queryKey: taskKeys.todayPanelAll(),
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

  /**
   * Cria uma rotina pelo botão "Nova rotina" do painel Rotina Diária. É uma
   * tarefa normal com recorrência — só o ponto de entrada é dedicado. As
   * subtarefas vêm "staged" do formulário e são anexadas após o POST.
   */
  const handleCreateRoutine = useCallback(async (data: TaskCreateInput & { checklist?: string[] }): Promise<void> => {
    const { checklist = [], ...rest } = data;
    const created = await tasksHook.handleCreateTask(rest as TaskCreateInput) as { id?: string } | undefined;
    const taskId = created?.id;
    if (!taskId) return; // offline: create enfileirado sem id, sem como anexar subtarefas
    for (const item of checklist) {
      const description = item.trim();
      if (description) {
        try { await tasksHook.handleAddTaskChecklist(taskId, description); } catch { /* segue com as demais */ }
      }
    }
  }, [tasksHook]);

  // Envia uma tarefa para o painel de foco "Tarefas de Hoje" (persistido no BD).
  const handleAddFocus = useCallback(async (id: string): Promise<void> => {
    try {
      await dailyTasksApi.add(id);
      queryClient.invalidateQueries({ queryKey: taskKeys.todayPanelAll() });
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

  // Progresso das rotinas do dia — mesma fonte e mesmo critério do painel
  // "Rotina Diária", para o card de progresso nunca divergir dele.
  const routinesToday    = (allTasksForToday as any[]).filter((t: any) => isDailyToday(t.recurrence));
  const routineTotal     = routinesToday.length;
  const routineDone      = routinesToday.filter((t: any) => t.completed).length;

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

      {isMobile ? (
        <MobileHeader formOpen={showTaskForm} onToggleForm={() => setShowTaskForm((v) => !v)} />
      ) : (
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
      )}

      <main className={styles.main}>
        {isMobile && <TodayProgressCard done={routineDone} total={routineTotal} />}
        <DailyWidget />
        <ErrorBoundary compact label="card Consistência das Rotinas">
          <RoutineConsistencyCard />
        </ErrorBoundary>
        <ErrorBoundary compact label="painel Rotina Diária">
          <DailyRoutinePanel
            tasks={allTasksForToday}
            onComplete={handleCompleteWithFeedback}
            onReopen={handleReopenTask}
            onToggleChecklist={handleToggleTaskChecklist}
            completingIds={completingIds}
            onOpenDetail={openDetail}
            onCreateRoutine={handleCreateRoutine}
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

        {/* Nova barra de filtros - 3 linhas */}
        <div className={styles.filtersContainer}>
          {/* Linha 1: Busca */}
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

          {/* Linha 2: Abas segmented control + chip "Minhas" */}
          <div className={styles.tabsRow}>
            <SegmentedControl
              options={[
                { label: `Hoje (${tasks.filter((t: any) => !t.completed && (!t.due_date || t.due_date <= todayISO())).length})`, value: "today" },
                { label: `Próximas (${tasks.filter((t: any) => !t.completed && t.due_date && t.due_date > todayISO()).length})`, value: "upcoming" },
                { label: "Todas", value: "" },
                { label: `Ativas (${tasks.filter((t: any) => !t.completed).length})`, value: "active" },
                { label: `Concluídas (${tasks.filter((t: any) => t.completed).length})`, value: "completed" },
              ]}
              value={taskFilter}
              onChange={setTaskFilter}
            />
            <button
              className={`${styles.chipToggle} ${filters.assignedTo === "me" ? styles.chipToggleActive : ""}`}
              onClick={() =>
                setFilters({ ...filters, assignedTo: filters.assignedTo === "me" ? null : "me" })
              }
              type="button"
            >
              Minhas {filters.assignedTo === "me" && "×"}
            </button>
          </div>

          {/* Linha 3: Filtros + Ordenar + View */}
          <div className={styles.controlsRow}>
            <button
              className={styles.filterBtn}
              onClick={() => setIsFilterSheetOpen(true)}
              type="button"
            >
              <Filter size={16} />
              Filtros
              {activeCount > 0 && <span className={styles.badge}>{activeCount}</span>}
            </button>

            <button className={styles.sortBtn} onClick={() => {/* TODO: Menu de ordenação */}} type="button">
              <ArrowUpDown size={16} />
              Ordenar: {TASK_SORTS.find((s) => s.value === taskSort)?.label || "Prioridade"}
            </button>

            <div className={styles.viewToggle}>
              <button
                className={`${styles.viewBtn} ${!grouped ? styles.viewBtnActive : ""}`}
                onClick={() => setGrouped(false)}
                type="button"
                title="Lista"
              >
                Lista
              </button>
              <button
                className={`${styles.viewBtn} ${grouped ? styles.viewBtnActive : ""}`}
                onClick={() => setGrouped(true)}
                type="button"
                title="Grade"
              >
                <LayoutGrid size={15} />
              </button>
            </div>
          </div>

          {/* Chips de filtros ativos */}
          <FilterChips filters={filters} onRemove={removeFilter} onClearAll={clearAll} />
        </div>

        {/* FilterSheet (bottom sheet mobile / sidebar desktop) */}
        <FilterSheet
          isOpen={isFilterSheetOpen}
          onClose={() => setIsFilterSheetOpen(false)}
          filters={filters}
          onApply={(newFilters) => {
            setFilters(newFilters);
            setIsFilterSheetOpen(false);
          }}
          taskCount={visibleTasks.length}
        />

        {isFiltered && !tasksLoading && (
          <div className={styles.filterCount} style={{ display: "flex", alignItems: "center", gap: 12, justifyContent: "space-between" }}>
            <span>
              Exibindo <strong>{visibleTasks.length}</strong> de {tasks.length} tarefa{tasks.length !== 1 ? "s" : ""}
              {estimatedTotal > 0 && <span> · ~{formatMinutes(estimatedTotal)} estimados</span>}
              {visibleTasks.length === 0 && <span> — tente outro filtro</span>}
            </span>
            {taskFilter === "yearly" && visibleTasks.length > 0 && (
              <button
                onClick={() => {
                  exportYearlyTasksToCalendar().then(() => {
                    showToast("📅 Tarefas anuais exportadas com sucesso!");
                  }).catch(() => {
                    showToast("❌ Erro ao exportar tarefas anuais");
                  });
                }}
                style={{ display: "flex", alignItems: "center", gap: 6, padding: "6px 12px", background: "var(--accent)", color: "#fff", border: "none", borderRadius: 6, cursor: "pointer", fontSize: 13, fontWeight: 500 }}
              >
                <Calendar size={14} /> Exportar para calendário (.ics)
              </button>
            )}
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

      {/* FAB: no mobile quem cria tarefa é o "+" do cabeçalho, que não cobre o
          conteúdo. No desktop o .fab já é display:none — fica só por segurança. */}
      {!isMobile && !showTaskForm && (
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

      {/* TaskDetailPage via hash routing */}
      {taskDetailId && (
        <TaskDetailPage
          taskId={taskDetailId}
          onClose={() => {
            window.location.hash = "";
            setTaskDetailId(null);
          }}
        />
      )}
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
