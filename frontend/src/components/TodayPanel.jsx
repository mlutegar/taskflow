import { useState, useEffect, useMemo } from "react";
import TaskSelector from "./TaskSelector";
import { dailyTasksApi } from "../api/dailyTasks";
import styles from "./TodayPanel.module.css";

const DAILY_LIMIT = 5;

function todayKey() {
  return `todayTasks_${new Date().toISOString().split("T")[0]}`;
}

function loadCachedIds() {
  try {
    const raw = localStorage.getItem(todayKey());
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function saveCachedIds(ids) {
  try {
    localStorage.setItem(todayKey(), JSON.stringify(ids));
  } catch {
    // ignora erros de storage
  }
}

/* ─── Cores de prioridade ─────────────────────────────────────────────────── */
const PRIORITY_COLORS = { 1: "var(--critical)", 2: "var(--high)", 3: "var(--medium)", 4: "var(--low)" };

/* ─── Subtarefa recursiva ────────────────────────────────────────────────── */
function SubtaskItem({ item, taskId, allItems, onToggle, depth = 0 }) {
  const [expanded, setExpanded] = useState(false);

  const children = allItems.filter((c) => c.parent_id === item.id);
  const hasChildren = children.length > 0;
  const childDone = children.filter((c) => c.completed).length;

  return (
    <div className={styles.subtaskBlock} style={{ "--depth": depth }}>
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

/* ─── Item de tarefa ─────────────────────────────────────────────────────── */
function TodayTaskItem({ task, onComplete, onReopen, onRemove, onToggleChecklist }) {
  const [expanded, setExpanded] = useState(false);
  const dotColor = PRIORITY_COLORS[task.priority] || "var(--text-muted)";
  const done = task.completed;

  const allItems = task.checklist || [];

  // Só subtarefas raiz (sem parent)
  const rootSubtasks = useMemo(
    () => allItems.filter((c) => !c.parent_id),
    [allItems]
  );

  const hasSubtasks = rootSubtasks.length > 0;
  const subDone = rootSubtasks.filter((c) => c.completed).length;

  return (
    <div className={styles.taskBlock}>
      <div className={`${styles.taskItem} ${done ? styles.taskDone : ""}`}>
        {/* Botão de conclusão */}
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

        {/* Remover do dia */}
        <button
          className={styles.removeBtn}
          onClick={() => onRemove(task.id)}
          title="Remover do dia"
        >
          ✕
        </button>
      </div>

      {/* Lista de subtarefas expandida */}
      {expanded && hasSubtasks && (
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
export default function TodayPanel({ tasks, completedToday = 0, onComplete, onReopen, onToggleChecklist }) {
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
          <span
            className={styles.doneToday}
            title="Total de tarefas concluídas hoje"
          >
            ✓ {completedToday} feita{completedToday !== 1 ? "s" : ""} hoje
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
              onToggleChecklist={onToggleChecklist}
            />
          ))}
          {count >= DAILY_LIMIT && (
            <div className={styles.limitMsg}>
              Limite diário de {DAILY_LIMIT} tarefas atingido
            </div>
          )}
        </div>
      )}
    </div>
  );
}
