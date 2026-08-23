import { useState } from "react";
import { taskSchema } from "../lib/schemas";
import styles from "./AddTaskForm.module.css";

interface AddTaskFormProps {
  onSubmit: (task: {
    title: string;
    description: string | null;
    priority: number;
    due_date: string | null;
    recurrence: string | null;
  }) => Promise<void>;
  onCancel: () => void;
}

interface FieldErrors {
  title?: string;
  description?: string;
  due_date?: string;
  [key: string]: string | undefined;
}

export default function AddTaskForm({ onSubmit, onCancel }: AddTaskFormProps) {
  const [title, setTitle] = useState<string>("");
  const [description, setDescription] = useState<string>("");
  const [priority, setPriority] = useState<number>(4);
  const [dueDate, setDueDate] = useState<string>("");
  const [recurrence, setRecurrence] = useState<string>("");
  const [saving, setSaving] = useState<boolean>(false);
  const [errors, setErrors] = useState<FieldErrors>({});

  const validate = (): boolean => {
    const result = taskSchema.safeParse({
      title: title.trim(),
      description: description.trim(),
      priority: Number(priority),
      due_date: dueDate,
      recurrence: recurrence,
    });
    if (!result.success) {
      const fieldErrors: FieldErrors = {};
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
        priority: Number(priority),
        due_date: dueDate || null,
        recurrence: recurrence || null,
      });
    } finally {
      setSaving(false);
    }
  };

  return (
    <form className={styles.form} onSubmit={handleSubmit}>
      <h3 className={styles.heading}>Nova Tarefa</h3>

      <div className={styles.field}>
        <input
          className={`${styles.input}${errors.title ? " " + styles.inputError : ""}`}
          value={title}
          onChange={(e: React.ChangeEvent<HTMLInputElement>) => { setTitle(e.target.value); if (errors.title) setErrors((p) => ({ ...p, title: undefined })); }}
          placeholder="Título da tarefa *"
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

      <div className={styles.row}>
        <div className={styles.field}>
          <label className={styles.label}>Prioridade</label>
          <select
            className={styles.select}
            value={priority}
            onChange={(e: React.ChangeEvent<HTMLSelectElement>) => setPriority(Number(e.target.value))}
          >
            <option value={1}>🔴 Crítica</option>
            <option value={2}>🟠 Alta</option>
            <option value={3}>🟡 Média</option>
            <option value={4}>🟢 Baixa</option>
          </select>
        </div>

        <div className={styles.field}>
          <label className={styles.label}>Vencimento</label>
          <input
            type="date"
            className={`${styles.input}${errors.due_date ? " " + styles.inputError : ""}`}
            value={dueDate}
            onChange={(e: React.ChangeEvent<HTMLInputElement>) => { setDueDate(e.target.value); if (errors.due_date) setErrors((p) => ({ ...p, due_date: undefined })); }}
          />
          {errors.due_date && <span className={styles.errorMsg}>{errors.due_date}</span>}
        </div>
        <div className={styles.field}>
          <label className={styles.label}>Repetição</label>
          <select
            className={styles.select}
            value={recurrence}
            onChange={(e: React.ChangeEvent<HTMLSelectElement>) => setRecurrence(e.target.value)}
          >
            <option value="">Sem repetição</option>
            <option value="daily">Todo dia</option>
            <option value="weekly">Toda semana</option>
            <option value="biweekly">A cada 2 semanas</option>
            <option value="monthly">Todo mês</option>
          </select>
        </div>
      </div>

      <div className={styles.actions}>
        <button type="submit" className={styles.btnSubmit} disabled={saving}>
          {saving ? "Salvando..." : "Criar tarefa"}
        </button>
        <button type="button" className={styles.btnCancel} onClick={onCancel}>
          Cancelar
        </button>
      </div>
    </form>
  );
}
