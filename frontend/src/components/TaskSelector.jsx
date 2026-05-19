import styles from "./TaskSelector.module.css";

const PRIORITY_COLORS = { 1: "var(--critical)", 2: "var(--high)", 3: "var(--medium)", 4: "var(--low)" };
const PRIORITY_LABELS = { 1: "Crítica", 2: "Alta", 3: "Média", 4: "Baixa" };

export default function TaskSelector({ tasks, onSelect, onCancel }) {
  const active = tasks.filter((t) => !t.completed);

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
          {active.map((task) => (
            <button key={task.id} className={styles.item} onClick={() => onSelect(task)}>
              <span className={styles.dot} style={{ background: PRIORITY_COLORS[task.priority] }} />
              <div className={styles.info}>
                <span className={styles.taskTitle}>{task.title}</span>
                {task.description && <span className={styles.desc}>{task.description}</span>}
              </div>
              <span className={styles.badge} style={{ color: PRIORITY_COLORS[task.priority] }}>
                {PRIORITY_LABELS[task.priority] || "—"}
              </span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
