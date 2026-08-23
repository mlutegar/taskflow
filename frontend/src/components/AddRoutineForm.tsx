import { useState } from "react";
import { routineSchema } from "../lib/schemas";
import styles from "./AddRoutineForm.module.css";

interface AddRoutineFormProps {
  onSubmit: (data: {
    title: string;
    description: string | null;
    target_value: number | null;
    unit: string | null;
  }) => Promise<void>;
  onCancel: () => void;
}

export default function AddRoutineForm({ onSubmit, onCancel }: AddRoutineFormProps) {
  const [title, setTitle] = useState<string>("");
  const [description, setDescription] = useState<string>("");
  const [hasTarget, setHasTarget] = useState<boolean>(false);
  const [targetValue, setTargetValue] = useState<string>("");
  const [unit, setUnit] = useState<string>("");
  const [saving, setSaving] = useState<boolean>(false);
  const [errors, setErrors] = useState<Record<string, string | undefined>>({});

  const validate = (): boolean => {
    const result = routineSchema.safeParse({
      title: title.trim(),
      description: description.trim(),
      target_value: hasTarget && targetValue !== "" ? Number(targetValue) : null,
      unit: hasTarget && unit ? unit.trim() : null,
    });
    if (!result.success) {
      const fieldErrors: Record<string, string> = {};
      for (const issue of result.error.issues) {
        const field = issue.path[0] as string;
        if (field && !fieldErrors[field]) fieldErrors[field] = issue.message;
      }
      setErrors(fieldErrors);
      return false;
    }
    setErrors({});
    return true;
  };

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>): Promise<void> => {
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
          onChange={(e: React.ChangeEvent<HTMLInputElement>) => { setTitle(e.target.value); if (errors.title) setErrors((p) => ({ ...p, title: undefined })); }}
          placeholder="Nome da rotina *"
          autoFocus
        />
        {errors.title && <span className={styles.errorMsg}>{errors.title}</span>}
      </div>

      <div className={styles.field}>
        <textarea
          className={`${styles.textarea}${errors.description ? " " + styles.inputError : ""}`}
          value={description}
          onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => { setDescription(e.target.value); if (errors.description) setErrors((p) => ({ ...p, description: undefined })); }}
          placeholder="Descrição (opcional)"
          rows={2}
        />
        {errors.description && <span className={styles.errorMsg}>{errors.description}</span>}
      </div>

      <label className={styles.toggle}>
        <input
          type="checkbox"
          checked={hasTarget}
          onChange={(e: React.ChangeEvent<HTMLInputElement>) => setHasTarget(e.target.checked)}
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
              onChange={(e: React.ChangeEvent<HTMLInputElement>) => { setTargetValue(e.target.value); if (errors.target_value) setErrors((p) => ({ ...p, target_value: undefined })); }}
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
              onChange={(e: React.ChangeEvent<HTMLInputElement>) => { setUnit(e.target.value); if (errors.unit) setErrors((p) => ({ ...p, unit: undefined })); }}
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
