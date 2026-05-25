import styles from "./TaskSelector.module.css";

const PRIORITY_COLORS = { 1: "var(--critical)", 2: "var(--high)", 3: "var(--medium)", 4: "var(--low)" };
const PRIORITY_LABELS = { 1: "Crítica", 2: "Alta", 3: "Média", 4: "Baixa" };
const ROUTINE_COLOR = "#4ecca3";

function Item({ item, onSelect }) {
  const isRoutine = !!item._isRoutine;
  const dotColor = isRoutine ? ROUTINE_COLOR : PRIORITY_COLORS[item.priority];
  const badgeColor = isRoutine ? ROUTINE_COLOR : PRIORITY_COLORS[item.priority];
  const badgeLabel = isRoutine ? "Rotina" : (PRIORITY_LABELS[item.priority] || "—");

  return (
    <button className={styles.item} onClick={() => onSelect(item)}>
      <span className={styles.dot} style={{ background: dotColor }} />
      <div className={styles.info}>
        <span className={styles.taskTitle}>{item.title}</span>
        {item.description && <span className={styles.desc}>{item.description}</span>}
        {item.checklist_count > 0 && (
          <span className={styles.subtaskCount}>
            ☑ {item.checklist_completed_count}/{item.checklist_count} subtarefa{item.checklist_count !== 1 ? "s" : ""}
          </span>
        )}
        {isRoutine && item.target_value != null && (
          <span className={styles.subtaskCount}>
            📊 {item.current_progress ?? 0}/{item.target_value} {item.unit || ""}
          </span>
        )}
      </div>
      <span className={styles.badge} style={{ color: badgeColor }}>{badgeLabel}</span>
    </button>
  );
}

export default function TaskSelector({ tasks, onSelect, onCancel }) {
  const active = tasks.filter((t) => !t.completed);
  const regularTasks = active.filter((t) => !t._isRoutine);
  const routines = active.filter((t) => t._isRoutine);
  const hasGroups = regularTasks.length > 0 && routines.length > 0;

  return (
    <div className={styles.root}>
      <div className={styles.header}>
        <span className={styles.title}>Selecionar Tarefa</span>
        {onCancel && <button className={styles.closeBtn} onClick={onCancel}>✕</button>}
      </div>

      {active.length === 0 ? (
        <div className={styles.empty}>
          <span>📭</span>
          <span>Nenhuma tarefa ativa. Adicione tarefas na aba Tarefas.</span>
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
