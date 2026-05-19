import TaskCard from "./TaskCard";
import styles from "./TaskList.module.css";

export default function TaskList({ tasks, onComplete, onReopen, onDelete, onUpdate, onAddChecklist, onToggleChecklist, onDeleteChecklist }) {
  if (tasks.length === 0) {
    return (
      <div className={styles.empty}>
        <span className={styles.emptyIcon}>✓</span>
        <p>Nenhuma tarefa aqui.</p>
      </div>
    );
  }

  return (
    <div className={styles.list}>
      {tasks.map((task) => (
        <TaskCard
          key={task.id}
          task={task}
          onComplete={onComplete}
          onReopen={onReopen}
          onDelete={onDelete}
          onUpdate={onUpdate}
          onAddChecklist={onAddChecklist}
          onToggleChecklist={onToggleChecklist}
          onDeleteChecklist={onDeleteChecklist}
        />
      ))}
    </div>
  );
}
