import { useMemo, useState, useEffect } from "react";
import {
  CalendarClock, ArrowDownUp, ArrowUpToLine, CheckCircle2, AlertTriangle,
  ChevronUp, ChevronDown, Check, Clock, Plus, Calendar, Sparkles, Circle,
} from "lucide-react";
import styles from "./TodayPanel.module.css";
import { TaskRecord } from "../types/tasks";
import { isDailyToday, addDaysISO, daysBetweenISO, nextMondayISO } from "../lib/dailyRoutine";
import { todayISO, ISOtoPtBR } from "../lib/dateUtils";
import { getPermission, scheduleTaskReminder } from "../lib/notifications";

/* Vibração tátil curta (ignorada se o browser não suportar) */
function haptic(ms: number = 10): void {
  try { if (navigator.vibrate) navigator.vibrate(ms); } catch { /* noop */ }
}

const PRIORITY_COLORS: Record<number, string> = {
  1: "var(--critical)", 2: "var(--high)", 3: "var(--medium)", 4: "var(--low)",
};
function PriorityDot({ priority }: { priority: number }): JSX.Element {
  const color = PRIORITY_COLORS[priority] || "var(--text-muted)";
  return <Circle size={11} color={color} fill={color} />;
}

const COLLAPSE_KEY = "dueTodayPanel_collapsed";
const SORT_KEY = "dueTodayPanel_overdueSort";

interface DueTodayPanelProps {
  tasks: TaskRecord[];
  onComplete: (id: string) => void;
  onUpdate: (id: string, payload: unknown) => Promise<unknown>;
  onAddFocus?: (id: string) => void;
  onToggleChecklist?: (taskId: string, itemId: string) => void;
  completingIds?: Set<string>;
  onOpenDetail?: (id: number | string) => void;
}

export default function DueTodayPanel({
  tasks, onComplete, onUpdate, onAddFocus, onToggleChecklist, completingIds, onOpenDetail,
}: DueTodayPanelProps): JSX.Element | null {
  const today = todayISO();
  const [collapsed, setCollapsed] = useState<boolean>(() => {
    try { return localStorage.getItem(COLLAPSE_KEY) === "true"; } catch { return false; }
  });
  const [overdueSort, setOverdueSort] = useState<"age" | "priority">(() => {
    try { return (localStorage.getItem(SORT_KEY) as "age" | "priority") || "age"; } catch { return "age"; }
  });
  const [showNoDue, setShowNoDue] = useState<boolean>(false);
  const [busyBulk, setBusyBulk] = useState<boolean>(false);

  const base = useMemo(
    () => tasks.filter((t) => !t.completed && !isDailyToday(t.recurrence)),
    [tasks]
  );

  const overdue = useMemo(() => {
    const list = base.filter((t) => t.due_date && t.due_date < today);
    return list.sort((a, b) => {
      if (overdueSort === "priority") return a.priority - b.priority || (a.due_date! < b.due_date! ? -1 : 1);
      return a.due_date! < b.due_date! ? -1 : a.due_date! > b.due_date! ? 1 : a.priority - b.priority;
    });
  }, [base, today, overdueSort]);

  const dueToday = useMemo(
    () => base.filter((t) => t.due_date === today).sort((a, b) => a.priority - b.priority || a.title.localeCompare(b.title)),
    [base, today]
  );
  const noDue = useMemo(
    () => base.filter((t) => !t.due_date).sort((a, b) => a.priority - b.priority || a.title.localeCompare(b.title)),
    [base]
  );

  // #11 — reagendamento inteligente: dia menos carregado nos próximos 7 dias.
  const leastLoadedDay = useMemo(() => {
    const load: Record<string, number> = {};
    for (const t of tasks) {
      if (!t.completed && t.due_date && t.due_date > today) load[t.due_date] = (load[t.due_date] || 0) + 1;
    }
    let best = addDaysISO(today, 1); let bestCount = Infinity;
    for (let i = 1; i <= 7; i++) {
      const d = addDaysISO(today, i);
      const c = load[d] || 0;
      if (c < bestCount) { bestCount = c; best = d; }
    }
    return best;
  }, [tasks, today]);

  // #12 — agenda lembretes para tarefas de hoje que têm hora definida.
  useEffect(() => {
    if (getPermission() !== "granted") return;
    const timers: ReturnType<typeof setTimeout>[] = [];
    for (const t of dueToday) {
      if (t.due_time) {
        const id = scheduleTaskReminder({ id: t.id, title: t.title, due_date: `${t.due_date}T${t.due_time}` });
        if (id) timers.push(id);
      }
    }
    return () => timers.forEach(clearTimeout);
  }, [dueToday]);

  // #9 — agrupar atrasadas por idade. (useMemo ANTES de qualquer return — Regra dos Hooks)
  const overdueGroups = useMemo(() => {
    const groupOf = (iso: string): string => {
      const late = daysBetweenISO(iso, today);
      if (late <= 1) return "Ontem";
      if (late <= 7) return "Esta semana";
      return "Há mais de 7 dias";
    };
    const groups: { label: string; items: TaskRecord[] }[] = [
      { label: "Ontem", items: [] }, { label: "Esta semana", items: [] }, { label: "Há mais de 7 dias", items: [] },
    ];
    for (const t of overdue) groups.find((g) => g.label === groupOf(t.due_date!))!.items.push(t);
    return groups.filter((g) => g.items.length > 0);
  }, [overdue, today]);

  const totalMain = overdue.length + dueToday.length;
  if (totalMain === 0 && noDue.length === 0) return null;

  const toggleCollapsed = (): void => {
    const next = !collapsed;
    setCollapsed(next);
    try { localStorage.setItem(COLLAPSE_KEY, String(next)); } catch { /* noop */ }
  };
  const toggleSort = (): void => {
    const next = overdueSort === "age" ? "priority" : "age";
    setOverdueSort(next);
    try { localStorage.setItem(SORT_KEY, next); } catch { /* noop */ }
  };

  const bulkPushToToday = async (): Promise<void> => {
    if (busyBulk || overdue.length === 0) return;
    setBusyBulk(true);
    try {
      for (const t of overdue) await onUpdate(String(t.id), { due_date: today });
    } finally { setBusyBulk(false); }
  };

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
            <CalendarClock size={15} /> Hoje &amp; Atrasadas
          </span>
          {overdue.length > 0 && (
            <span className={styles.slot} style={{ background: "var(--critical)", color: "#fff" }}>
              {overdue.length} atrasada{overdue.length !== 1 ? "s" : ""}
            </span>
          )}
          <span className={styles.slot}>{dueToday.length} hoje</span>
        </div>
        {!collapsed && overdue.length > 0 && (
          <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
            <button className={styles.addBtn} onClick={toggleSort} title="Alternar ordenação das atrasadas" style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
              <ArrowDownUp size={13} /> {overdueSort === "age" ? "Antigas" : "Críticas"}
            </button>
            <button className={styles.addBtn} onClick={bulkPushToToday} disabled={busyBulk} title="Reagendar todas as atrasadas para hoje" style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
              {busyBulk ? "…" : <><ArrowUpToLine size={13} /> Trazer p/ hoje</>}
            </button>
          </div>
        )}
      </div>

      {!collapsed && (
        <>
          {totalMain === 0 && (
            <div style={{ display: "flex", justifyContent: "center", alignItems: "center", gap: 6, padding: "8px 12px", fontSize: 13, color: "var(--success)" }}>
              <CheckCircle2 size={15} /> Nada vencido nem para hoje.
            </div>
          )}

          {/* Atrasadas agrupadas por idade */}
          {overdueGroups.map((group) => (
            <div key={group.label}>
              <div style={{ padding: "6px 12px 2px", fontSize: 11, fontWeight: 700, color: "var(--critical)", textTransform: "uppercase", letterSpacing: 0.5 }}>
                {group.label} ({group.items.length})
              </div>
              <div className={styles.list}>
                {group.items.map((task) => (
                  <DueItem
                    key={task.id} task={task} today={today} overdue noDue={false}
                    busy={completingIds?.has(String(task.id)) ?? false}
                    leastLoadedDay={leastLoadedDay}
                    onComplete={onComplete} onUpdate={onUpdate}
                    onAddFocus={onAddFocus} onToggleChecklist={onToggleChecklist}
                    onOpenDetail={onOpenDetail}
                  />
                ))}
              </div>
            </div>
          ))}

          {/* Hoje */}
          {dueToday.length > 0 && (
            <>
              <div style={{ padding: "6px 12px 2px", fontSize: 11, fontWeight: 700, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: 0.5 }}>
                Hoje ({dueToday.length})
              </div>
              <div className={styles.list}>
                {dueToday.map((task) => (
                  <DueItem
                    key={task.id} task={task} today={today} overdue={false} noDue={false}
                    busy={completingIds?.has(String(task.id)) ?? false}
                    leastLoadedDay={leastLoadedDay}
                    onComplete={onComplete} onUpdate={onUpdate}
                    onAddFocus={onAddFocus} onToggleChecklist={onToggleChecklist}
                    onOpenDetail={onOpenDetail}
                  />
                ))}
              </div>
            </>
          )}

          {/* Sinalizador de tarefas sem prazo */}
          {noDue.length > 0 && (
            <div style={{ borderTop: "1px solid var(--border)", padding: "8px 12px" }}>
              <button className={styles.addBtn} onClick={() => setShowNoDue((v) => !v)} style={{ display: "inline-flex", alignItems: "center", gap: 5, color: "#f0a540" }}>
                <AlertTriangle size={13} /> {noDue.length} sem prazo {showNoDue ? <ChevronUp size={13} /> : <ChevronDown size={13} />}
              </button>
              {showNoDue && (
                <div className={styles.list} style={{ marginTop: 6 }}>
                  {noDue.map((task) => (
                    <DueItem
                      key={task.id} task={task} today={today} overdue={false} noDue
                      busy={completingIds?.has(String(task.id)) ?? false}
                      leastLoadedDay={leastLoadedDay}
                      onComplete={onComplete} onUpdate={onUpdate}
                      onAddFocus={onAddFocus} onToggleChecklist={onToggleChecklist}
                    />
                  ))}
                </div>
              )}
            </div>
          )}
        </>
      )}
    </div>
  );
}

/* ─── Item ────────────────────────────────────────────────────────────────── */
interface DueItemProps {
  task: TaskRecord;
  today: string;
  overdue: boolean;
  noDue: boolean;
  busy: boolean;
  leastLoadedDay: string;
  onComplete: (id: string) => void;
  onUpdate: (id: string, payload: unknown) => Promise<unknown>;
  onAddFocus?: (id: string) => void;
  onToggleChecklist?: (taskId: string, itemId: string) => void;
  onOpenDetail?: (id: number | string) => void;
}

function DueItem({
  task, today, overdue, noDue, busy, leastLoadedDay,
  onComplete, onUpdate, onAddFocus, onToggleChecklist, onOpenDetail,
}: DueItemProps): JSX.Element {
  const [editingDate, setEditingDate] = useState<boolean>(false);
  const [expanded, setExpanded] = useState<boolean>(false);
  const dotColor = PRIORITY_COLORS[task.priority] || "var(--text-muted)";
  const lateDays = overdue && task.due_date ? daysBetweenISO(task.due_date, today) : 0;

  const rootSubtasks = useMemo(
    () => (task.checklist || []).filter((c) => !c.parent_id),
    [task.checklist]
  );
  const hasSubtasks = rootSubtasks.length > 0;

  const setDate = async (iso: string): Promise<void> => {
    await onUpdate(String(task.id), { due_date: iso });
    setEditingDate(false);
  };
  const setTime = async (hhmm: string): Promise<void> => {
    await onUpdate(String(task.id), { due_time: hhmm || null });
  };
  const cyclePriority = async (): Promise<void> => {
    const next = task.priority >= 4 ? 1 : task.priority + 1;
    await onUpdate(String(task.id), { priority: next });
  };

  return (
    <div className={styles.taskBlock}>
      <span className={styles.priorityBar} style={{ background: dotColor }} aria-hidden />
      <div className={styles.taskItem}>
        {/* Concluir */}
        <button
          className={styles.checkBtn}
          disabled={busy}
          style={{ borderColor: "var(--border)", color: "#fff", background: "transparent", opacity: busy ? 0.5 : 1 }}
          onClick={() => { haptic(12); onComplete(String(task.id)); }}
          title="Concluir" aria-label="Concluir tarefa"
        >
        </button>

        {/* Info — clique abre o modal de detalhes/edição */}
        <div
          className={styles.taskInfo}
          role={onOpenDetail ? "button" : undefined}
          tabIndex={onOpenDetail ? 0 : undefined}
          onClick={onOpenDetail ? () => onOpenDetail(task.id) : undefined}
          onKeyDown={onOpenDetail ? (e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); onOpenDetail(task.id); } } : undefined}
          style={onOpenDetail ? { cursor: "pointer" } : undefined}
        >
          <span className={styles.taskTitle}>{task.title}</span>
          <span style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
            {/* #4 badge de prioridade (clicável cicla) */}
            <button
              onClick={(e) => { e.stopPropagation(); cyclePriority(); }}
              title="Alterar prioridade"
              style={{ display: "inline-flex", alignItems: "center", background: "none", border: "none", cursor: "pointer", padding: 0 }}
            >
              <PriorityDot priority={task.priority} />
            </button>
            {noDue ? (
              <span className={styles.taskSub} style={{ color: "#f0a540" }}>sem prazo</span>
            ) : overdue ? (
              <span className={styles.taskSub} style={{ display: "inline-flex", alignItems: "center", gap: 5 }}>
                <span style={{
                  fontWeight: 700, fontSize: 10, color: "var(--critical)",
                  background: "var(--danger-bg)", border: "1px solid var(--danger-border)",
                  padding: "1px 6px", borderRadius: 99, whiteSpace: "nowrap",
                }}>
                  {lateDays}d atrasada
                </span>
                <span style={{ color: "var(--text-muted)" }}>{ISOtoPtBR(task.due_date!)}</span>
              </span>
            ) : (
              <span className={styles.taskSub}>vence hoje</span>
            )}
            {task.due_time && <span className={styles.taskSub} style={{ display: "inline-flex", alignItems: "center", gap: 3 }}><Clock size={11} /> {task.due_time}</span>}
            {hasSubtasks && (
              <span className={styles.taskSub}>{task.checklist_completed_count}/{task.checklist_count}</span>
            )}
          </span>
        </div>

        {/* Ações */}
        {hasSubtasks && onToggleChecklist && (
          <button className={`${styles.expandBtn} ${expanded ? styles.expandBtnOpen : ""}`} onClick={() => setExpanded((v) => !v)} title="Ver subtarefas">›</button>
        )}
        {onAddFocus && (
          <button className={styles.editBtn} onClick={() => onAddFocus(String(task.id))} title="Enviar para o foco (Tarefas de Hoje)" aria-label="Enviar para o foco"><Plus size={14} /></button>
        )}
        <button className={styles.editBtn} onClick={() => setEditingDate((v) => !v)} title="Redefinir data/hora" aria-label="Redefinir data e hora"><Calendar size={14} /></button>
      </div>

      {/* Editor de data/hora inline */}
      {editingDate && (
        <div style={{ display: "flex", gap: 6, flexWrap: "wrap", padding: "4px 0 8px 34px", alignItems: "center" }}>
          <button className={styles.addBtn} onClick={() => setDate(today)}>Hoje</button>
          <button className={styles.addBtn} onClick={() => setDate(addDaysISO(today, 1))}>Amanhã</button>
          <button className={styles.addBtn} onClick={() => setDate(nextMondayISO(today))}>Próx. seg</button>
          <button className={styles.addBtn} onClick={() => setDate(addDaysISO(today, 7))}>+1 semana</button>
          <button className={styles.addBtn} onClick={() => setDate(leastLoadedDay)} title={`Dia mais livre: ${ISOtoPtBR(leastLoadedDay)}`} style={{ display: "inline-flex", alignItems: "center", gap: 5 }}><Sparkles size={13} /> Livre ({ISOtoPtBR(leastLoadedDay).slice(0, 5)})</button>
          <input
            type="date"
            className={styles.editInput}
            defaultValue={task.due_date || today}
            style={{ maxWidth: 150 }}
            onChange={(e) => { if (e.target.value) setDate(e.target.value); }}
          />
          <input
            type="time"
            className={styles.editInput}
            defaultValue={task.due_time || ""}
            style={{ maxWidth: 110 }}
            title="Hora (opcional)"
            onChange={(e) => setTime(e.target.value)}
          />
        </div>
      )}

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
              <span className={`${styles.subtaskLabel} ${item.completed ? styles.subtaskDone : ""}`}>{item.description}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
