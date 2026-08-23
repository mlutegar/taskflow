import { useState, useMemo } from "react";
import styles from "./TaskSelector.module.css";

/* ─── Constantes ─────────────────────────────────────────────────────────── */
const PRIORITY_COLORS: Record<number, string> = { 1: "var(--critical)", 2: "var(--high)", 3: "var(--medium)", 4: "var(--low)" };
const PRIORITY_LABELS: Record<number, string> = { 1: "Crítica", 2: "Alta", 3: "Média", 4: "Baixa" };
const ROUTINE_COLOR   = "#4ecca3";

const SORT_OPTIONS: { value: string; label: string }[] = [
  { value: "priority",         label: "Prioridade" },
  { value: "due_date",         label: "Data de vencimento" },
  { value: "subtask_progress", label: "Progresso de subtarefas" },
  { value: "updated_at",       label: "Última modificação" },
  { value: "last_subtask",     label: "Última subtarefa feita" },
];

const CHECKLIST_OPTS: { value: string; label: string }[] = [
  { value: "all",        label: "Qualquer" },
  { value: "has",        label: "Com subtarefas" },
  { value: "none",       label: "Sem subtarefas" },
  { value: "incomplete", label: "Incompletas" },
  { value: "complete",   label: "Todas feitas" },
];

const DATE_OPTS: { value: string; label: string }[] = [
  { value: "all",     label: "Qualquer data" },
  { value: "has",     label: "Com data" },
  { value: "overdue", label: "Vencidas" },
];

/* ─── Types ──────────────────────────────────────────────────────────────── */
interface ChecklistItem {
  completed: boolean;
  updated_at?: string;
}

interface Task {
  id: string | number;
  title?: string;
  description?: string;
  priority?: number;
  completed?: boolean;
  due_date?: string;
  updated_at?: string;
  checklist?: ChecklistItem[];
  checklist_count?: number;
  checklist_completed_count?: number;
  _isRoutine?: boolean;
  target_value?: number | null;
  current_progress?: number;
  unit?: string;
}

interface FilterState {
  priorities: Set<number>;
  checklist: string;
  date: string;
}

/* ─── Helpers ────────────────────────────────────────────────────────────── */
function lastSubtaskDoneAt(task: Task): number {
  if (!task.checklist?.length) return 0;
  const times = task.checklist
    .filter((c) => c.completed && c.updated_at)
    .map((c) => new Date(c.updated_at!).getTime());
  return times.length ? Math.max(...times) : 0;
}

function applyFilters(tasks: Task[], { priorities, checklist, date }: FilterState): Task[] {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  return tasks.filter((t) => {
    // Prioridade — só aplica em tarefas normais (não rotinas)
    if (priorities.size > 0 && !t._isRoutine) {
      if (!priorities.has(t.priority!)) return false;
    }

    // Subtarefas
    const count = t.checklist_count ?? 0;
    const done  = t.checklist_completed_count ?? 0;
    if (checklist === "has"        && count === 0)                  return false;
    if (checklist === "none"       && count > 0)                    return false;
    if (checklist === "incomplete" && (count === 0 || done === count)) return false;
    if (checklist === "complete"   && (count === 0 || done < count)) return false;

    // Data
    if (date === "has" && !t.due_date) return false;
    if (date === "overdue") {
      if (!t.due_date) return false;
      if (new Date(t.due_date) >= today) return false;
    }

    return true;
  });
}

function applySort(tasks: Task[], sortBy: string): Task[] {
  const arr = [...tasks];
  switch (sortBy) {
    case "priority":
      return arr.sort((a, b) => (a.priority ?? 99) - (b.priority ?? 99));

    case "due_date":
      return arr.sort((a, b) => {
        if (!a.due_date && !b.due_date) return 0;
        if (!a.due_date) return 1;
        if (!b.due_date) return -1;
        return new Date(a.due_date).getTime() - new Date(b.due_date).getTime();
      });

    case "subtask_progress":
      return arr.sort((a, b) => {
        const pA = a.checklist_count ? (a.checklist_completed_count ?? 0) / a.checklist_count : -1;
        const pB = b.checklist_count ? (b.checklist_completed_count ?? 0) / b.checklist_count : -1;
        return pB - pA;
      });

    case "updated_at":
      return arr.sort((a, b) => {
        if (!a.updated_at && !b.updated_at) return 0;
        if (!a.updated_at) return 1;
        if (!b.updated_at) return -1;
        return new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime();
      });

    case "last_subtask":
      return arr.sort((a, b) => lastSubtaskDoneAt(b) - lastSubtaskDoneAt(a));

    default:
      return arr;
  }
}

/* ─── Item ───────────────────────────────────────────────────────────────── */
interface ItemProps {
  item: Task;
  onSelect: (item: Task) => void;
}

function Item({ item, onSelect }: ItemProps): JSX.Element {
  const isRoutine  = !!item._isRoutine;
  const dotColor   = isRoutine ? ROUTINE_COLOR : PRIORITY_COLORS[item.priority!];
  const badgeLabel = isRoutine ? "Rotina" : (PRIORITY_LABELS[item.priority!] || "—");

  const count = item.checklist_count ?? 0;
  const done  = item.checklist_completed_count ?? 0;
  const pct   = count > 0 ? Math.round((done / count) * 100) : null;

  return (
    <button className={styles.item} onClick={() => onSelect(item)}>
      <span className={styles.dot} style={{ background: dotColor }} />
      <div className={styles.info}>
        <span className={styles.taskTitle}>{item.title}</span>
        {item.description && <span className={styles.desc}>{item.description}</span>}
        {count > 0 && (
          <div className={styles.subtaskRow}>
            <span className={styles.subtaskCount}>
              ☑ {done}/{count} subtarefa{count !== 1 ? "s" : ""}
            </span>
            <div className={styles.miniBar}>
              <div className={styles.miniBarFill} style={{ width: `${pct}%` }} />
            </div>
            <span className={styles.subtaskPct}>{pct}%</span>
          </div>
        )}
        {isRoutine && item.target_value != null && (
          <span className={styles.subtaskCount}>
            📊 {item.current_progress ?? 0}/{item.target_value} {item.unit || ""}
          </span>
        )}
        {item.due_date && (
          <span className={styles.dueDate}>
            {(() => {
              const d = new Date(item.due_date);
              const today = new Date(); today.setHours(0,0,0,0);
              const overdue = d < today;
              return (
                <span style={{ color: overdue ? "var(--critical)" : "var(--text-muted)" }}>
                  {overdue ? "⚠ " : "📅 "}
                  {d.toLocaleDateString("pt-BR", { day: "2-digit", month: "short" })}
                </span>
              );
            })()}
          </span>
        )}
      </div>
      <span className={styles.badge} style={{ color: dotColor }}>{badgeLabel}</span>
    </button>
  );
}

/* ─── FilterChip ─────────────────────────────────────────────────────────── */
interface ChipProps {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
  color?: string;
}

function Chip({ active, onClick, children, color }: ChipProps): JSX.Element {
  return (
    <button
      className={`${styles.chip} ${active ? styles.chipActive : ""}`}
      style={active && color ? { borderColor: color, color, background: `${color}18` } : {}}
      onClick={onClick}
    >
      {children}
    </button>
  );
}

/* ─── TaskSelector ───────────────────────────────────────────────────────── */
interface TaskSelectorProps {
  tasks: Task[];
  onSelect: (item: Task) => void;
  onCancel?: () => void;
}

export default function TaskSelector({ tasks, onSelect, onCancel }: TaskSelectorProps): JSX.Element {
  const [showFilters, setShowFilters] = useState<boolean>(false);
  const [sortBy,      setSortBy]      = useState<string>("priority");
  const [priorities,  setPriorities]  = useState<Set<number>>(new Set());
  const [checklist,   setChecklist]   = useState<string>("all");
  const [date,        setDate]        = useState<string>("all");
  const [search,      setSearch]      = useState<string>("");

  const active = tasks.filter((t) => !t.completed);

  const filtered = useMemo(() => {
    const f = applyFilters(active, { priorities, checklist, date });
    const q = search.trim().toLowerCase();
    const searched = q
      ? f.filter((t) =>
          t.title?.toLowerCase().includes(q) ||
          t.description?.toLowerCase().includes(q)
        )
      : f;
    return applySort(searched, sortBy);
  }, [active, priorities, checklist, date, sortBy, search]);

  const regularTasks = filtered.filter((t) => !t._isRoutine);
  const routines     = filtered.filter((t) => t._isRoutine);
  const hasGroups    = regularTasks.length > 0 && routines.length > 0;

  const togglePriority = (p: number): void => {
    setPriorities((prev) => {
      const next = new Set(prev);
      next.has(p) ? next.delete(p) : next.add(p);
      return next;
    });
  };

  const hasActiveFilters = priorities.size > 0 || checklist !== "all" || date !== "all";

  const resetFilters = (): void => {
    setPriorities(new Set());
    setChecklist("all");
    setDate("all");
  };

  return (
    <div className={styles.root}>
      {/* ── Cabeçalho ── */}
      <div className={styles.header}>
        <span className={styles.title}>Selecionar Tarefa</span>
        <div className={styles.headerActions}>
          <button
            className={`${styles.filterToggle} ${hasActiveFilters ? styles.filterToggleActive : ""}`}
            onClick={() => setShowFilters((v) => !v)}
            title="Filtros e ordenação"
          >
            {hasActiveFilters ? "⚙ Filtros •" : "⚙ Filtros"}
          </button>
          {onCancel && <button className={styles.closeBtn} onClick={onCancel}>✕</button>}
        </div>
      </div>

      {/* ── Busca ── */}
      <div className={styles.searchRow}>
        <span className={styles.searchIcon}>🔍</span>
        <input
          className={styles.searchInput}
          type="text"
          placeholder="Pesquisar tarefa..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          autoFocus
        />
        {search && (
          <button
            className={styles.searchClear}
            onClick={() => setSearch("")}
            title="Limpar busca"
          >
            ✕
          </button>
        )}
      </div>

      {/* ── Painel de filtros ── */}
      {showFilters && (
        <div className={styles.filterPanel}>
          {/* Ordenação */}
          <div className={styles.filterRow}>
            <span className={styles.filterLabel}>Ordenar por</span>
            <select
              className={styles.sortSelect}
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value)}
            >
              {SORT_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>{o.label}</option>
              ))}
            </select>
          </div>

          {/* Prioridade */}
          <div className={styles.filterRow}>
            <span className={styles.filterLabel}>Prioridade</span>
            <div className={styles.chips}>
              {[1, 2, 3, 4].map((p) => (
                <Chip
                  key={p}
                  active={priorities.has(p)}
                  color={PRIORITY_COLORS[p]}
                  onClick={() => togglePriority(p)}
                >
                  {PRIORITY_LABELS[p]}
                </Chip>
              ))}
            </div>
          </div>

          {/* Subtarefas */}
          <div className={styles.filterRow}>
            <span className={styles.filterLabel}>Subtarefas</span>
            <div className={styles.chips}>
              {CHECKLIST_OPTS.map((o) => (
                <Chip
                  key={o.value}
                  active={checklist === o.value}
                  onClick={() => setChecklist(o.value)}
                >
                  {o.label}
                </Chip>
              ))}
            </div>
          </div>

          {/* Data */}
          <div className={styles.filterRow}>
            <span className={styles.filterLabel}>Data</span>
            <div className={styles.chips}>
              {DATE_OPTS.map((o) => (
                <Chip
                  key={o.value}
                  active={date === o.value}
                  onClick={() => setDate(o.value)}
                >
                  {o.label}
                </Chip>
              ))}
            </div>
          </div>

          {hasActiveFilters && (
            <button className={styles.resetBtn} onClick={resetFilters}>
              ✕ Limpar filtros
            </button>
          )}
        </div>
      )}

      {/* ── Lista ── */}
      {active.length === 0 ? (
        <div className={styles.empty}>
          <span>📭</span>
          <span>Nenhuma tarefa ativa. Adicione tarefas na aba Tarefas.</span>
        </div>
      ) : filtered.length === 0 ? (
        <div className={styles.empty}>
          <span>🔍</span>
          <span>Nenhuma tarefa encontrada com esses filtros.</span>
          <button className={styles.resetBtn} style={{ marginTop: 4 }} onClick={resetFilters}>
            Limpar filtros
          </button>
        </div>
      ) : (
        <div className={styles.list}>
          {hasGroups && <div className={styles.groupLabel}>📋 Tarefas</div>}
          {regularTasks.map((t) => <Item key={t.id} item={t} onSelect={onSelect} />)}
          {routines.length > 0 && (
            <>
              {hasGroups && <div className={styles.groupLabel}>🔄 Rotinas</div>}
              {routines.map((r) => <Item key={r.id} item={r} onSelect={onSelect} />)}
            </>
          )}
        </div>
      )}
    </div>
  );
}
