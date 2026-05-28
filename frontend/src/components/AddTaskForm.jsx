import { useState } from "react";
import styles from "./AddTaskForm.module.css";

export default function AddTaskForm({ onSubmit, onCancel }) {
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [priority, setPriority] = useState(4);
  const [dueDate, setDueDate] = useState("");
  const [recurrence, setRecurrence] = useState("");
  const [saving, setSaving] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!title.trim()) return;
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

      <input
        className={styles.input}
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        placeholder="Título da tarefa *"
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

      <div className={styles.row}>
        <div className={styles.field}>
          <label className={styles.label}>Prioridade</label>
          <select
            className={styles.select}
            value={priority}
            onChange={(e) => setPriority(e.target.value)}
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
            className={styles.input}
            value={dueDate}
            onChange={(e) => setDueDate(e.target.value)}
          />
        </div>
      </div>

      <div className={styles.actions}>
        <button type="submit" className={styles.btnSubmit} disabled={saving || !title.trim()}>
          {saving ? "Salvando..." : "Criar tarefa"}
        </button>
        <button type="button" className={styles.btnCancel} onClick={onCancel}>
          Cancelar
        </button>
      </div>
    </form>
  );
}
