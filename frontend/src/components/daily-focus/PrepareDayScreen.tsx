import { useMemo, useState } from "react";
import TodayPanel from "../TodayPanel";
import AddTaskForm from "../AddTaskForm";
import TaskDetailModal from "../TaskDetailModal";
import { useTasks } from "../../hooks/useTasks";
import { useProjects } from "../../hooks/useProjects";
import { useTaskDetail } from "../../hooks/useTaskDetail";
import { dailyTasksApi } from "../../api/dailyTasks";
import { tasksApi } from "../../api/tasks";
import { todayISO } from "../../lib/dateUtils";
import { formatMinutes } from "../../lib/estimatedTime";
import { DAILY_LIMIT } from "../TodayPanel";
import { useToast } from "../shared/Toast";
import styles from "./DailyFocus.module.css";

export interface DayPriority {
  id: string;
  title: string;
}

interface PrepareDayScreenProps {
  /** Nível atual do Daily Focus (nº de tarefas que entram nesta sessão). */
  level: number;
  /** Estado emocional escolhido no check-in (ajusta a sugestão de quantidade). */
  estadoId?: string | null;
  /** Avança para a seleção do Daily Focus com as prioridades escolhidas. */
  onContinue: (priorities: DayPriority[]) => void;
  /** Pula a etapa de preparação (vai direto para a seleção). */
  onSkip: () => void;
}

// Estados de baixa energia → sugerimos começar com menos tarefas.
const LOW_ENERGY = new Set(["travado", "cansado", "ansioso", "sobrecarregado", "procrastinando"]);
const HIGH_ENERGY = new Set(["energizado", "bem"]);

function getCapacityMinutes(): number {
  const raw = Number(localStorage.getItem("taskflow.overloadMinutes"));
  return Number.isFinite(raw) && raw > 0 ? raw : 480; // 8h padrão
}

/**
 * PrepareDayScreen — etapa de preparação e priorização do dia.
 *
 * Reutiliza a MESMA lista/dados de "Tarefas de Hoje" da página inicial
 * (tabela DailyTask via dailyTasksApi) através do componente TodayPanel.
 * Aqui o usuário pode: ver toda a lista, escolher as 5 prioridades, criar
 * uma nova tarefa, editar e adicionar checklist/subtarefas — tudo sem sair
 * do Daily Focus. As 5 prioridades servem de base para a seleção seguinte.
 */
export default function PrepareDayScreen({ level, estadoId, onContinue, onSkip }: PrepareDayScreenProps): JSX.Element {
  const projectsHook = useProjects(true);
  const {
    tasks,
    completedToday,
    completingIds,
    handleCreateTask,
    handleCompleteTask,
    handleReopenTask,
    handleUpdateTask,
    handleAddTaskChecklist,
    handleToggleTaskChecklist,
    handleUpdateTaskChecklist,
    handleDeleteTaskChecklist,
    removeTask,
  } = useTasks(undefined, "due_date_asc");

  const { detailTask, openDetail, closeDetail } = useTaskDetail(tasks as any);
  const { showToast } = useToast();

  const [showAddForm, setShowAddForm] = useState<boolean>(false);
  const [continuing, setContinuing] = useState<boolean>(false);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [reloadSignal, setReloadSignal] = useState<number>(0);
  const [suggesting, setSuggesting] = useState<boolean>(false);

  const byId = useMemo(
    () => new Map((tasks as any[]).map((t) => [String(t.id), t])),
    [tasks]
  );

  const selectedTasks = useMemo(
    () => selectedIds.map((id) => byId.get(String(id))).filter(Boolean) as any[],
    [selectedIds, byId]
  );

  // ── Estimativa de tempo x capacidade do dia ────────────────────────────────
  const estimatedTotal = useMemo(
    () => selectedTasks.reduce((sum, t) => sum + (t.estimated_minutes || 0), 0),
    [selectedTasks]
  );
  const capacity = getCapacityMinutes();
  const overloaded = estimatedTotal > capacity;

  // ── Tarefas grandes sem quebra (sugerir dividir em subtarefas) ──────────────
  const bigUnbroken = useMemo(
    () => selectedTasks.filter((t) => (t.estimated_minutes || 0) >= 60 && (t.checklist_count ?? 0) === 0),
    [selectedTasks]
  );

  // ── Sugestão de quantidade conforme o estado emocional ─────────────────────
  const suggestedCount = useMemo(() => {
    if (estadoId && LOW_ENERGY.has(estadoId)) return Math.min(3, DAILY_LIMIT);
    if (estadoId && HIGH_ENERGY.has(estadoId)) return DAILY_LIMIT;
    return Math.min(Math.max(level, 3), DAILY_LIMIT);
  }, [estadoId, level]);

  const handleCreate = async (data: unknown): Promise<void> => {
    await handleCreateTask(data as any);
    setShowAddForm(false);
  };

  // ── "✨ Sugerir minhas N" — preenche a partir de sinais que já existem ──────
  const handleSuggest = async (): Promise<void> => {
    setSuggesting(true);
    try {
      const today = todayISO();
      const selected = new Set(selectedIds.map(String));
      const candidates = (tasks as any[])
        .filter((t) => !t.completed && !t._isRoutine && !selected.has(String(t.id)))
        .sort((a, b) => {
          const rank = (t: any): number => {
            if (t.due_date && t.due_date < today) return 0;   // atrasada
            if (t.due_date === today) return 1;                // vence hoje
            return 2;                                          // demais
          };
          const ra = rank(a), rb = rank(b);
          if (ra !== rb) return ra - rb;
          const pa = a.priority ?? 4, pb = b.priority ?? 4;    // 1=crítica
          if (pa !== pb) return pa - pb;
          return (a.estimated_minutes || 0) - (b.estimated_minutes || 0);
        });

      const room = suggestedCount - selectedIds.length;
      if (room <= 0) {
        showToast(`Você já tem ${selectedIds.length} prioridades`, "info");
        return;
      }
      const toAdd = candidates.slice(0, room);
      if (toAdd.length === 0) {
        showToast("Sem tarefas para sugerir", "info");
        return;
      }
      for (const t of toAdd) {
        try { await dailyTasksApi.add(t.id); } catch { /* limite/erro: ignora */ }
      }
      setReloadSignal((n) => n + 1);
      showToast(`✨ ${toAdd.length} tarefa(s) sugerida(s)`, "success");
    } finally {
      setSuggesting(false);
    }
  };

  const handleContinue = async (): Promise<void> => {
    setContinuing(true);
    try {
      // Lê as prioridades atuais do dia (mesma fonte da home) já ordenadas.
      const ids = (await dailyTasksApi.load(todayISO()).catch(() => [])) as string[];
      const priorities: DayPriority[] = ids
        .map((id) => byId.get(String(id)))
        .filter(Boolean)
        .map((t) => ({ id: String(t.id), title: t.title as string }));
      onContinue(priorities);
    } finally {
      setContinuing(false);
    }
  };

  const count = selectedIds.length;
  const canAdd = count < DAILY_LIMIT;

  return (
    <div className={styles.prepare}>
      <div className={styles.prepareIntro}>
        <div className={styles.prepareTitle}>🌅 Prepare seu dia</div>
        <div className={styles.prepareSub}>Quais são as cinco tarefas mais importantes de hoje?</div>
        <div className={styles.prepareHint}>
          Escolha suas prioridades, organize e detalhe o que precisar — depois começamos a sessão.
        </div>
        <div className={styles.prepareAutodevTip}>
          🌱 Dica: reserve pelo menos uma das prioridades para autodesenvolvimento.
        </div>
        {estadoId && LOW_ENERGY.has(estadoId) && (
          <div className={styles.prepareEnergyHint}>
            💙 Dia mais pesado? Sem problema — comece com ~{suggestedCount} tarefas e vá com calma.
          </div>
        )}
        {estadoId && HIGH_ENERGY.has(estadoId) && (
          <div className={styles.prepareEnergyHint}>
            ⚡ Energia boa hoje! Aproveite para escolher até {DAILY_LIMIT} prioridades.
          </div>
        )}
      </div>

      {/* Ações rápidas: sugerir automaticamente + criar nova tarefa */}
      <div className={styles.prepareActions}>
        <button
          className={styles.prepareSuggestBtn}
          onClick={handleSuggest}
          disabled={suggesting || !canAdd}
          title="Preenche automaticamente com base em prazo e prioridade"
        >
          {suggesting ? "…" : `✨ Sugerir minhas ${suggestedCount}`}
        </button>
        <button
          className={styles.prepareNewTaskBtn}
          onClick={() => setShowAddForm((v) => !v)}
        >
          {showAddForm ? "✕ Cancelar" : "＋ Nova tarefa"}
        </button>
      </div>

      {showAddForm && (
        <div className={styles.prepareForm}>
          <AddTaskForm
            projects={projectsHook.projects}
            onSubmit={handleCreate}
            onCancel={() => setShowAddForm(false)}
            onCreateProject={projectsHook.createProject}
          />
        </div>
      )}

      {/* Reaproveita o painel "Tarefas de Hoje" (seleção das 5 prioridades). */}
      <TodayPanel
        tasks={tasks as any}
        completedToday={completedToday}
        onComplete={(id) => handleCompleteTask(String(id))}
        onReopen={(id) => handleReopenTask(String(id))}
        onToggleChecklist={(taskId, itemId) => handleToggleTaskChecklist(String(taskId), String(itemId))}
        onUpdate={handleUpdateTask as any}
        projects={projectsHook.projects}
        onOpenDetail={openDetail}
        forceExpanded
        onSelectionChange={setSelectedIds}
        reloadSignal={reloadSignal}
      />

      {/* ── Resumo do plano: capacidade, sessão x reserva, tarefas grandes ── */}
      {count > 0 && (
        <div className={styles.prepareSummary}>
          <div className={`${styles.prepareEstimate} ${overloaded ? styles.prepareEstimateOver : ""}`}>
            ⏱️ ~{formatMinutes(estimatedTotal)} planejados
            <span className={styles.prepareCapacity}> / capacidade ~{formatMinutes(capacity)}</span>
            {overloaded && <span className={styles.prepareOverTag}> ⚠ dia sobrecarregado</span>}
          </div>

          {count > level && (
            <div className={styles.prepareSessionSplit}>
              🎯 As <strong>{level}</strong> primeiras entram nesta sessão (nível {level}); as demais ficam de reserva.
            </div>
          )}

          <div className={styles.prepareReorderHint}>
            ↕ A ordem das prioridades define a ordem de execução na sessão.
          </div>

          {bigUnbroken.length > 0 && (
            <div className={styles.prepareBreakHint}>
              🧩 {bigUnbroken.length} tarefa(s) grande(s) sem subtarefas.
              <button
                className={styles.prepareBreakBtn}
                onClick={() => openDetail(bigUnbroken[0].id)}
              >
                Quebrar em partes
              </button>
            </div>
          )}
        </div>
      )}

      {/* Modal de detalhes: editar + checklist/subtarefas sem sair do fluxo. */}
      {detailTask && (
        <TaskDetailModal
          task={detailTask}
          onClose={closeDetail}
          onComplete={(id) => handleCompleteTask(String(id))}
          onReopen={(id) => handleReopenTask(String(id))}
          onDelete={(id) => { removeTask(id as any); void tasksApi.delete(id).catch(() => {}); closeDetail(); }}
          onUpdate={handleUpdateTask as any}
          onAddChecklist={handleAddTaskChecklist as any}
          onToggleChecklist={(taskId, itemId) => handleToggleTaskChecklist(String(taskId), String(itemId))}
          onUpdateChecklist={handleUpdateTaskChecklist as any}
          onDeleteChecklist={(taskId, itemId) => handleDeleteTaskChecklist(String(taskId), String(itemId))}
          completing={completingIds?.has(String(detailTask.id))}
          projects={projectsHook.projects}
          onCreateProject={projectsHook.createProject}
        />
      )}

      {/* Guard: sem prioridade escolhida */}
      {count === 0 && (
        <div className={styles.prepareEmpty}>
          Escolha ao menos 1 prioridade — ou <button className={styles.prepareInlineSkip} onClick={onSkip}>pule esta etapa</button>.
        </div>
      )}

      {/* Rodapé */}
      <div className={styles.prepareFooter}>
        <button className={styles.prepareSkipBtn} onClick={onSkip}>
          Pular
        </button>
        <button
          className={styles.prepareContinueBtn}
          onClick={handleContinue}
          disabled={continuing || count === 0}
        >
          {continuing ? "…" : "Continuar →"}
        </button>
      </div>
    </div>
  );
}
