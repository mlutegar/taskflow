import { useState, useEffect, useRef, useMemo, memo, FormEvent, KeyboardEvent, TouchEvent, MouseEvent } from "react";
import styles from "./TaskCard.module.css";

interface ChecklistNodeItem {
  id: number | string;
  parent_id?: number | string | null;
  description: string;
  note?: string | null;
  completed: boolean;
  order?: number;
}

interface TaskData {
  id: number | string;
  title: string;
  description?: string | null;
  priority: number;
  due_date?: string | null;
  recurrence?: string | null;
  completed: boolean;
  checklist: ChecklistNodeItem[];
  checklist_count?: number;
  checklist_completed_count?: number;
  created_at?: string | null;  // snake_case (caso o backend transforme)
  createdAt?: string | null;   // camelCase (direto do Prisma)
  updatedAt?: string;
  updated_at?: string;
}

interface ChecklistNodeProps {
  item: ChecklistNodeItem;
  childrenMap: Map<number | string | null, ChecklistNodeItem[]>;
  taskId: number | string;
  taskCompleted: boolean;
  depth: number;
  onToggle: (taskId: number | string, itemId: number | string) => void;
  onUpdate: (taskId: number | string, itemId: number | string, updates: Record<string, unknown>) => Promise<void>;
  onDelete: (taskId: number | string, itemId: number | string) => void;
  onAdd: (taskId: number | string, text: string, parentId?: number | string | null) => Promise<void>;
}

// Conta em quantos dias a tarefa apareceu no TodayPanel (chaves todayTasks_YYYY-MM-DD)
function countTodayPanelAppearances(taskId: string | number): number {
  let count = 0;
  const prefix = "todayTasks_";
  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i);
    if (!key?.startsWith(prefix)) continue;
    try {
      const ids: string[] = JSON.parse(localStorage.getItem(key) ?? "[]");
      if (ids.includes(String(taskId))) count++;
    } catch { /* ignora chaves corrompidas */ }
  }
  return count;
}

// Item de checklist recursivo: permite subtarefas dentro de subtarefas.
function ChecklistNode({ item, childrenMap, taskId, taskCompleted, depth, onToggle, onUpdate, onDelete, onAdd }: ChecklistNodeProps) {
  const [adding, setAdding] = useState<boolean>(false);
  const [text, setText] = useState<string>("");
  const [editing, setEditing] = useState<boolean>(false);
  const [editText, setEditText] = useState<string>(item.description);
  const [editNote, setEditNote] = useState<string>(item.note || "");
  const children = childrenMap.get(item.id) || [];

  const startEditing = (): void => {
    setEditText(item.description);
    setEditNote(item.note || "");
    setEditing(true);
  };

  const cancelEditing = (): void => {
    setEditText(item.description);
    setEditNote(item.note || "");
    setEditing(false);
  };

  const handleAddChild = async (e: FormEvent<HTMLFormElement>): Promise<void> => {
    e.preventDefault();
    if (!text.trim()) return;
    await onAdd(taskId, text.trim(), item.id);
    setText("");
    setAdding(false);
  };

  const handleSaveEdit = async (e: FormEvent<HTMLFormElement>): Promise<void> => {
    e.preventDefault();
    const trimmed = editText.trim();
    if (!trimmed) {
      cancelEditing();
      return;
    }
    const newNote = editNote.trim() || null;
    const updates: Record<string, unknown> = {};
    if (trimmed !== item.description) updates.description = trimmed;
    if (newNote !== (item.note || null)) updates.note = newNote;
    if (Object.keys(updates).length > 0) {
      await onUpdate(taskId, item.id, updates);
    }
    setEditing(false);
  };

  return (
    <div className={styles.checklistNode} style={depth > 0 ? { marginLeft: 18 } : undefined}>
      {editing ? (
        <form className={styles.checklistEditForm} onSubmit={handleSaveEdit}>
          <div className={styles.checklistForm}>
            <input
              className={styles.checklistInput}
              value={editText}
              onChange={(e) => setEditText(e.target.value)}
              onKeyDown={(e: KeyboardEvent<HTMLInputElement>) => { if (e.key === "Escape") cancelEditing(); }}
              placeholder="Título da subtarefa"
              autoFocus
            />
            <button type="submit" className={styles.checklistAdd} disabled={!editText.trim()} title="Salvar" aria-label="Salvar edição">✓</button>
            <button
              type="button"
              className={styles.checklistDelete}
              onClick={cancelEditing}
              title="Cancelar"
              aria-label="Cancelar edição"
            >✕</button>
          </div>
          <textarea
            className={styles.checklistNoteInput}
            value={editNote}
            onChange={(e) => setEditNote(e.target.value)}
            onKeyDown={(e: KeyboardEvent<HTMLTextAreaElement>) => { if (e.key === "Escape") cancelEditing(); }}
            placeholder="Descrição / nota (opcional)"
            rows={2}
          />
        </form>
      ) : (
        <div className={styles.checklistItem}>
          <button
            className={`${styles.checklistCheck} ${item.completed ? styles.checklistDone : ""}`}
            onClick={() => onToggle(taskId, item.id)}
          >
            {item.completed && "✓"}
          </button>
          <span
            className={`${styles.checklistTextWrap} ${item.completed ? styles.checklistTextDone : ""}`}
            onDoubleClick={() => !taskCompleted && startEditing()}
            title={!taskCompleted ? "Clique duplo para editar" : undefined}
          >
            {item.description}
            {item.note && <span className={styles.checklistNote}>{item.note}</span>}
          </span>
          {!taskCompleted && (
            <button
              className={styles.checklistDelete}
              onClick={startEditing}
              title="Editar"
              aria-label="Editar item"
            >✎</button>
          )}
          {!taskCompleted && (
            <button
              className={styles.checklistDelete}
              onClick={() => setAdding((v) => !v)}
              title="Adicionar subtarefa"
              aria-label="Adicionar subtarefa"
            >＋</button>
          )}
          <button
            className={styles.checklistDelete}
            onClick={() => onDelete(taskId, item.id)}
            title="Remover item"
            aria-label="Remover item"
          >✕</button>
        </div>
      )}

      {adding && !taskCompleted && (
        <form className={styles.checklistForm} style={{ marginLeft: 18 }} onSubmit={handleAddChild}>
          <input
            className={styles.checklistInput}
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder="Adicionar subtarefa..."
            autoFocus
          />
          <button type="submit" className={styles.checklistAdd} disabled={!text.trim()}>+</button>
        </form>
      )}

      {children.map((child) => (
        <ChecklistNode
          key={child.id}
          item={child}
          childrenMap={childrenMap}
          taskId={taskId}
          taskCompleted={taskCompleted}
          depth={depth + 1}
          onToggle={onToggle}
          onUpdate={onUpdate}
          onDelete={onDelete}
          onAdd={onAdd}
        />
      ))}
    </div>
  );
}

const RECURRENCE_LABELS: Record<string, string> = {
  daily: "Todo dia",
  weekly: "Toda semana",
  biweekly: "A cada 2 semanas",
  monthly: "Todo mês",
};

const PRIORITY_MAP: Record<number, { label: string; cls: string }> = {
  1: { label: "Crítica", cls: "critical" },
  2: { label: "Alta", cls: "high" },
  3: { label: "Média", cls: "medium" },
  4: { label: "Baixa", cls: "low" },
};

function formatDate(str: string | null | undefined): string | null {
  if (!str) return null;
  const [y, m, d] = str.split("-");
  return `${d}/${m}/${y}`;
}

function isOverdue(dueDate: string | null | undefined, completed: boolean): boolean {
  if (!dueDate || completed) return false;
  return new Date(dueDate) < new Date(new Date().toDateString());
}

// Quantos dias faltam até a data de entrega (0 = hoje, negativo = atrasada).
function daysUntil(dueDate: string | null | undefined): number | null {
  if (!dueDate) return null;
  const [y, m, d] = dueDate.split("-").map(Number);
  const due = new Date(y, m - 1, d);
  const today = new Date(new Date().toDateString());
  return Math.round((due.getTime() - today.getTime()) / 86400000);
}

const plural = (n: number, sing: string, plur: string): string => `${n} ${Math.abs(n) === 1 ? sing : plur}`;

// Texto do contador regressivo.
function countdownLabel(days: number | null): string | null {
  if (days == null) return null;
  if (days < 0) return `⏳ Atrasada ${plural(Math.abs(days), "dia", "dias")}`;
  if (days === 0) return "⏳ É hoje!";
  return `⏳ Faltam ${plural(days, "dia", "dias")}`;
}

// Calcula o ritmo necessário das subtarefas para cumprir o prazo.
// Ex.: 10 subtarefas em 20 dias → "1 subtarefa a cada 2 dias".
//      20 subtarefas em 5 dias  → "4 subtarefas por dia".
function pacePlan(days: number | null, pending: number): { text: string; urgent: boolean } | null {
  if (pending <= 0 || days == null) return null;
  // Atrasada ou vence hoje: tudo precisa sair hoje.
  if (days <= 0) {
    return { text: `Faça ${plural(pending, "subtarefa", "subtarefas")} hoje`, urgent: true };
  }
  if (days >= pending) {
    const everyN = Math.floor(days / pending);
    return {
      text: everyN <= 1 ? "1 subtarefa por dia" : `1 subtarefa a cada ${everyN} dias`,
      urgent: false,
    };
  }
  const perDay = Math.ceil(pending / days);
  return { text: `${plural(perDay, "subtarefa", "subtarefas")} por dia`, urgent: perDay >= 3 };
}

interface TaskCardProps {
  task: TaskData;
  onComplete: (id: number | string) => void;
  onReopen: (id: number | string) => void;
  onDelete: (id: number | string) => void;
  onUpdate: (id: number | string, payload: Record<string, unknown>) => Promise<void>;
  onAddChecklist: (taskId: number | string, text: string, parentId?: number | string | null) => Promise<void>;
  onToggleChecklist: (taskId: number | string, itemId: number | string) => void;
  onUpdateChecklist: (taskId: number | string, itemId: number | string, updates: Record<string, unknown>) => Promise<void>;
  onDeleteChecklist: (taskId: number | string, itemId: number | string) => void;
}

function TaskCard({ task, onComplete, onReopen, onDelete, onUpdate, onAddChecklist, onToggleChecklist, onUpdateChecklist, onDeleteChecklist }: TaskCardProps) {
  const [expanded, setExpanded] = useState<boolean>(false);
  const [editing, setEditing] = useState<boolean>(false);

  // ── Swipe gestures (mobile) ──────────────────────────────────────────────
  const swipeTouchX = useRef<number | null>(null);
  const [swipeOffset, setSwipeOffset] = useState<number>(0);
  const SWIPE_THRESHOLD = 80;

  const handleSwipeTouchStart = (e: TouchEvent<HTMLDivElement>): void => {
    const tag = (e.target as HTMLElement).tagName.toLowerCase();
    if (['input', 'textarea', 'select', 'button'].includes(tag)) return;
    swipeTouchX.current = e.touches[0].clientX;
  };
  const handleSwipeTouchMove = (e: TouchEvent<HTMLDivElement>): void => {
    if (swipeTouchX.current === null) return;
    const dx = e.touches[0].clientX - swipeTouchX.current;
    setSwipeOffset(dx);
  };
  const handleSwipeTouchEnd = (): void => {
    if (swipeOffset > SWIPE_THRESHOLD && !task.completed) {
      handleComplete();
    } else if (swipeOffset < -SWIPE_THRESHOLD && onDelete) {
      onDelete(task.id);
    }
    setSwipeOffset(0);
    swipeTouchX.current = null;
  };
  const [editData, setEditData] = useState<{
    title: string;
    description: string;
    priority: number;
    due_date: string;
    recurrence: string;
  }>({
    title: task.title,
    description: task.description || "",
    priority: task.priority,
    due_date: task.due_date || "",
    recurrence: task.recurrence || "",
  });
  const [checklistInput, setChecklistInput] = useState<string>("");
  const [saving, setSaving] = useState<boolean>(false);
  const [rescheduleFlash, setRescheduleFlash] = useState<string | null>(null);
  const [doneFlash, setDoneFlash] = useState<boolean>(false);
  const prevDueDateRef = useRef<string | null | undefined>(task.due_date);

  const handleComplete = (): void => {
    setDoneFlash(true);
    setTimeout(() => setDoneFlash(false), 600);
    onComplete(task.id);
  };

  useEffect(() => {
    if (task.recurrence && task.due_date !== prevDueDateRef.current) {
      setRescheduleFlash(task.due_date ?? null);
      prevDueDateRef.current = task.due_date;
      const t = setTimeout(() => setRescheduleFlash(null), 3500);
      return () => clearTimeout(t);
    }
    prevDueDateRef.current = task.due_date;
  }, [task.due_date, task.recurrence]);

  const priority = PRIORITY_MAP[task.priority] || PRIORITY_MAP[4];
  const overdue = isOverdue(task.due_date, task.completed);

  // Contador de dias + ritmo das subtarefas pendentes.
  const daysLeft = task.completed ? null : daysUntil(task.due_date);
  const pendingChecklist = (task.checklist_count || 0) - (task.checklist_completed_count || 0);
  const countdown = task.completed ? null : countdownLabel(daysLeft);
  const pace = task.completed ? null : pacePlan(daysLeft, pendingChecklist);

  // Monta a árvore do checklist: agrupa filhos por parent_id e ordena cada nível.
  const { rootItems, childrenMap } = useMemo(() => {
    const map = new Map<number | string | null, ChecklistNodeItem[]>();
    for (const item of task.checklist) {
      const key = item.parent_id ?? null;
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(item);
    }
    for (const list of map.values()) {
      list.sort((a, b) => (a.order ?? 0) - (b.order ?? 0) || Number(a.id) - Number(b.id));
    }
    return { rootItems: map.get(null) || [], childrenMap: map };
  }, [task.checklist]);

  const handleSaveEdit = async (): Promise<void> => {
    setSaving(true);
    try {
      const payload: Record<string, unknown> = {
        title: editData.title.trim(),
        description: editData.description.trim() || null,
        priority: Number(editData.priority),
        due_date: editData.due_date || null,
        recurrence: editData.recurrence || null,
      };
      await onUpdate(task.id, payload);
      setEditing(false);
    } finally {
      setSaving(false);
    }
  };

  const handleAddChecklist = async (e: FormEvent<HTMLFormElement>): Promise<void> => {
    e.preventDefault();
    if (!checklistInput.trim()) return;
    await onAddChecklist(task.id, checklistInput.trim());
    setChecklistInput("");
  };

  if (editing) {
    return (
      <div className={styles.card}>
        <div className={styles.editForm}>
          <input
            className={styles.editInput}
            value={editData.title}
            onChange={(e) => setEditData((d) => ({ ...d, title: e.target.value }))}
            placeholder="Título"
            autoFocus
          />
          <textarea
            className={styles.editTextarea}
            value={editData.description}
            onChange={(e) => setEditData((d) => ({ ...d, description: e.target.value }))}
            placeholder="Descrição (opcional)"
            rows={2}
          />
          <div className={styles.editRow}>
            <select
              className={styles.editSelect}
              value={editData.priority}
              onChange={(e) => setEditData((d) => ({ ...d, priority: Number(e.target.value) }))}
            >
              <option value={1}>🔴 Crítica</option>
              <option value={2}>🟠 Alta</option>
              <option value={3}>🟡 Média</option>
              <option value={4}>🟢 Baixa</option>
            </select>
            <input
              type="date"
              className={styles.editInput}
              value={editData.due_date}
              onChange={(e) => setEditData((d) => ({ ...d, due_date: e.target.value }))}
            />
          </div>
          <select
            className={styles.editSelect}
            value={editData.recurrence}
            onChange={(e) => setEditData((d) => ({ ...d, recurrence: e.target.value }))}
          >
            <option value="">Sem repetição</option>
            <option value="daily">🔄 Todo dia</option>
            <option value="weekly">🔄 Toda semana</option>
            <option value="biweekly">🔄 A cada 2 semanas</option>
            <option value="monthly">🔄 Todo mês</option>
          </select>
          <div className={styles.editActions}>
            <button className={styles.btnSave} onClick={handleSaveEdit} disabled={saving || !editData.title.trim()}>
              {saving ? "Salvando..." : "Salvar"}
            </button>
            <button className={styles.btnCancel} onClick={() => setEditing(false)}>Cancelar</button>
          </div>
        </div>
      </div>
    );
  }

  const swipeRight = swipeOffset > 20;
  const swipeLeft = swipeOffset < -20;

  return (
    <div className={styles.swipeWrapper}>
      {swipeRight && !task.completed && (
        <div className={`${styles.swipeHint} ${styles.swipeHintComplete}`}>✓ Concluir</div>
      )}
      {swipeLeft && (
        <div className={`${styles.swipeHint} ${styles.swipeHintDelete}`}>🗑 Excluir</div>
      )}
    <div
      className={`${styles.card} ${task.completed ? styles.completed : ""} ${styles[`bar_${priority.cls}`]} ${doneFlash ? styles.doneFlash : ""}`}
      style={{ transform: `translateX(${swipeOffset}px)`, transition: swipeTouchX.current ? "none" : "transform 0.25s ease" }}
      onTouchStart={handleSwipeTouchStart}
      onTouchMove={handleSwipeTouchMove}
      onTouchEnd={handleSwipeTouchEnd}
    >
      <div className={styles.main}>
        <button
          className={`${styles.checkbox} ${task.completed ? styles.checkboxDone : ""}`}
          onClick={() => task.completed ? onReopen(task.id) : handleComplete()}
          title={task.completed ? "Reabrir" : "Concluir"}
          aria-label={task.completed ? "Reabrir tarefa" : "Concluir tarefa"}
        >
          {task.completed && "✓"}
        </button>

        <div
          className={styles.content}
          onClick={() => setExpanded((v) => !v)}
          role="button"
          tabIndex={0}
          aria-expanded={expanded}
          aria-label={`${task.title} — clique para ${expanded ? "recolher" : "expandir"} detalhes`}
          onKeyDown={(e: KeyboardEvent<HTMLDivElement>) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setExpanded((v) => !v); } }}
        >
          <div className={styles.titleRow}>
            <span className={styles.title}>{task.title}</span>
            <span className={`${styles.priority} ${styles[priority.cls]}`}>{priority.label}</span>
          </div>

          <div className={styles.meta}>
            {task.due_date && (
              <span className={`${styles.metaItem} ${overdue ? styles.overdue : ""}`}>
                📅 {formatDate(task.due_date)}
              </span>
            )}
            {countdown && (
              <span className={`${styles.countdownBadge} ${daysLeft !== null && daysLeft < 0 ? styles.countdownLate : daysLeft === 0 ? styles.countdownToday : ""} ${daysLeft !== null && daysLeft < -30 ? styles.countdownVeryLate : ""}`}>
                {countdown}
              </span>
            )}
            {task.recurrence && (
              <span className={styles.recurrenceBadge}>
                🔄 {RECURRENCE_LABELS[task.recurrence]}
              </span>
            )}
            {task.checklist_count !== undefined && task.checklist_count > 0 && (
              <span className={styles.metaItem}>
                ☑ {task.checklist_completed_count}/{task.checklist_count}
              </span>
            )}
            {task.description && <span className={styles.metaItem}>📝</span>}
          </div>
        </div>

        <div className={styles.actions}>
          <button className={styles.actionBtn} onClick={() => setEditing(true)} title="Editar" aria-label="Editar tarefa">✏️</button>
          <button className={`${styles.actionBtn} ${styles.deleteBtn}`} onClick={() => onDelete(task.id)} title="Deletar" aria-label="Deletar tarefa">🗑</button>
        </div>
      </div>

      {rescheduleFlash && (
        <div className={styles.rescheduleFlash}>
          🔄 Reagendado para {formatDate(rescheduleFlash)}
        </div>
      )}

      {expanded && (
        <div className={styles.detail}>
          {/* ── Estatísticas inline ── */}
          {(() => {
            // API pode retornar created_at (snake_case) ou createdAt (camelCase do Prisma)
            const t = task as unknown as Record<string, unknown>;
            const rawCreatedAt = (task.created_at ?? t.createdAt) as string | null | undefined;
            const daysOpen = rawCreatedAt
              ? Math.floor((Date.now() - new Date(rawCreatedAt).getTime()) / 86_400_000)
              : null;

            const appearances  = countTodayPanelAppearances(task.id);
            const hasChecklist = (task.checklist_count ?? 0) > 0;
            const checklistPct = hasChecklist
              ? Math.round(((task.checklist_completed_count ?? 0) / task.checklist_count!) * 100)
              : null;

            const PRIO: Record<number, string> = { 1: "🔴 Crítica", 2: "🟠 Alta", 3: "🟡 Média", 4: "🟢 Baixa" };

            const stats: { icon: string; label: string }[] = [];

            // Prioridade — sempre disponível
            if (PRIO[task.priority]) stats.push({ icon: "", label: PRIO[task.priority] });

            // Dias em aberto
            if (daysOpen !== null && daysOpen >= 0)
              stats.push({ icon: "📅", label: daysOpen === 0 ? "criada hoje" : `aberta há ${daysOpen}d` });

            // Vezes no painel (só se > 0)
            if (appearances > 0)
              stats.push({ icon: "🎯", label: `${appearances}× no painel` });

            // Checklist %
            if (checklistPct !== null)
              stats.push({ icon: "☑️", label: `${checklistPct}% da checklist` });

            return (
              <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 10 }}>
                {stats.map((s) => (
                  <span
                    key={s.label}
                    style={{
                      display: "inline-flex",
                      alignItems: "center",
                      gap: s.icon ? 4 : 0,
                      fontSize: 11,
                      fontWeight: 500,
                      color: "var(--text-muted)",
                      background: "var(--surface-2)",
                      border: "1px solid var(--border)",
                      borderRadius: 99,
                      padding: "2px 8px",
                    }}
                  >
                    {s.icon}{s.icon ? " " : ""}{s.label}
                  </span>
                ))}
              </div>
            );
          })()}

          {task.description && <p className={styles.description}>{task.description}</p>}

          {pace && (
            <div className={`${styles.paceBanner} ${pace.urgent ? styles.paceUrgent : ""}`}>
              <span className={styles.paceIcon}>🎯</span>
              <span>
                Ritmo: <strong>{pace.text}</strong>
                <span className={styles.paceSub}>
                  {" "}— {pendingChecklist} pendente{pendingChecklist === 1 ? "" : "s"}
                  {daysLeft != null && daysLeft > 0 && ` em ${plural(daysLeft, "dia", "dias")}`}
                </span>
              </span>
            </div>
          )}

          {(task.checklist.length > 0 || !task.completed) && (
            <div className={styles.checklist}>
              {rootItems.map((item) => (
                <ChecklistNode
                  key={item.id}
                  item={item}
                  childrenMap={childrenMap}
                  taskId={task.id}
                  taskCompleted={task.completed}
                  depth={0}
                  onToggle={onToggleChecklist}
                  onUpdate={onUpdateChecklist}
                  onDelete={onDeleteChecklist}
                  onAdd={onAddChecklist}
                />
              ))}

              {!task.completed && (
                <form className={styles.checklistForm} onSubmit={handleAddChecklist}>
                  <input
                    className={styles.checklistInput}
                    value={checklistInput}
                    onChange={(e) => setChecklistInput(e.target.value)}
                    placeholder="Adicionar item ao checklist..."
                  />
                  <button type="submit" className={styles.checklistAdd} disabled={!checklistInput.trim()}>+</button>
                </form>
              )}
            </div>
          )}
        </div>
      )}
    </div>
    </div>
  );
}

// Wrap with React.memo — only re-render when task id or updatedAt changes.
export default memo(TaskCard, (prev, next) => {
  return prev.task.id === next.task.id &&
    prev.task.updatedAt === next.task.updatedAt &&
    prev.task.updated_at === next.task.updated_at;
});
