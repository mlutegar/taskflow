import { useState } from "react";
import styles from "./AddRoutineForm.module.css";

export default function AddRoutineForm({ onSubmit, onCancel }) {
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [hasTarget, setHasTarget] = useState(false);
  const [targetValue, setTargetValue] = useState("");
  const [unit, setUnit] = useState("");
  const [saving, setSaving] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!title.trim()) return;
    setSaving(true);
    try {
      await onSubmit({
        title: title.trim(),
        description: description.trim() || null,
        target_value: hasTarget && targetValue ? Number(targetValue) : null,
        unit: hasTarget && unit ? unit.trim() : null,
      });
    } finally {
      setSaving(false);
    }
  };

  return (
    <form className={styles.form} onSubmit={handleSubmit}>
      <h3 className={styles.heading}>Nova Rotina</h3>

      <input
        className={styles.input}
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        placeholder="Nome da rotina *"
        required
        autoFocus
      />

      <textarea
        className={styles.textarea}
        value={description}
        onChange={(e) => setDescription(e.target.value)}
        placeholder="Descrição (opcional)"
        rows={2}
      />

      <label className={styles.toggle}>
        <input
          type="checkbox"
          checked={hasTarget}
          onChange={(e) => setHasTarget(e.target.checked)}
        />
        <span>Tem meta quantificável? (ex: 4,5L de água)</span>
      </label>

      {hasTarget && (
        <div className={styles.row}>
          <div className={styles.field}>
            <label className={styles.label}>Meta</label>
            <input
              type="number"
              className={styles.input}
              value={targetValue}
              onChange={(e) => setTargetValue(e.target.value)}
              placeholder="Ex: 4.5"
              min="0"
              step="0.1"
            />
          </div>
          <div className={styles.field}>
            <label className={styles.label}>Unidade</label>
            <input
              className={styles.input}
              value={unit}
              onChange={(e) => setUnit(e.target.value)}
              placeholder="Ex: L, hrs, vezes"
            />
          </div>
        </div>
      )}

      <div className={styles.actions}>
        <button type="submit" className={styles.btnSubmit} disabled={saving || !title.trim()}>
          {saving ? "Salvando..." : "Criar rotina"}
        </button>
        <button type="button" className={styles.btnCancel} onClick={onCancel}>
          Cancelar
        </button>
      </div>
    </form>
  );
}
