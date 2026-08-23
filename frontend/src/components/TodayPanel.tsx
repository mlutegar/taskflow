import { useState, useEffect, useMemo, FormEvent, ChangeEvent } from "react";
import TaskSelector from "./TaskSelector";
import { dailyTasksApi } from "../api/dailyTasks";
import styles from "./TodayPanel.module.css";

/* Vibração tátil curta (ignorada se browser não suportar) */
function haptic(ms: number = 10): void {
  try { if (navigator.vibrate) navigator.vibrate(ms); } catch { /* noop */ }
}

const DAILY_LIMIT = 5;

function todayKey(): string {
  return `todayTasks_${new Date().toISOString().split("T")[0]}`;
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
}

interface EditFormProps {
  task: TodayTask;
  onSave: (id: string, payload: {
    title: string;
    description: string | null;
    priority: number;
    due_date: string | null;
    recurrence: string | null;
  }) => Promise<void>;
  onCancel: () => void;
}

function EditForm({ task, onSave, onCancel }: EditFormProps) {
  const [data, setData] = useState<EditFormData>({
    title: task.title,
    description: task.description || "",
    priority: task.priority,
    due_date: task.due_date || "",
    recurrence: task.recurrence || "",
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
      <select
        className={styles.editSelect}
        value={data.recurrence}
        onChange={(e: ChangeEvent<HTMLSelectElement>) => setData((d) => ({ ...d, recurrence: e.target.value }))}
      >
        <option value="">Sem repetição</option>
        <option value="daily">🔄 Todo dia</option>
        <option value="weekly">🔄 Toda semana</option>
        <option value="biweekly">🔄 A cada 2 semanas</option>
        <option value="monthly">🔄 Todo mês</option>
      </select>
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
  onUpdate: (id: string, payload: unknown) => Promise<void>;
}

function TodayTaskItem({ task, onComplete, onReopen, onRemove, onToggleChecklist, onUpdate }: TodayTaskItemProps) {
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

  return (
    <div className={styles.taskBlock}>
      {/* ── Formulário de edição ── */}
      {editing ? (
        <EditForm task={task} onSave={handleSave} onCancel={() => setEditing(false)} />
      ) : (
        <div className={`${styles.taskItem} ${done ? styles.taskDone : ""}`}>
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

          {/* Info da tarefa */}
          <div className={styles.taskInfo}>
            <span className={styles.taskTitle}>{task.title}</span>
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
  onUpdate: (id: string, payload: unknown) => Promise<void>;
}

export default function TodayPanel({ tasks, completedToday = 0, onComplete, onReopen, onToggleChecklist, onUpdate }: TodayPanelProps) {
  // Inicia com o cache local para evitar flash, depois sincroniza com o BD
  const [todayIds, setTodayIds] = useState<string[]>(loadCachedIds);
  const [showPicker, setShowPicker] = useState<boolean>(false);
  const [collapsed, setCollapsed] = useState<boolean>(() => {
    try { return localStorage.getItem("todayPanel_collapsed") === "true"; } catch { return false; }
  });
  const [_syncing, _setSyncing] = useState<boolean>(false);

  // ── Carrega do BD ao montar ──────────────────────────────────────────────
  useEffect(() => {
    let cancelled = false;
    dailyTasksApi.load().then((ids: string[]) => {
      if (cancelled) return;
      setTodayIds(ids);
      saveCachedIds(ids);
    }).catch(() => {
      // BD indisponível: permanece com o cache local
    });
    return () => { cancelled = true; };
  }, []);

  // ── Atualiza cache local sempre que ids mudar ────────────────────────────
  useEffect(() => {
    saveCachedIds(todayIds);
  }, [todayIds]);

  const todayTasks = useMemo<TodayTask[]>(() => {
    const map = new Map<string, TodayTask>(tasks.map((t) => [t.id, t]));
    return todayIds.map((id) => map.get(id)).filter(Boolean) as TodayTask[];
  }, [tasks, todayIds]);

  // Remove do estado tarefas que foram deletadas do BD
  useEffect(() => {
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
    if (todayIds.includes(item.id) || count >= DAILY_LIMIT) return;
    // Otimista: atualiza UI imediatamente
    setTodayIds((prev) => [...prev, item.id]);
    if (count + 1 >= DAILY_LIMIT) setShowPicker(false);
    // Persiste no BD
    try {
      await dailyTasksApi.add(item.id);
    } catch {
      // Reverte se falhar
      setTodayIds((prev) => prev.filter((i) => i !== item.id));
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
  const pct = count > 0 ? Math.round((completedCount / count) * 100) : 0;

  return (
    <div className={styles.panel}>
      {/* Cabeçalho */}
      <div className={styles.header}>
        <div className={styles.titleRow}>
          {/* Botão colapsar */}
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
          <span className={styles.title}>Tarefas de Hoje</span>
          <span className={`${styles.slot} ${count >= DAILY_LIMIT ? styles.slotFull : ""}`}>
            {count}/{DAILY_LIMIT}
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
        {canAdd && !collapsed && (
          <button className={styles.addBtn} onClick={() => setShowPicker((v) => !v)}>
            {showPicker ? "✕ Fechar" : "+ Selecionar"}
          </button>
        )}
      </div>

      {/* Corpo colapsável */}
      {!collapsed && (
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
              {todayTasks.map((t) => (
                <TodayTaskItem
                  key={t.id}
                  task={t}
                  onComplete={onComplete}
                  onReopen={onReopen}
                  onRemove={handleRemove}
                  onToggleChecklist={onToggleChecklist}
                  onUpdate={onUpdate}
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
