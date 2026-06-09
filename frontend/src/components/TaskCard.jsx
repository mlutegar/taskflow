import { useState, useEffect, useRef, useMemo } from "react";
import styles from "./TaskCard.module.css";

// Item de checklist recursivo: permite subtarefas dentro de subtarefas.
function ChecklistNode({ item, childrenMap, taskId, taskCompleted, depth, onToggle, onUpdate, onDelete, onAdd }) {
  const [adding, setAdding] = useState(false);
  const [text, setText] = useState("");
  const [editing, setEditing] = useState(false);
  const [editText, setEditText] = useState(item.description);
  const children = childrenMap.get(item.id) || [];

  const handleAddChild = async (e) => {
    e.preventDefault();
    if (!text.trim()) return;
    await onAdd(taskId, text.trim(), item.id);
    setText("");
    setAdding(false);
  };

  const handleSaveEdit = async (e) => {
    e.preventDefault();
    const trimmed = editText.trim();
    if (!trimmed || trimmed === item.description) {
      setEditing(false);
      return;
    }
    await onUpdate(taskId, item.id, trimmed);
    setEditing(false);
  };

  return (
    <div className={styles.checklistNode} style={depth > 0 ? { marginLeft: 18 } : undefined}>
      {editing ? (
        <form className={styles.checklistForm} onSubmit={handleSaveEdit}>
          <input
            className={styles.checklistInput}
            value={editText}
            onChange={(e) => setEditText(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Escape") { setEditText(item.description); setEditing(false); } }}
            autoFocus
          />
          <button type="submit" className={styles.checklistAdd} disabled={!editText.trim()} title="Salvar">✓</button>
          <button
            type="button"
            className={styles.checklistDelete}
            onClick={() => { setEditText(item.description); setEditing(false); }}
            title="Cancelar"
          >✕</button>
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
            className={item.completed ? styles.checklistTextDone : ""}
            onDoubleClick={() => !taskCompleted && setEditing(true)}
            title={!taskCompleted ? "Clique duplo para editar" : undefined}
          >{item.description}</span>
          {!taskCompleted && (
            <button
              className={styles.checklistDelete}
              onClick={() => setEditing(true)}
              title="Editar"
            >✎</button>
          )}
          {!taskCompleted && (
            <button
              className={styles.checklistDelete}
              onClick={() => setAdding((v) => !v)}
              title="Adicionar subtarefa"
            >＋</button>
          )}
          <button
            className={styles.checklistDelete}
            onClick={() => onDelete(taskId, item.id)}
            title="Remover item"
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

// Quantos dias faltam até a data de entrega (0 = hoje, negativo = atrasada).
function daysUntil(dueDate) {
  if (!dueDate) return null;
  const [y, m, d] = dueDate.split("-").map(Number);
  const due = new Date(y, m - 1, d);
  const today = new Date(new Date().toDateString());
  return Math.round((due - today) / 86400000);
}

const plural = (n, sing, plur) => `${n} ${Math.abs(n) === 1 ? sing : plur}`;

// Texto do contador regressivo.
function countdownLabel(days) {
  if (days == null) return null;
  if (days < 0) return `⏳ Atrasada ${plural(Math.abs(days), "dia", "dias")}`;
  if (days === 0) return "⏳ É hoje!";
  return `⏳ Faltam ${plural(days, "dia", "dias")}`;
}

// Calcula o ritmo necessário das subtarefas para cumprir o prazo.
// Ex.: 10 subtarefas em 20 dias → "1 subtarefa a cada 2 dias".
//      20 subtarefas em 5 dias  → "4 subtarefas por dia".
function pacePlan(days, pending) {
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

export default function TaskCard({ task, onComplete, onReopen, onDelete, onUpdate, onAddChecklist, onToggleChecklist, onUpdateChecklist, onDeleteChecklist }) {
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

  // Contador de dias + ritmo das subtarefas pendentes.
  const daysLeft = task.completed ? null : daysUntil(task.due_date);
  const pendingChecklist = (task.checklist_count || 0) - (task.checklist_completed_count || 0);
  const countdown = task.completed ? null : countdownLabel(daysLeft);
  const pace = task.completed ? null : pacePlan(daysLeft, pendingChecklist);

  // Monta a árvore do checklist: agrupa filhos por parent_id e ordena cada nível.
  const { rootItems, childrenMap } = useMemo(() => {
    const map = new Map();
    for (const item of task.checklist) {
      const key = item.parent_id ?? null;
      if (!map.has(key)) map.set(key, []);
      map.get(key).push(item);
    }
    for (const list of map.values()) {
      list.sort((a, b) => a.order - b.order || a.id - b.id);
    }
    return { rootItems: map.get(null) || [], childrenMap: map };
  }, [task.checklist]);

  const handleSaveEdit = async () => {
    setSaving(true);
    try {
      const payload = {
        title: editData.title.trim(),
        description: editData.description.trim() || null,
        priority: Number(editData.priority),
        due_date: editData.due_date || null,
        recurrence: editData.recurrence || null,
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
          <select
            className={styles.editSelect}
            value={editData.recurrence}
            onChange={(e) => setEditData((d) => ({ ...d, recurrence: e.target.value }))}
          >
            <option value="">Sem repetição</option>
            <option value="daily">🔄 Todo dia</option>
            <option value="weekly">🔄 Toda semana</option>
            <option value="biweekly">🔄 A cada 2 semanas</option>
            <option value="monthly">🔄 Todo mês</option>
          </select>
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
            {countdown && (
              <span className={`${styles.countdownBadge} ${daysLeft < 0 ? styles.countdownLate : daysLeft === 0 ? styles.countdownToday : ""}`}>
                {countdown}
              </span>
            )}
            {task.recurrence && (
              <span className={styles.recurrenceBadge}>
                🔄 {RECURRENCE_LABELS[task.recurrence]}
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

      {rescheduleFlash && (
        <div className={styles.rescheduleFlash}>
          🔄 Reagendado para {formatDate(rescheduleFlash)}
        </div>
      )}

      {expanded && (
        <div className={styles.detail}>
          {task.description && <p className={styles.description}>{task.description}</p>}

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
  );
}
