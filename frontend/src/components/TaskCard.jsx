import { useState, useEffect, useRef } from "react";
import styles from "./TaskCard.module.css";

const RECURRENCE_LABELS = {
  daily: "Todo dia",
  weekly: "Toda semana",
  biweekly: "A cada 2 semanas",
  monthly: "Todo mês",
};

const PRIORITY_MAP = {
  1: { label: "Crítica", cls: "critical" },
  2: { label: "Alta", cls: "high" },
  3: { label: "Média", cls: "medium" },
  4: { label: "Baixa", cls: "low" },
};

function formatDate(str) {
  if (!str) return null;
  const [y, m, d] = str.split("-");
  return `${d}/${m}/${y}`;
}

function isOverdue(dueDate, completed) {
  if (!dueDate || completed) return false;
  return new Date(dueDate) < new Date(new Date().toDateString());
}

export default function TaskCard({ task, onComplete, onReopen, onDelete, onUpdate, onAddChecklist, onToggleChecklist, onDeleteChecklist }) {
  const [expanded, setExpanded] = useState(false);
  const [editing, setEditing] = useState(false);
  const [editData, setEditData] = useState({
    title: task.title,
    description: task.description || "",
    priority: task.priority,
    due_date: task.due_date || "",
    recurrence: task.recurrence || "",
  });
  const [checklistInput, setChecklistInput] = useState("");
  const [saving, setSaving] = useState(false);
  const [rescheduleFlash, setRescheduleFlash] = useState(null);
  const prevDueDateRef = useRef(task.due_date);

  useEffect(() => {
    if (task.recurrence && task.due_date !== prevDueDateRef.current) {
      setRescheduleFlash(task.due_date);
      prevDueDateRef.current = task.due_date;
      const t = setTimeout(() => setRescheduleFlash(null), 3500);
      return () => clearTimeout(t);
    }
    prevDueDateRef.current = task.due_date;
  }, [task.due_date, task.recurrence]);

  const priority = PRIORITY_MAP[task.priority] || PRIORITY_MAP[4];
  const overdue = isOverdue(task.due_date, task.completed);

  const handleSaveEdit = async () => {
    setSaving(true);
    try {
      const payload = {
        title: editData.title.trim(),
        description: editData.description.trim() || null,
        priority: Number(editData.priority),
        due_date: editData.due_date || null,
      };
      await onUpdate(task.id, payload);
      setEditing(false);
    } finally {
      setSaving(false);
    }
  };

  const handleAddChecklist = async (e) => {
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
              onChange={(e) => setEditData((d) => ({ ...d, priority: e.target.value }))}
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

  return (
    <div className={`${styles.card} ${task.completed ? styles.completed : ""}`}>
      <div className={styles.main}>
        <button
          className={`${styles.checkbox} ${task.completed ? styles.checkboxDone : ""}`}
          onClick={() => task.completed ? onReopen(task.id) : onComplete(task.id)}
          title={task.completed ? "Reabrir" : "Concluir"}
        >
          {task.completed && "✓"}
        </button>

        <div className={styles.content} onClick={() => setExpanded((v) => !v)}>
          <div className={styles.titleRow}>
            <span className={styles.title}>{task.title}</span>
            <span className={`${styles.priority} ${styles[priority.cls]}`}>{priority.label}</span>
          </div>

          <div className={styles.meta}>
            {task.due_date && (
              <span className={`${styles.metaItem} ${overdue ? styles.overdue : ""}`}>
                📅 {formatDate(task.due_date)}{overdue && " · Atrasada"}
              </span>
            )}
            {task.checklist_count > 0 && (
              <span className={styles.metaItem}>
                ☑ {task.checklist_completed_count}/{task.checklist_count}
              </span>
            )}
            {task.description && <span className={styles.metaItem}>📝</span>}
          </div>
        </div>

        <div className={styles.actions}>
          <button className={styles.actionBtn} onClick={() => setEditing(true)} title="Editar">✏️</button>
          <button className={`${styles.actionBtn} ${styles.deleteBtn}`} onClick={() => onDelete(task.id)} title="Deletar">🗑</button>
        </div>
      </div>

      {expanded && (
        <div className={styles.detail}>
          {task.description && <p className={styles.description}>{task.description}</p>}

          {(task.checklist.length > 0 || !task.completed) && (
            <div className={styles.checklist}>
              {task.checklist.map((item) => (
                <div key={item.id} className={styles.checklistItem}>
                  <button
                    className={`${styles.checklistCheck} ${item.completed ? styles.checklistDone : ""}`}
                    onClick={() => onToggleChecklist(task.id, item.id)}
                  >
                    {item.completed && "✓"}
                  </button>
                  <span className={item.completed ? styles.checklistTextDone : ""}>{item.description}</span>
                  <button
                    className={styles.checklistDelete}
                    onClick={() => onDeleteChecklist(task.id, item.id)}
                    title="Remover item"
                  >✕</button>
                </div>
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
  );
}
