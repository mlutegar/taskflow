import { useState } from "react";
import { routineSchema } from "../lib/schemas";
import styles from "./AddRoutineForm.module.css";

export default function AddRoutineForm({ onSubmit, onCancel }) {
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [hasTarget, setHasTarget] = useState(false);
  const [targetValue, setTargetValue] = useState("");
  const [unit, setUnit] = useState("");
  const [saving, setSaving] = useState(false);
  const [errors, setErrors] = useState({});

  const validate = () => {
    const result = routineSchema.safeParse({
      title: title.trim(),
      description: description.trim(),
      target_value: hasTarget && targetValue !== "" ? Number(targetValue) : null,
      unit: hasTarget && unit ? unit.trim() : null,
    });
    if (!result.success) {
      const fieldErrors = {};
      for (const issue of result.error.issues) {
        const field = issue.path[0];
        if (field && !fieldErrors[field]) fieldErrors[field] = issue.message;
      }
      setErrors(fieldErrors);
      return false;
    }
    setErrors({});
    return true;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!validate()) return;
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

      <div className={styles.field}>
        <input
          className={`${styles.input}${errors.title ? " " + styles.inputError : ""}`}
          value={title}
          onChange={(e) => { setTitle(e.target.value); if (errors.title) setErrors((p) => ({ ...p, title: undefined })); }}
          placeholder="Nome da rotina *"
          autoFocus
        />
        {errors.title && <span className={styles.errorMsg}>{errors.title}</span>}
      </div>

      <div className={styles.field}>
        <textarea
          className={`${styles.textarea}${errors.description ? " " + styles.inputError : ""}`}
          value={description}
          onChange={(e) => { setDescription(e.target.value); if (errors.description) setErrors((p) => ({ ...p, description: undefined })); }}
          placeholder="Descrição (opcional)"
          rows={2}
        />
        {errors.description && <span className={styles.errorMsg}>{errors.description}</span>}
      </div>

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
              className={`${styles.input}${errors.target_value ? " " + styles.inputError : ""}`}
              value={targetValue}
              onChange={(e) => { setTargetValue(e.target.value); if (errors.target_value) setErrors((p) => ({ ...p, target_value: undefined })); }}
              placeholder="Ex: 4.5"
              min="0"
              step="0.1"
            />
            {errors.target_value && <span className={styles.errorMsg}>{errors.target_value}</span>}
          </div>
          <div className={styles.field}>
            <label className={styles.label}>Unidade</label>
            <input
              className={`${styles.input}${errors.unit ? " " + styles.inputError : ""}`}
              value={unit}
              onChange={(e) => { setUnit(e.target.value); if (errors.unit) setErrors((p) => ({ ...p, unit: undefined })); }}
              placeholder="Ex: L, hrs, vezes"
            />
            {errors.unit && <span className={styles.errorMsg}>{errors.unit}</span>}
          </div>
        </div>
      )}

      <div className={styles.actions}>
        <button type="submit" className={styles.btnSubmit} disabled={saving}>
          {saving ? "Salvando..." : "Criar rotina"}
        </button>
        <button type="button" className={styles.btnCancel} onClick={onCancel}>
          Cancelar
        </button>
      </div>
    </form>
  );
}
