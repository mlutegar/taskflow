import { useState, useEffect, useMemo } from "react";
import TaskSelector from "./TaskSelector";
import styles from "./TodayPanel.module.css";

const DAILY_LIMIT = 5;

function todayKey() {
  return `todayTasks_${new Date().toISOString().split("T")[0]}`;
}

function loadTodayIds() {
  try {
    const raw = localStorage.getItem(todayKey());
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

/* ─── Item ───────────────────────────────────────────────────────────────── */
const PRIORITY_COLORS = { 1: "var(--critical)", 2: "var(--high)", 3: "var(--medium)", 4: "var(--low)" };

function TodayTaskItem({ task, onComplete, onReopen, onRemove }) {
  const dotColor = PRIORITY_COLORS[task.priority] || "var(--text-muted)";
  const done = task.completed;

  return (
    <div className={`${styles.taskItem} ${done ? styles.taskDone : ""}`}>
      <button
        className={styles.checkBtn}
        style={{
          borderColor: dotColor,
          color: done ? "#fff" : "transparent",
          background: done ? dotColor : "transparent",
        }}
        onClick={() => (done ? onReopen(task.id) : onComplete(task.id))}
        title={done ? "Reabrir" : "Concluir"}
      >
        ✓
      </button>
      <div className={styles.taskInfo}>
        <span className={styles.taskTitle}>{task.title}</span>
        {task.checklist_count > 0 && (
          <span className={styles.taskSub}>
            {task.checklist_completed_count}/{task.checklist_count} subtarefas
          </span>
        )}
      </div>
      <button
        className={styles.removeBtn}
        onClick={() => onRemove(task.id)}
        title="Remover do dia"
      >
        ✕
      </button>
    </div>
  );
}

/* ─── TodayPanel ─────────────────────────────────────────────────────────── */
export default function TodayPanel({ tasks, onComplete, onReopen }) {
  const [todayIds, setTodayIds] = useState(loadTodayIds);
  const [showPicker, setShowPicker] = useState(false);

  const todayTasks = useMemo(() => {
    const map = new Map(tasks.map((t) => [t.id, t]));
    return todayIds.map((id) => map.get(id)).filter(Boolean);
  }, [tasks, todayIds]);

  // Remove IDs de tarefas que foram deletadas
  useEffect(() => {
    const validIds = new Set(tasks.map((t) => t.id));
    const cleaned = todayIds.filter((id) => validIds.has(id));
    if (cleaned.length !== todayIds.length) {
      setTodayIds(cleaned);
    }
  }, [tasks]); // eslint-disable-line

  useEffect(() => {
    localStorage.setItem(todayKey(), JSON.stringify(todayIds));
  }, [todayIds]);

  const pickerTasks = useMemo(
    () => tasks.filter((t) => !t._isRoutine && !todayIds.includes(t.id)),
    [tasks, todayIds]
  );

  const count = todayTasks.length;

  const handleSelect = (item) => {
    if (todayIds.includes(item.id) || count >= DAILY_LIMIT) return;
    setTodayIds((prev) => [...prev, item.id]);
    if (count + 1 >= DAILY_LIMIT) setShowPicker(false);
  };

  const handleRemove = (id) => setTodayIds((prev) => prev.filter((i) => i !== id));

  const completedCount = todayTasks.filter((t) => t.completed).length;
  const canAdd = count < DAILY_LIMIT;
  const pct = count > 0 ? Math.round((completedCount / count) * 100) : 0;

  return (
    <div className={styles.panel}>
      {/* Cabeçalho */}
      <div className={styles.header}>
        <div className={styles.titleRow}>
          <span className={styles.title}>Tarefas de Hoje</span>
          <span className={`${styles.slot} ${count >= DAILY_LIMIT ? styles.slotFull : ""}`}>
            {count}/{DAILY_LIMIT}
          </span>
        </div>
        {canAdd && (
          <button className={styles.addBtn} onClick={() => setShowPicker((v) => !v)}>
            {showPicker ? "✕ Fechar" : "+ Selecionar"}
          </button>
        )}
      </div>

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

      {/* Lista vazia */}
      {todayTasks.length === 0 && !showPicker && (
        <div className={styles.empty}>
          <span>Nenhuma tarefa selecionada para hoje.</span>
          <button className={styles.emptyLink} onClick={() => setShowPicker(true)}>
            Selecionar agora →
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
            />
          ))}
          {todayIds.length >= DAILY_LIMIT && (
            <div className={styles.limitMsg}>
              Limite diário de {DAILY_LIMIT} tarefas atingido
            </div>
          )}
        </div>
      )}
    </div>
  );
}
