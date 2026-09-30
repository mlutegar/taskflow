import { useState, useEffect, useRef, useMemo, memo, FormEvent, KeyboardEvent, TouchEvent, MouseEvent } from "react";
import styles from "./TaskCard.module.css";
import RecurrenceFields, { RecurrenceRule } from "./RecurrenceFields";
import { tasksApi } from "../api/tasks";
import { Project, ProjectInput } from "../api/projects";
import ProjectSelect from "./ProjectSelect";
import QuickCreateProject from "./QuickCreateProject";
import EstimatedTimeSelect from "./EstimatedTimeSelect";
import { formatMinutes, bucketOf, recordEstimationSample } from "../lib/estimatedTime";
import DescriptionEditor from "./DescriptionEditor";
import ReactMarkdown from "react-markdown";
import type { TaskUpdateInput } from "../types/tasks";

interface ChecklistNodeItem {
  id: string;
  parent_id?: number | string | null;
  description: string;
  note?: string | null;
  completed: boolean;
  order?: number;
}

interface TaskData {
  id: string;
  title: string;
  description?: string | null;
  priority: number;
  due_date?: string | null;
  recurrence?: string | null;
  recurrence_rule?: RecurrenceRule | null;
  project_id?: string | null;
  estimated_minutes?: number | null;
  actual_minutes?: number | null;
  completed: boolean;
  completed_at?: string | null;
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
  onUpdate: (taskId: number | string, itemId: number | string, updates: Record<string, unknown>) => Promise<unknown>;
  onDelete: (taskId: number | string, itemId: number | string) => void;
  onAdd: (taskId: number | string, text: string, parentId?: number | string | null) => Promise<unknown>;
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
  weekdays: "Dias úteis",
  monthly_first: "Primeiro dia do mês",
  custom: "Personalizada",
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

function completionLabel(completedAt: string | null | undefined): string {
  if (!completedAt) return "Feita";
  const completed = new Date(completedAt);
  const now = new Date();
  const sameDay = completed.getFullYear() === now.getFullYear()
    && completed.getMonth() === now.getMonth()
    && completed.getDate() === now.getDate();
  return sameDay ? "Feita hoje" : `Feita em ${completed.toLocaleDateString("pt-BR")}`;
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
  onComplete: (id: string) => void | Promise<unknown>;
  onReopen: (id: string) => void | Promise<unknown>;
  onDelete: (id: string) => void | Promise<unknown>;
  onUpdate: (id: string, payload: TaskUpdateInput) => void | Promise<unknown>;
  onAddChecklist: (taskId: string, text: string, parentId?: string | null) => void | Promise<unknown>;
  onToggleChecklist: (taskId: string, itemId: string) => void | Promise<unknown>;
  onUpdateChecklist: (taskId: string, itemId: string, updates: unknown) => void | Promise<unknown>;
  onDeleteChecklist: (taskId: string, itemId: string) => void | Promise<unknown>;
  completing?: boolean;
  projects?: Project[];
  onCreateProject?: (data: ProjectInput) => Promise<Project>;
  defaultExpanded?: boolean;
}

function TaskCard({ task, onComplete, onReopen, onDelete, onUpdate, onAddChecklist, onToggleChecklist, onUpdateChecklist, onDeleteChecklist, completing = false, projects = [], onCreateProject, defaultExpanded = false }: TaskCardProps) {
  const [expanded, setExpanded] = useState<boolean>(defaultExpanded);
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
    recurrence_rule: RecurrenceRule | null;
    project_id: string | null;
    estimated_minutes: number | null;
    actual_minutes: number | null;
  }>({
    title: task.title,
    description: task.description || "",
    priority: task.priority,
    due_date: task.due_date || "",
    recurrence: task.recurrence || "",
    recurrence_rule: task.recurrence_rule || null,
    project_id: task.project_id || null,
    estimated_minutes: task.estimated_minutes ?? null,
    actual_minutes: task.actual_minutes ?? null,
  });
  const [checklistInput, setChecklistInput] = useState<string>("");
  const [creatingProject, setCreatingProject] = useState<boolean>(false);
  const [saving, setSaving] = useState<boolean>(false);
  const [rescheduleFlash, setRescheduleFlash] = useState<string | null>(null);
  const [doneFlash, setDoneFlash] = useState<boolean>(false);
  const [history, setHistory] = useState<Array<{ id: string; date: string; undone: boolean }>>([]);
  const [historyLoading, setHistoryLoading] = useState<boolean>(false);
  const prevDueDateRef = useRef<string | null | undefined>(task.due_date);

  const handleComplete = (): void => {
    if (completing) return;
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

  useEffect(() => {
    if (!expanded || !task.recurrence) return;
    setHistoryLoading(true);
    tasksApi.history(task.id)
      .then((rows) => setHistory(rows as Array<{ id: string; date: string; undone: boolean }>))
      .catch(() => setHistory([]))
      .finally(() => setHistoryLoading(false));
  }, [expanded, task.id, task.recurrence, task.completed_at]);

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
      const payload: TaskUpdateInput = {
        title: editData.title.trim(),
        description: editData.description.trim() || null,
        priority: Number(editData.priority),
        due_date: editData.due_date || null,
        recurrence: editData.recurrence || null,
        recurrence_rule: editData.recurrence_rule,
        project_id: editData.project_id,
        estimated_minutes: editData.estimated_minutes,
        actual_minutes: editData.actual_minutes,
      };
      await onUpdate(task.id, payload);
      // Alimenta a calibração local quando há estimado e real informados.
      recordEstimationSample(editData.estimated_minutes, editData.actual_minutes);
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
          <DescriptionEditor
            className={styles.editTextarea}
            value={editData.description}
            onChange={(v) => setEditData((d) => ({ ...d, description: v }))}
            placeholder="Descrição (opcional)"
            rows={2}
            maxLength={10000}
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
          <div className={styles.editRow}>
            <label className={styles.editFieldLabel}>
              <span>⏱ Estimado</span>
              <EstimatedTimeSelect
                className={styles.editSelect}
                value={editData.estimated_minutes}
                onChange={(estimated_minutes) => setEditData((d) => ({ ...d, estimated_minutes }))}
              />
            </label>
            <label className={styles.editFieldLabel}>
              <span>✅ Real gasto</span>
              <EstimatedTimeSelect
                className={styles.editSelect}
                ariaLabel="Tempo real gasto"
                value={editData.actual_minutes}
                onChange={(actual_minutes) => setEditData((d) => ({ ...d, actual_minutes }))}
              />
            </label>
          </div>
          <RecurrenceFields
            recurrence={editData.recurrence}
            rule={editData.recurrence_rule}
            compact
            onChange={(recurrence, recurrence_rule) => setEditData((d) => ({ ...d, recurrence, recurrence_rule }))}
          />
          <ProjectSelect
            projects={projects}
            value={editData.project_id}
            onChange={(project_id) => setEditData((d) => ({ ...d, project_id }))}
            className={styles.editSelect}
            onCreateNew={onCreateProject ? () => setCreatingProject(true) : undefined}
          />
          {onCreateProject && creatingProject && (
            <QuickCreateProject
              projects={projects}
              onCreate={onCreateProject}
              onCreated={(project) => { setEditData((d) => ({ ...d, project_id: project.id })); setCreatingProject(false); }}
              onCancel={() => setCreatingProject(false)}
            />
          )}
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
          disabled={completing}
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
            {task.project_id && (() => {
              const project = projects.find((item) => item.id === task.project_id);
              return project ? (
                <span className={styles.projectBadge} style={{ borderColor: `${project.color}66`, color: project.color }}>
                  {project.emoji} {project.name}
                </span>
              ) : null;
            })()}
            {task.due_date && (
              <span className={`${styles.metaItem} ${overdue ? styles.overdue : ""}`}>
                📅 {formatDate(task.due_date)}{task.due_time ? ` ⏱ ${task.due_time}` : ""}
              </span>
            )}
            {countdown && (
              <span className={`${styles.countdownBadge} ${daysLeft !== null && daysLeft < 0 ? styles.countdownLate : daysLeft === 0 ? styles.countdownToday : ""} ${daysLeft !== null && daysLeft < -30 ? styles.countdownVeryLate : ""}`}>
                {countdown}
              </span>
            )}
            {task.completed && task.recurrence ? (
              <span className={styles.completedAtBadge}>
                ✅ {completionLabel(task.completed_at)} · volta {task.due_date ? formatDate(task.due_date) : "na próxima data"}
              </span>
            ) : task.recurrence && (
              <span className={styles.recurrenceBadge}>
                🔄 {RECURRENCE_LABELS[task.recurrence]}
              </span>
            )}
            {task.checklist_count !== undefined && task.checklist_count > 0 && (
              <span className={styles.metaItem}>
                ☑ {task.checklist_completed_count}/{task.checklist_count}
              </span>
            )}
            {task.estimated_minutes != null && (
              <span
                className={`${styles.timeBadge} ${styles[`time_${bucketOf(task.estimated_minutes)}`]}`}
                title="Tempo estimado"
              >
                ⏱ {formatMinutes(task.estimated_minutes)}
              </span>
            )}
            {task.actual_minutes != null && task.estimated_minutes != null && (() => {
              const diff = task.actual_minutes - task.estimated_minutes;
              const pct = Math.round((diff / task.estimated_minutes) * 100);
              const onTime = Math.abs(pct) <= 10;
              return (
                <span
                  className={`${styles.varianceBadge} ${onTime ? styles.varianceOk : diff > 0 ? styles.varianceOver : styles.varianceUnder}`}
                  title={`Real: ${formatMinutes(task.actual_minutes)} · estimado: ${formatMinutes(task.estimated_minutes)}`}
                >
                  {onTime ? "🎯 no alvo" : `${diff > 0 ? "▲" : "▼"} ${Math.abs(pct)}%`}
                </span>
              );
            })()}
            {task.actual_minutes != null && task.estimated_minutes == null && (
              <span className={styles.metaItem} title="Tempo real gasto">✅ {formatMinutes(task.actual_minutes)}</span>
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

          {task.description && (
            <div className={styles.description}>
              <ReactMarkdown
                allowedElements={["p", "a", "img", "strong", "em", "code", "pre", "ul", "ol", "li", "br", "h1", "h2", "h3", "blockquote"]}
                components={{
                  img: ({ node: _node, ...props }) => (
                    <img {...props} style={{ maxWidth: "100%", height: "auto", borderRadius: 8, margin: "6px 0" }} loading="lazy" />
                  ),
                  a: ({ node: _node, ...props }) => <a {...props} target="_blank" rel="noopener noreferrer" />,
                }}
              >
                {task.description}
              </ReactMarkdown>
            </div>
          )}

          {task.recurrence && (
            <div className={styles.historyBlock}>
              <strong>Histórico recente</strong>
              {historyLoading ? <span>Carregando…</span> : history.length === 0 ? (
                <span>Nenhuma ocorrência registrada ainda.</span>
              ) : (
                <>
                  <span>{history.filter((entry) => !entry.undone).length} conclusão(ões) registrada(s)</span>
                  <div className={styles.historyDays}>
                    {history.slice(0, 14).map((entry) => (
                      <span key={entry.id} className={entry.undone ? styles.historyUndone : styles.historyDone}>
                        {entry.undone ? "↩" : "✓"} {formatDate(entry.date)}
                      </span>
                    ))}
                  </div>
                </>
              )}
            </div>
          )}

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

// O cache do React Query substitui a tarefa por um novo objeto depois de cada
// mutação. A comparação rasa padrão acompanha essa troca e também preserva a
// memoização quando nenhuma prop mudou.
export default memo(TaskCard);
