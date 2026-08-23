import { useState } from "react";
import styles from "./session.module.css";

interface SubtaskInlineProps {
  taskId: string;
  onAdd?: (taskId: string, text: string) => Promise<void>;
}

/**
 * Botão + formulário inline para adicionar subtarefa a uma tarefa.
 * Se `onAdd` não for fornecido, não renderiza nada.
 */
export default function SubtaskInline({ taskId, onAdd }: SubtaskInlineProps) {
  const [show, setShow] = useState<boolean>(false);
  const [text, setText] = useState<string>("");
  const [saving, setSaving] = useState<boolean>(false);

  if (!onAdd) return null;

  const reset = (): void => { setShow(false); setText(""); };

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>): Promise<void> => {
    e.preventDefault();
    if (!text.trim()) return;
    setSaving(true);
    try {
      await onAdd(taskId, text.trim());
      reset();
    } finally {
      setSaving(false);
    }
  };

  if (!show) {
    return (
      <button className={`${styles.btn} ${styles.btnSecondary}`} onClick={() => setShow(true)}>
        📌 Adicionar subtarefa
      </button>
    );
  }

  return (
    <form onSubmit={handleSubmit} className={styles.subtaskInline}>
      <input
        className={styles.input}
        value={text}
        onChange={(e) => setText(e.target.value)}
        placeholder="Descrição da subtarefa..."
        autoFocus
      />
      <div className={styles.actionsRow}>
        <button
          type="submit"
          className={`${styles.btn} ${styles.btnPrimary}`}
          disabled={!text.trim() || saving}
        >
          {saving ? "…" : "✓ Adicionar"}
        </button>
        <button type="button" className={`${styles.btn} ${styles.btnSecondary}`} onClick={reset}>
          Cancelar
        </button>
      </div>
    </form>
  );
}
