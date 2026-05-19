import { useState } from "react";
import styles from "./RoutineCard.module.css";

const TODAY = new Date().toISOString().split("T")[0];

function yesterday() {
  const d = new Date();
  d.setDate(d.getDate() - 1);
  return d.toISOString().split("T")[0];
}

export default function RoutineCard({
  routine,
  onComplete,
  onUncomplete,
  onCompleteForDate,
  onDelete,
  onUpdate,
  onAddProgress,
  onAddChecklist,
  onToggleChecklist,
  onDeleteChecklist,
}) {
  const [expanded, setExpanded] = useState(false);
  const [editing, setEditing] = useState(false);
  const [editData, setEditData] = useState({
    title: routine.title,
    description: routine.description || "",
    target_value: routine.target_value ?? "",
    unit: routine.unit || "",
  });
  const [progressInput, setProgressInput] = useState("");
  const [checklistInput, setChecklistInput] = useState("");
  const [saving, setSaving] = useState(false);
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [pastDate, setPastDate] = useState(yesterday);

  const hasTarget = routine.target_value != null;
  const pct = routine.progress_percentage ?? 0;

  const handleSaveEdit = async () => {
    setSaving(true);
    try {
      await onUpdate(routine.id, {
        title: editData.title.trim(),
        description: editData.description.trim() || null,
        target_value: editData.target_value !== "" ? Number(editData.target_value) : null,
        unit: editData.unit.trim() || null,
      });
      setEditing(false);
    } finally {
      setSaving(false);
    }
  };

  const handleAddProgress = async (e) => {
    e.preventDefault();
    const val = parseFloat(progressInput);
    if (isNaN(val) || val <= 0) return;
    await onAddProgress(routine.id, val);
    setProgressInput("");
  };

  const handleAddChecklist = async (e) => {
    e.preventDefault();
    if (!checklistInput.trim()) return;
    await onAddChecklist(routine.id, checklistInput.trim());
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
            <input
              type="number"
              className={styles.editInput}
              value={editData.target_value}
              onChange={(e) => setEditData((d) => ({ ...d, target_value: e.target.value }))}
              placeholder="Meta (ex: 4.5)"
              min="0"
              step="0.1"
            />
            <input
              className={styles.editInput}
              value={editData.unit}
              onChange={(e) => setEditData((d) => ({ ...d, unit: e.target.value }))}
              placeholder="Unidade (ex: L, hrs)"
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
    <div className={`${styles.card} ${routine.is_completed_today ? styles.done : ""}`}>
      <div className={styles.main}>
        <button
          className={`${styles.checkBtn} ${routine.is_completed_today ? styles.checkDone : ""}`}
          onClick={() => !routine.is_completed_today && onComplete(routine.id)}
          title={routine.is_completed_today ? "Concluída hoje" : "Marcar como concluída"}
          disabled={routine.is_completed_today}
        >
          {routine.is_completed_today && "✓"}
        </button>

        <div className={styles.content} onClick={() => setExpanded((v) => !v)}>
          <div className={styles.titleRow}>
            <span className={styles.title}>{routine.title}</span>
            <span className={`${styles.badge} ${routine.is_completed_today ? styles.badgeDone : styles.badgePending}`}>
              {routine.is_completed_today ? "✓ Hoje" : "Pendente"}
            </span>
          </div>

          {hasTarget && (
            <div className={styles.progressWrap}>
              <div className={styles.progressBar}>
                <div className={styles.progressFill} style={{ width: `${pct}%` }} />
              </div>
              <span className={styles.progressLabel}>
                {routine.current_progress}/{routine.target_value} {routine.unit || ""} · {pct.toFixed(0)}%
              </span>
            </div>
          )}

          {!hasTarget && routine.checklist_count > 0 && (
            <div className={styles.meta}>
              <span>☑ {routine.checklist_completed_count}/{routine.checklist_count} itens</span>
            </div>
          )}
        </div>

        <div className={styles.actions}>
          {routine.is_completed_today && (
            <button className={`${styles.actionBtn} ${styles.uncompleteBtn}`} onClick={() => onUncomplete(routine.id)} title="Desfazer conclusão">↩</button>
          )}
          <button
            className={`${styles.actionBtn} ${showDatePicker ? styles.datePickerBtnActive : ""}`}
            onClick={() => setShowDatePicker((v) => !v)}
            title="Marcar como feito em outro dia"
          >
            📅
          </button>
          <button className={styles.actionBtn} onClick={() => setEditing(true)} title="Editar">✏️</button>
          <button className={`${styles.actionBtn} ${styles.deleteBtn}`} onClick={() => onDelete(routine.id)} title="Deletar">🗑</button>
        </div>
      </div>

      {showDatePicker && (
        <div className={styles.datePickerRow}>
          <span className={styles.datePickerLabel}>Marcar como feito em:</span>
          <input
            type="date"
            className={styles.datePickerInput}
            value={pastDate}
            max={TODAY}
            onChange={(e) => setPastDate(e.target.value)}
          />
          <button
            className={styles.datePickerConfirm}
            disabled={!pastDate || routine.completion_history.includes(pastDate)}
            onClick={async () => {
              await onCompleteForDate(routine.id, pastDate);
              setShowDatePicker(false);
            }}
          >
            {routine.completion_history.includes(pastDate) ? "Já marcado" : "Confirmar"}
          </button>
          <button className={styles.datePickerCancel} onClick={() => setShowDatePicker(false)}>Cancelar</button>
        </div>
      )}

      {expanded && (
        <div className={styles.detail}>
          {routine.description && <p className={styles.description}>{routine.description}</p>}

          {hasTarget && !routine.is_completed_today && (
            <form className={styles.progressForm} onSubmit={handleAddProgress}>
              <input
                type="number"
                className={styles.progressInput}
                value={progressInput}
                onChange={(e) => setProgressInput(e.target.value)}
                placeholder={`Adicionar ${routine.unit || "progresso"}...`}
                min="0.01"
                step="0.01"
              />
              <button type="submit" className={styles.progressAddBtn} disabled={!progressInput}>
                + Progresso
              </button>
            </form>
          )}

          {(routine.checklist.length > 0 || !routine.is_completed_today) && (
            <div className={styles.checklist}>
              {routine.checklist.map((item) => (
                <div key={item.id} className={styles.checklistItem}>
                  <button
                    className={`${styles.checklistCheck} ${item.completed ? styles.checklistDone : ""}`}
                    onClick={() => onToggleChecklist(routine.id, item.id)}
                  >
                    {item.completed && "✓"}
                  </button>
                  <span className={item.completed ? styles.checklistTextDone : ""}>{item.description}</span>
                  <button
                    className={styles.checklistDelete}
                    onClick={() => onDeleteChecklist(routine.id, item.id)}
                  >✕</button>
                </div>
              ))}

              {!routine.is_completed_today && (
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
