import { useState, useEffect, useMemo, useCallback, FormEvent, ChangeEvent } from "react";
import TaskSelector from "./TaskSelector";
import { dailyTasksApi } from "../api/dailyTasks";
import { useToast } from "./shared/Toast";
import styles from "./TodayPanel.module.css";
import RecurrenceFields, { RecurrenceRule } from "./RecurrenceFields";
import { todayISO } from "../lib/dateUtils";
import { Project } from "../api/projects";
import ProjectSelect from "./ProjectSelect";
import { useIsMobile } from "../hooks/useIsMobile";
import { ChevronRight } from "lucide-react";

/* Vibração tátil curta (ignorada se browser não suportar) */
function haptic(ms: number = 10): void {
  try { if (navigator.vibrate) navigator.vibrate(ms); } catch { /* noop */ }
}

export const DAILY_LIMIT = 5;

function todayKey(): string {
  return `todayTasks_${todayISO()}`;
}

function loadCachedIds(): string[] {
  try {
    const raw = localStorage.getItem(todayKey());
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function saveCachedIds(ids: string[]): void {
  try {
    localStorage.setItem(todayKey(), JSON.stringify(ids));
  } catch {
    // ignora erros de storage
  }
}

/* ─── Cores de prioridade ─────────────────────────────────────────────────── */
const PRIORITY_COLORS: Record<number, string> = { 1: "var(--critical)", 2: "var(--high)", 3: "var(--medium)", 4: "var(--low)" };

interface ChecklistItem {
  id: string;
  parent_id?: string | null;
  description: string;
  completed: boolean;
}

interface TodayTask {
  id: string;
  title: string;
  description?: string | null;
  priority: number;
  due_date?: string | null;
  recurrence?: string | null;
  recurrence_rule?: RecurrenceRule | null;
  project_id?: string | null;
  completed: boolean;
  checklist?: ChecklistItem[];
  _isRoutine?: boolean;
}

/* ─── Subtarefa recursiva ────────────────────────────────────────────────── */
interface SubtaskItemProps {
  item: ChecklistItem;
  taskId: string;
  allItems: ChecklistItem[];
  onToggle: (taskId: string, itemId: string) => void;
  depth?: number;
}

function SubtaskItem({ item, taskId, allItems, onToggle, depth = 0 }: SubtaskItemProps) {
  const [expanded, setExpanded] = useState<boolean>(false);

  const children = allItems.filter((c) => c.parent_id === item.id);
  const hasChildren = children.length > 0;
  const childDone = children.filter((c) => c.completed).length;

  return (
    <div className={styles.subtaskBlock} style={{ "--depth": depth } as React.CSSProperties}>
      <div className={styles.subtaskItem}>
        {/* Indentação visual por linha conectora */}
        {depth > 0 && <span className={styles.subtaskIndent} />}

        {/* Checkbox */}
        <button
          className={styles.subtaskCheck}
          style={{
            borderColor: item.completed ? "var(--success)" : "var(--border)",
            background: item.completed ? "var(--success)" : "transparent",
            color: item.completed ? "#fff" : "transparent",
          }}
          onClick={() => onToggle(taskId, item.id)}
          title={item.completed ? "Desmarcar" : "Marcar como feita"}
        >
          ✓
        </button>

        {/* Label + contagem de filhos */}
        <span className={`${styles.subtaskLabel} ${item.completed ? styles.subtaskDone : ""}`}>
          {item.description}
        </span>
        {hasChildren && (
          <span className={styles.subtaskChildCount}>
            {childDone}/{children.length}
          </span>
        )}

        {/* Expandir filhos */}
        {hasChildren && (
          <button
            className={`${styles.subtaskExpandBtn} ${expanded ? styles.subtaskExpandBtnOpen : ""}`}
            onClick={() => setExpanded((v) => !v)}
            title={expanded ? "Fechar" : "Ver subtarefas"}
            aria-label={expanded ? "Fechar subtarefas" : "Ver subtarefas"}
          >
            ›
          </button>
        )}
      </div>

      {/* Filhos recursivos */}
      {expanded && hasChildren && (
        <div className={styles.subtaskChildren}>
          {children.map((child) => (
            <SubtaskItem
              key={child.id}
              item={child}
              taskId={taskId}
              allItems={allItems}
              onToggle={onToggle}
              depth={depth + 1}
            />
          ))}
        </div>
      )}
    </div>
  );
}

/* ─── Formulário de edição inline ───────────────────────────────────────── */
interface EditFormData {
  title: string;
  description: string;
  priority: number | string;
  due_date: string;
  recurrence: string;
  recurrence_rule: RecurrenceRule | null;
  project_id: string | null;
}

interface EditFormProps {
  task: TodayTask;
  onSave: (id: string, payload: {
    title: string;
    description: string | null;
    priority: number;
    due_date: string | null;
    recurrence: string | null;
    recurrence_rule: RecurrenceRule | null;
    project_id: string | null;
  }) => Promise<void>;
  onCancel: () => void;
  projects: Project[];
}

function EditForm({ task, onSave, onCancel, projects }: EditFormProps) {
  const [data, setData] = useState<EditFormData>({
    title: task.title,
    description: task.description || "",
    priority: task.priority,
    due_date: task.due_date || "",
    recurrence: task.recurrence || "",
    recurrence_rule: task.recurrence_rule || null,
    project_id: task.project_id || null,
  });
  const [saving, setSaving] = useState<boolean>(false);

  const handleSubmit = async (e: FormEvent<HTMLFormElement>): Promise<void> => {
    e.preventDefault();
    if (!data.title.trim()) return;
    setSaving(true);
    try {
      await onSave(task.id, {
        title: data.title.trim(),
        description: data.description.trim() || null,
        priority: Number(data.priority),
        due_date: data.due_date || null,
        recurrence: data.recurrence || null,
        recurrence_rule: data.recurrence_rule,
        project_id: data.project_id,
      });
    } finally {
      setSaving(false);
    }
  };

  return (
    <form className={styles.editForm} onSubmit={handleSubmit}>
      <input
        className={styles.editInput}
        value={data.title}
        onChange={(e: ChangeEvent<HTMLInputElement>) => setData((d) => ({ ...d, title: e.target.value }))}
        placeholder="Título"
        autoFocus
      />
      <textarea
        className={styles.editTextarea}
        value={data.description}
        onChange={(e: ChangeEvent<HTMLTextAreaElement>) => setData((d) => ({ ...d, description: e.target.value }))}
        placeholder="Descrição (opcional)"
        rows={2}
      />
      <div className={styles.editRow}>
        <select
          className={styles.editSelect}
          value={data.priority}
          onChange={(e: ChangeEvent<HTMLSelectElement>) => setData((d) => ({ ...d, priority: e.target.value }))}
        >
          <option value={1}>🔴 Crítica</option>
          <option value={2}>🟠 Alta</option>
          <option value={3}>🟡 Média</option>
          <option value={4}>🟢 Baixa</option>
        </select>
        <input
          type="date"
          className={styles.editInput}
          value={data.due_date}
          onChange={(e: ChangeEvent<HTMLInputElement>) => setData((d) => ({ ...d, due_date: e.target.value }))}
        />
      </div>
      <RecurrenceFields
        recurrence={data.recurrence}
        rule={data.recurrence_rule}
        compact
        onChange={(recurrence, recurrence_rule) => setData((d) => ({ ...d, recurrence, recurrence_rule }))}
      />
      <ProjectSelect
        projects={projects}
        value={data.project_id}
        onChange={(project_id) => setData((d) => ({ ...d, project_id }))}
        className={styles.editSelect}
      />
      <div className={styles.editActions}>
        <button type="submit" className={styles.btnSave} disabled={saving || !data.title.trim()}>
          {saving ? "Salvando…" : "Salvar"}
        </button>
        <button type="button" className={styles.btnCancel} onClick={onCancel}>
          Cancelar
        </button>
      </div>
    </form>
  );
}

/* ─── Item de tarefa ─────────────────────────────────────────────────────── */
interface TodayTaskItemProps {
  task: TodayTask;
  onComplete: (id: string) => void;
  onReopen: (id: string) => void;
  onRemove: (id: string) => void;
  onToggleChecklist: (taskId: string, itemId: string) => void;
  onUpdate: (id: string, payload: unknown) => Promise<unknown>;
  projects: Project[];
  onOpenDetail?: (id: number | string) => void;
  index?: number;
  isDragging?: boolean;
  onDragStart?: (index: number) => void;
  onDragEnd?: () => void;
  onDropAt?: (index: number) => void;
}

function TodayTaskItem({ task, onComplete, onReopen, onRemove, onToggleChecklist, onUpdate, projects, onOpenDetail, index, isDragging, onDragStart, onDragEnd, onDropAt }: TodayTaskItemProps) {
  const isMobile = useIsMobile();
  const [expanded, setExpanded] = useState<boolean>(false);
  const [editing, setEditing] = useState<boolean>(false);
  const dotColor = PRIORITY_COLORS[task.priority] || "var(--text-muted)";
  const done = task.completed;

  const allItems = useMemo<ChecklistItem[]>(() => task.checklist || [], [task.checklist]);

  // Só subtarefas raiz (sem parent)
  const rootSubtasks = useMemo<ChecklistItem[]>(
    () => allItems.filter((c) => !c.parent_id),
    [allItems]
  );

  const hasSubtasks = rootSubtasks.length > 0;
  const subDone = rootSubtasks.filter((c) => c.completed).length;

  const handleSave = async (id: string, payload: unknown): Promise<void> => {
    await onUpdate(id, payload);
    setEditing(false);
  };

  const dndEnabled = index !== undefined && !editing;

  return (
    <div
      className={styles.taskBlock}
      style={isDragging ? { opacity: 0.5 } : undefined}
      onDragOver={dndEnabled ? (e) => e.preventDefault() : undefined}
      onDrop={dndEnabled ? (e) => { e.preventDefault(); onDropAt?.(index!); } : undefined}
    >
      {/* ── Formulário de edição ── */}
      {editing ? (
        <EditForm task={task} projects={projects} onSave={handleSave} onCancel={() => setEditing(false)} />
      ) : (
        <div className={`${styles.taskItem} ${done ? styles.taskDone : ""}`}>
          {/* Alça de arraste (reordenar) */}
          {dndEnabled && (
            <span
              className={styles.dragHandle}
              draggable
              onDragStart={() => onDragStart?.(index!)}
              onDragEnd={() => onDragEnd?.()}
              title="Arraste para reordenar"
              aria-label="Reordenar tarefa"
              role="button"
            >
              ⠿
            </span>
          )}
          {/* Botão de conclusão */}
          <button
            className={styles.checkBtn}
            style={{
              borderColor: dotColor,
              color: done ? "#fff" : "transparent",
              background: done ? dotColor : "transparent",
            }}
            onClick={() => {
              haptic(done ? 5 : 12);
              done ? onReopen(task.id) : onComplete(task.id);
            }}
            title={done ? "Reabrir" : "Concluir"}
            aria-label={done ? "Reabrir tarefa" : "Concluir tarefa"}
          >
            ✓
          </button>

          {/* Info da tarefa — clique abre o modal de detalhes/edição */}
          <div
            className={styles.taskInfo}
            role={onOpenDetail ? "button" : undefined}
            tabIndex={onOpenDetail ? 0 : undefined}
            onClick={onOpenDetail ? () => onOpenDetail(task.id) : undefined}
            onKeyDown={onOpenDetail ? (e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); onOpenDetail(task.id); } } : undefined}
            style={onOpenDetail ? { cursor: "pointer" } : undefined}
          >
            <span className={styles.taskTitle}>{task.title}</span>
            {task.project_id && (() => {
              const project = projects.find((item) => item.id === task.project_id);
              return project ? <span className={styles.taskSub}>{project.emoji} {project.name}</span> : null;
            })()}
            {hasSubtasks && (
              <span className={styles.taskSub}>
                {subDone}/{rootSubtasks.length} subtarefas
              </span>
            )}
          </div>

          {/* Botão de expandir subtarefas */}
          {hasSubtasks && (
            <button
              className={`${styles.expandBtn} ${expanded ? styles.expandBtnOpen : ""}`}
              onClick={() => setExpanded((v) => !v)}
              title={expanded ? "Fechar subtarefas" : "Ver subtarefas"}
            >
              ›
            </button>
          )}

          {/* Mobile: chevron indicando que a linha abre o detalhe (os botões
              de editar/remover ficam no próprio detalhe). */}
          {isMobile && onOpenDetail && (
            <span className={styles.chevron} aria-hidden>
              <ChevronRight size={18} />
            </span>
          )}

          {/* Editar */}
          <button
            className={styles.editBtn}
            onClick={() => setEditing(true)}
            title="Editar tarefa"
            aria-label="Editar tarefa"
          >
            ✎
          </button>

          {/* Remover do dia */}
          <button
            className={styles.removeBtn}
            onClick={() => onRemove(task.id)}
            title="Remover do dia"
            aria-label="Remover tarefa do dia"
          >
            ✕
          </button>
        </div>
      )}

      {/* Lista de subtarefas expandida */}
      {!editing && expanded && hasSubtasks && (
        <div className={styles.subtaskList}>
          {rootSubtasks.map((item) => (
            <SubtaskItem
              key={item.id}
              item={item}
              taskId={task.id}
              allItems={allItems}
              onToggle={onToggleChecklist}
              depth={0}
            />
          ))}
        </div>
      )}
    </div>
  );
}

/* ─── TodayPanel ─────────────────────────────────────────────────────────── */
interface TodayPanelProps {
  tasks: TodayTask[];
  completedToday?: number;
  onComplete: (id: string) => void;
  onReopen: (id: string) => void;
  onToggleChecklist: (taskId: string, itemId: string) => void;
  onUpdate: (id: string, payload: unknown) => Promise<unknown>;
  projects?: Project[];
  onOpenDetail?: (id: number | string) => void;
  /** Força o painel iniciar expandido (usado na etapa de preparação do Daily Focus). */
  forceExpanded?: boolean;
  /** Notifica o pai sempre que a seleção de prioridades muda (ids ordenados). */
  onSelectionChange?: (ids: string[]) => void;
  /** Quando este número muda, recarrega a seleção do BD (ex.: após "Sugerir 5"). */
  reloadSignal?: number;
}

export default function TodayPanel({ tasks, completedToday = 0, onComplete, onReopen, onToggleChecklist, onUpdate, projects = [], onOpenDetail, forceExpanded = false, onSelectionChange, reloadSignal = 0 }: TodayPanelProps) {
  const isMobile = useIsMobile();
  // Inicia com o cache local para evitar flash, depois sincroniza com o BD
  const [todayIds, setTodayIds] = useState<string[]>(loadCachedIds);
  const [showPicker, setShowPicker] = useState<boolean>(false);
  const [collapsed, setCollapsed] = useState<boolean>(() => {
    if (forceExpanded) return false;
    try {
      const v = localStorage.getItem("todayPanel_collapsed");
      return v === null ? true : v === "true"; // default: minimizado
    } catch { return true; }
  });
  const [_syncing, _setSyncing] = useState<boolean>(false);
  const [dragIndex, setDragIndex] = useState<number | null>(null);
  const { showToast } = useToast();

  // Recarrega os IDs de foco do BD (fallback: mantém cache local).
  const reloadFromDB = useCallback((): void => {
    dailyTasksApi.load().then((ids: string[]) => {
      setTodayIds(ids);
      saveCachedIds(ids);
    }).catch(() => {
      // BD indisponível: permanece com o cache local
    });
  }, []);

  // ── Carrega do BD ao montar ──────────────────────────────────────────────
  useEffect(() => {
    reloadFromDB();
  }, [reloadFromDB]);

  // ── Rollover: quando o dia LOCAL vira, recarrega o foco do novo dia ───────
  useEffect(() => {
    let currentDay = todayISO();
    const check = (): void => {
      const now = todayISO();
      if (now !== currentDay) {
        currentDay = now;
        setTodayIds(loadCachedIds()); // cache do novo dia (provavelmente vazio)
        reloadFromDB();
      }
    };
    const interval = setInterval(check, 60_000);
    document.addEventListener("visibilitychange", check);
    window.addEventListener("focus", check);
    return () => {
      clearInterval(interval);
      document.removeEventListener("visibilitychange", check);
      window.removeEventListener("focus", check);
    };
  }, [reloadFromDB]);

  // ── Recarrega do BD sob demanda (ex.: após "Sugerir 5" no pai) ────────────
  useEffect(() => {
    if (reloadSignal > 0) reloadFromDB();
  }, [reloadSignal, reloadFromDB]);

  // ── Atualiza cache local + notifica o pai sempre que ids mudar ────────────
  useEffect(() => {
    saveCachedIds(todayIds);
    onSelectionChange?.(todayIds);
  }, [todayIds]); // eslint-disable-line react-hooks/exhaustive-deps

  const todayTasks = useMemo<TodayTask[]>(() => {
    const map = new Map<string, TodayTask>(tasks.map((t) => [t.id, t]));
    return todayIds.map((id) => map.get(id)).filter(Boolean) as TodayTask[];
  }, [tasks, todayIds]);

  // Remove do estado tarefas que foram deletadas do BD.
  // Guard: só roda depois que `tasks` carregou — enquanto a query está vazia
  // ([]), isto zeraria o painel por um instante (flash de "nenhuma tarefa").
  useEffect(() => {
    if (tasks.length === 0) return;
    const validIds = new Set<string>(tasks.map((t) => t.id));
    const cleaned = todayIds.filter((id) => validIds.has(id));
    if (cleaned.length !== todayIds.length) {
      setTodayIds(cleaned);
    }
  }, [tasks]); // eslint-disable-line

  const pickerTasks = useMemo<TodayTask[]>(
    () => tasks.filter((t) => !t._isRoutine && !todayIds.includes(t.id)),
    [tasks, todayIds]
  );

  const count = todayTasks.length;

  const handleSelect = async (item: TodayTask): Promise<void> => {
    if (todayIds.includes(item.id)) return;
    if (count >= DAILY_LIMIT) {
      showToast(`Limite diário de ${DAILY_LIMIT} tarefas atingido`, "info");
      return;
    }
    // Otimista: atualiza UI imediatamente
    setTodayIds((prev) => [...prev, item.id]);
    if (count + 1 >= DAILY_LIMIT) setShowPicker(false);
    // Persiste no BD
    try {
      await dailyTasksApi.add(item.id);
    } catch (err) {
      // Reverte se falhar
      setTodayIds((prev) => prev.filter((i) => i !== item.id));
      const status = (err as { status?: number })?.status;
      showToast(status === 409 ? `Limite diário de ${DAILY_LIMIT} tarefas atingido` : "Não foi possível adicionar ao foco", "error");
    }
  };

  // ── Reordenação por drag & drop (persiste posição no BD) ──────────────────
  const handleDrop = async (targetIdx: number): Promise<void> => {
    const from = dragIndex;
    setDragIndex(null);
    if (from === null || from === targetIdx) return;
    const reordered = [...todayIds];
    const [moved] = reordered.splice(from, 1);
    reordered.splice(targetIdx, 0, moved);
    const previous = todayIds;
    setTodayIds(reordered); // otimista
    try {
      await dailyTasksApi.reorder(reordered);
    } catch {
      setTodayIds(previous); // reverte
      showToast("Não foi possível reordenar", "error");
    }
  };

  const handleRemove = async (id: string): Promise<void> => {
    // Otimista: atualiza UI imediatamente
    setTodayIds((prev) => prev.filter((i) => i !== id));
    // Persiste no BD
    try {
      await dailyTasksApi.remove(id);
    } catch {
      // Reverte se falhar
      setTodayIds((prev) => [...prev, id]);
    }
  };

  const completedCount = todayTasks.filter((t) => t.completed).length;
  const canAdd = count < DAILY_LIMIT;
  // Sem botão de recolher no mobile, um "recolhido" herdado travaria o card.
  const isCollapsed = isMobile ? false : collapsed;
  const pct = count > 0 ? Math.round((completedCount / count) * 100) : 0;

  return (
    <div className={`${styles.panel} ${isMobile ? styles.panelMobile : ""}`}>
      {/* Cabeçalho */}
      <div className={styles.header}>
        <div className={styles.titleRow}>
          {/* Botão colapsar */}
          {!isMobile && (
            <button
              className={`${styles.collapseBtn} ${collapsed ? styles.collapseBtnClosed : ""}`}
              onClick={() => {
                const next = !collapsed;
                setCollapsed(next);
                try { localStorage.setItem("todayPanel_collapsed", String(next)); } catch {}
              }}
              aria-label={collapsed ? "Expandir painel" : "Recolher painel"}
              title={collapsed ? "Expandir" : "Recolher"}
            >
              ‹
            </button>
          )}
          <span className={styles.title}>{isMobile ? "Tarefas de hoje" : "Tarefas de Hoje"}</span>
          <span className={`${styles.slot} ${count >= DAILY_LIMIT ? styles.slotFull : ""}`}>
            {count} / {DAILY_LIMIT}
          </span>
          {completedToday > 0 && (
            <span
              className={styles.doneToday}
              title="Total de tarefas concluídas hoje"
            >
              ✓ {completedToday} feita{completedToday !== 1 ? "s" : ""} hoje
            </span>
          )}
        </div>
        {canAdd && !isCollapsed && (
          <button className={styles.addBtn} onClick={() => setShowPicker((v) => !v)}>
            {showPicker ? "✕ Fechar" : "+ Selecionar"}
          </button>
        )}
      </div>

      {/* Corpo colapsável */}
      {!isCollapsed && (
        <>
          {/* Barra de progresso */}
          {count > 0 && (
            <div className={styles.progressWrap}>
              <div className={styles.progressBar}>
                <div className={styles.progressFill} style={{ width: `${pct}%` }} />
              </div>
              <span className={styles.progressLabel}>
                {completedCount} de {count} concluída{count !== 1 ? "s" : ""}
              </span>
            </div>
          )}

          {/* Picker */}
          {showPicker && (
            <div className={styles.pickerWrap}>
              <TaskSelector
                tasks={pickerTasks}
                onSelect={handleSelect}
                onCancel={() => setShowPicker(false)}
              />
            </div>
          )}

          {/* Empty state ilustrado */}
          {todayTasks.length === 0 && !showPicker && (
            <div className={styles.emptyState}>
              <span className={styles.emptyIcon}>📋</span>
              <span className={styles.emptyTitle}>Nenhuma tarefa para hoje</span>
              <span className={styles.emptyDesc}>Escolha até {DAILY_LIMIT} tarefas para focar agora</span>
              <button className={styles.emptyBtn} onClick={() => setShowPicker(true)}>
                + Selecionar tarefas
              </button>
            </div>
          )}

          {/* Tarefas selecionadas */}
          {todayTasks.length > 0 && (
            <div className={styles.list}>
              {count > 0 && completedCount === count && (
                <div className={styles.allDoneMsg}>🎉 Tudo concluído! Bom trabalho hoje.</div>
              )}
              {todayTasks.map((t, i) => (
                <TodayTaskItem
                  key={t.id}
                  task={t}
                  index={i}
                  isDragging={dragIndex === i}
                  onDragStart={setDragIndex}
                  onDragEnd={() => setDragIndex(null)}
                  onDropAt={handleDrop}
                  onComplete={onComplete}
                  onReopen={onReopen}
                  onRemove={handleRemove}
                  onToggleChecklist={onToggleChecklist}
                  onUpdate={onUpdate}
                  projects={projects}
                  onOpenDetail={onOpenDetail}
                />
              ))}
              {count >= DAILY_LIMIT && (
                <div className={styles.limitMsg}>
                  Limite diário de {DAILY_LIMIT} tarefas atingido
                </div>
              )}
            </div>
          )}
        </>
      )}
    </div>
  );
}
