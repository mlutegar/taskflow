import { useMemo, useState, useEffect, useCallback } from "react";
import { useQueries } from "@tanstack/react-query";
import {
  Repeat, Check, Eye, EyeOff, Play, PartyPopper, GripVertical, Flame,
} from "lucide-react";
import styles from "./TodayPanel.module.css";
import { TaskRecord } from "../types/tasks";
import { tasksApi } from "../api/tasks";
import {
  isDailyToday,
  completedDateSet,
  computeStreak,
  last7Days,
  HistoryEntry,
} from "../lib/dailyRoutine";

/* Vibração tátil curta (ignorada se o browser não suportar) */
function haptic(ms: number = 10): void {
  try { if (navigator.vibrate) navigator.vibrate(ms); } catch { /* noop */ }
}

/* Cores de prioridade (mesmas do TodayPanel) */
const PRIORITY_COLORS: Record<number, string> = {
  1: "var(--critical)", 2: "var(--high)", 3: "var(--medium)", 4: "var(--low)",
};

const ORDER_KEY = "dailyRoutine_order";
const HIDE_DONE_KEY = "dailyRoutine_hideDone";
const COLLAPSE_KEY = "dailyRoutinePanel_collapsed";

function loadOrder(): string[] {
  try { const raw = localStorage.getItem(ORDER_KEY); return raw ? JSON.parse(raw) : []; } catch { return []; }
}
function saveOrder(ids: string[]): void {
  try { localStorage.setItem(ORDER_KEY, JSON.stringify(ids)); } catch { /* noop */ }
}

interface ChecklistLite {
  id: string | number;
  parent_id?: string | number | null;
  description: string;
  completed: boolean;
}

interface DailyRoutinePanelProps {
  tasks: TaskRecord[];
  onComplete: (id: string) => void;
  onReopen: (id: string) => void;
  onToggleChecklist?: (taskId: string, itemId: string) => void;
  completingIds?: Set<string>;
  /** Abre o modal de detalhes/edição (gerido pela página). */
  onOpenDetail?: (id: number | string) => void;
}

export default function DailyRoutinePanel({
  tasks,
  onComplete,
  onReopen,
  onToggleChecklist,
  completingIds,
  onOpenDetail,
}: DailyRoutinePanelProps): JSX.Element | null {
  const [collapsed, setCollapsed] = useState<boolean>(() => {
    try { return localStorage.getItem(COLLAPSE_KEY) === "true"; } catch { return false; }
  });
  const [hideDone, setHideDone] = useState<boolean>(() => {
    try { return localStorage.getItem(HIDE_DONE_KEY) === "true"; } catch { return false; }
  });
  const [order, setOrder] = useState<string[]>(loadOrder);
  const [dragId, setDragId] = useState<string | null>(null);

  // Rotinas diárias que valem para HOJE (daily sempre; weekdays só seg–sex).
  const dailyTasks = useMemo<TaskRecord[]>(() => {
    return tasks.filter((t) => isDailyToday(t.recurrence));
  }, [tasks]);

  // Aplica ordem manual persistida; desconhecidas vão pro fim por prioridade/título.
  const orderedTasks = useMemo<TaskRecord[]>(() => {
    const idx = new Map(order.map((id, i) => [id, i]));
    return [...dailyTasks].sort((a, b) => {
      const ia = idx.has(a.id) ? (idx.get(a.id) as number) : Number.MAX_SAFE_INTEGER;
      const ib = idx.has(b.id) ? (idx.get(b.id) as number) : Number.MAX_SAFE_INTEGER;
      if (ia !== ib) return ia - ib;
      return (a.priority - b.priority) || a.title.localeCompare(b.title);
    });
  }, [dailyTasks, order]);

  // Não-feitas primeiro; opcionalmente esconde as concluídas.
  const visibleTasks = useMemo<TaskRecord[]>(() => {
    const base = hideDone ? orderedTasks.filter((t) => !t.completed) : orderedTasks;
    return [...base].sort((a, b) => Number(a.completed) - Number(b.completed));
  }, [orderedTasks, hideDone]);

  // Busca o histórico de cada rotina para streak + mini-heatmap.
  const historyQueries = useQueries({
    queries: dailyTasks.map((t) => ({
      queryKey: ["tasks", "history", t.id],
      queryFn: () => tasksApi.history(t.id) as Promise<HistoryEntry[]>,
      staleTime: 5 * 60_000,
    })),
  });
  const historyById = useMemo<Record<string, HistoryEntry[]>>(() => {
    const map: Record<string, HistoryEntry[]> = {};
    dailyTasks.forEach((t, i) => { map[t.id] = (historyQueries[i]?.data as HistoryEntry[]) || []; });
    return map;
  }, [dailyTasks, historyQueries]);

  // Mantém a ordem persistida sincronizada com as tarefas existentes.
  useEffect(() => {
    const ids = dailyTasks.map((t) => t.id);
    const filtered = order.filter((id) => ids.includes(id));
    const missing = ids.filter((id) => !filtered.includes(id));
    const next = [...filtered, ...missing];
    if (next.length !== order.length || next.some((id, i) => id !== order[i])) {
      setOrder(next);
      saveOrder(next);
    }
  }, [dailyTasks]); // eslint-disable-line react-hooks/exhaustive-deps

  const total = dailyTasks.length;
  const done = dailyTasks.filter((t) => t.completed).length;
  const pct = total > 0 ? Math.round((done / total) * 100) : 0;
  const allDone = total > 0 && done === total;

  const toggleCollapsed = (): void => {
    const next = !collapsed;
    setCollapsed(next);
    try { localStorage.setItem(COLLAPSE_KEY, String(next)); } catch { /* noop */ }
  };
  const toggleHideDone = (): void => {
    const next = !hideDone;
    setHideDone(next);
    try { localStorage.setItem(HIDE_DONE_KEY, String(next)); } catch { /* noop */ }
  };

  const handleDrop = useCallback((targetId: string): void => {
    if (!dragId || dragId === targetId) { setDragId(null); return; }
    const current = orderedTasks.map((t) => t.id);
    const from = current.indexOf(dragId);
    const to = current.indexOf(targetId);
    if (from < 0 || to < 0) { setDragId(null); return; }
    current.splice(to, 0, current.splice(from, 1)[0]);
    setOrder(current);
    saveOrder(current);
    setDragId(null);
  }, [dragId, orderedTasks]);

  const startFocus = (): void => { window.location.hash = "#/daily-focus"; };

  // Não mostra o painel se o usuário não tem nenhuma rotina diária para hoje.
  if (total === 0) return null;

  return (
    <div className={styles.panel}>
      {/* Cabeçalho */}
      <div className={styles.header}>
        <div className={styles.titleRow}>
          <button
            className={`${styles.collapseBtn} ${collapsed ? styles.collapseBtnClosed : ""}`}
            onClick={toggleCollapsed}
            aria-label={collapsed ? "Expandir painel" : "Recolher painel"}
            title={collapsed ? "Expandir" : "Recolher"}
          >
            ‹
          </button>
          <span className={styles.title} style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
            <Repeat size={15} /> Rotina Diária
          </span>
          <span className={`${styles.slot} ${allDone ? styles.slotFull : ""}`}>
            {done}/{total}
          </span>
          {allDone && (
            <span className={styles.doneToday} title="Todas as rotinas de hoje concluídas" style={{ display: "inline-flex", alignItems: "center", gap: 4 }}>
              <Check size={13} /> tudo feito hoje
            </span>
          )}
        </div>
        {!collapsed && (
          <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
            <button
              className={styles.addBtn}
              onClick={toggleHideDone}
              title={hideDone ? "Mostrar feitas" : "Ocultar feitas"}
              style={{ display: "inline-flex", alignItems: "center", gap: 6 }}
            >
              {hideDone ? <><Eye size={14} /> Mostrar feitas</> : <><EyeOff size={14} /> Ocultar feitas</>}
            </button>
            <button className={styles.addBtn} onClick={startFocus} title="Iniciar sessão de foco" style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
              <Play size={14} /> Foco
            </button>
          </div>
        )}
      </div>

      {/* Corpo colapsável */}
      {!collapsed && (
        <>
          {/* Barra de progresso */}
          <div className={styles.progressWrap}>
            <div className={styles.progressBar}>
              <div className={`${styles.progressFill} ${allDone ? styles.progressFillDone : ""}`} style={{ width: `${pct}%` }} />
            </div>
            <span className={styles.progressLabel}>
              {done} de {total} feita{total !== 1 ? "s" : ""} hoje
            </span>
          </div>

          {allDone && (
            <div style={{ display: "flex", justifyContent: "center", alignItems: "center", gap: 6, padding: "8px 12px", fontSize: 13, color: "var(--success)" }}>
              <PartyPopper size={15} /> Rotina do dia completa — manda ver amanhã!
            </div>
          )}

          {/* Lista de rotinas diárias */}
          <div className={styles.list}>
            {visibleTasks.map((task) => (
              <RoutineItem
                key={task.id}
                task={task}
                history={historyById[task.id] || []}
                busy={completingIds?.has(String(task.id)) ?? false}
                onComplete={onComplete}
                onReopen={onReopen}
                onToggleChecklist={onToggleChecklist}
                dragging={dragId === task.id}
                onDragStart={() => setDragId(task.id)}
                onDragEnd={() => setDragId(null)}
                onDropItem={() => handleDrop(task.id)}
                onOpenDetail={onOpenDetail ? () => onOpenDetail(task.id) : undefined}
              />
            ))}
          </div>
        </>
      )}
    </div>
  );
}

/* ─── Item de rotina ─────────────────────────────────────────────────────── */
interface RoutineItemProps {
  task: TaskRecord;
  history: HistoryEntry[];
  busy: boolean;
  onComplete: (id: string) => void;
  onReopen: (id: string) => void;
  onToggleChecklist?: (taskId: string, itemId: string) => void;
  dragging: boolean;
  onDragStart: () => void;
  onDragEnd: () => void;
  onDropItem: () => void;
  onOpenDetail?: () => void;
}

function RoutineItem({
  task, history, busy, onComplete, onReopen, onToggleChecklist,
  dragging, onDragStart, onDragEnd, onDropItem, onOpenDetail,
}: RoutineItemProps): JSX.Element {
  const [expanded, setExpanded] = useState<boolean>(false);
  const dotColor = PRIORITY_COLORS[task.priority] || "var(--text-muted)";
  const isDone = task.completed;

  const doneSet = useMemo(() => completedDateSet(history), [history]);
  const streak = useMemo(() => computeStreak(doneSet), [doneSet]);
  const week = useMemo(() => last7Days().map((d) => ({ ...d, done: doneSet.has(d.iso) })), [doneSet]);

  const rootSubtasks = useMemo<ChecklistLite[]>(
    () => (task.checklist || []).filter((c) => !c.parent_id) as unknown as ChecklistLite[],
    [task.checklist]
  );
  const hasSubtasks = rootSubtasks.length > 0;

  return (
    <div
      className={styles.taskBlock}
      draggable
      onDragStart={onDragStart}
      onDragEnd={onDragEnd}
      onDragOver={(e) => e.preventDefault()}
      onDrop={onDropItem}
      style={{ opacity: dragging ? 0.5 : 1 }}
    >
      <span className={styles.priorityBar} style={{ background: isDone ? "var(--success)" : dotColor }} aria-hidden />
      <div className={`${styles.taskItem} ${isDone ? styles.taskDone : ""}`}>
        {/* Alça de arraste */}
        <span
          title="Arraste para reordenar"
          style={{ display: "inline-flex", cursor: "grab", color: "var(--text-muted)", userSelect: "none" }}
        >
          <GripVertical size={14} />
        </span>

        {/* Concluir / reabrir */}
        <button
          className={styles.checkBtn}
          disabled={busy}
          style={{
            borderColor: isDone ? "var(--success)" : "var(--border)",
            color: "#fff",
            background: isDone ? "var(--success)" : "transparent",
            opacity: busy ? 0.5 : 1,
          }}
          onClick={() => {
            haptic(isDone ? 5 : 12);
            isDone ? onReopen(String(task.id)) : onComplete(String(task.id));
          }}
          title={isDone ? "Reabrir" : "Concluir"}
          aria-label={isDone ? "Reabrir tarefa" : "Concluir tarefa"}
        >
          {isDone && <Check size={12} strokeWidth={3} />}
        </button>

        {/* Info — clique abre o modal de detalhes/edição */}
        <div
          className={styles.taskInfo}
          role={onOpenDetail ? "button" : undefined}
          tabIndex={onOpenDetail ? 0 : undefined}
          onClick={() => { if (onOpenDetail && !dragging) onOpenDetail(); }}
          onKeyDown={(e) => {
            if (onOpenDetail && (e.key === "Enter" || e.key === " ")) { e.preventDefault(); onOpenDetail(); }
          }}
          style={onOpenDetail ? { cursor: "pointer" } : undefined}
        >
          <span className={styles.taskTitle}>{task.title}</span>
          <span style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
            {streak > 0 && (
              <span
                title={`${streak} dia(s) seguido(s)`}
                style={{ display: "inline-flex", alignItems: "center", gap: 3, fontSize: 11, fontWeight: 600, color: "#f0a540" }}
              >
                <Flame size={11} /> {streak}
              </span>
            )}
            {task.recurrence === "weekdays" && (
              <span className={styles.taskSub}>dias úteis</span>
            )}
            {hasSubtasks && (
              <span className={styles.taskSub}>
                {task.checklist_completed_count}/{task.checklist_count} subtarefas
              </span>
            )}
            {/* Mini-heatmap dos últimos 7 dias */}
            <span style={{ display: "inline-flex", gap: 2 }}>
              {week.map((d, i) => (
                <span
                  key={i}
                  title={`${d.iso}${d.done ? " ✓" : ""}`}
                  style={{
                    width: 10, height: 10, borderRadius: 3,
                    background: d.done ? "var(--success)" : "var(--border)",
                    opacity: i === 6 && !d.done ? 0.9 : d.done ? 1 : 0.45,
                    outline: i === 6 ? "1.5px solid var(--accent)" : "none",
                    outlineOffset: i === 6 ? 1 : 0,
                  }}
                />
              ))}
            </span>
          </span>
        </div>

        {/* Expandir subtarefas */}
        {hasSubtasks && onToggleChecklist && (
          <button
            className={`${styles.expandBtn} ${expanded ? styles.expandBtnOpen : ""}`}
            onClick={() => setExpanded((v) => !v)}
            title={expanded ? "Fechar subtarefas" : "Ver subtarefas"}
          >
            ›
          </button>
        )}
      </div>

      {/* Subtarefas inline */}
      {expanded && hasSubtasks && onToggleChecklist && (
        <div className={styles.subtaskList}>
          {rootSubtasks.map((item) => (
            <div key={String(item.id)} className={styles.subtaskItem}>
              <button
                className={styles.subtaskCheck}
                style={{
                  borderColor: item.completed ? "var(--success)" : "var(--border)",
                  background: item.completed ? "var(--success)" : "transparent",
                  color: item.completed ? "#fff" : "transparent",
                }}
                onClick={() => onToggleChecklist(String(task.id), String(item.id))}
                title={item.completed ? "Desmarcar" : "Marcar como feita"}
              >
                {item.completed && <Check size={9} strokeWidth={3} />}
              </button>
              <span className={`${styles.subtaskLabel} ${item.completed ? styles.subtaskDone : ""}`}>
                {item.description}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
