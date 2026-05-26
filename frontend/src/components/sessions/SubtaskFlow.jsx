import styles from "./session.module.css";

/**
 * SubtaskFlow — exibe subtarefas uma a uma com auto-avanço.
 *
 * Props:
 *   checklist   : array de { id, description, completed }
 *   onToggle    : async (itemId) => void  — chamado ao concluir a subtarefa atual
 *   onAllDone   : () => void              — chamado quando todas as subtarefas estão feitas
 *   onSkip      : () => void (opcional)   — "Pular subtarefas / concluir tarefa direto"
 */
export default function SubtaskFlow({ checklist, onToggle, onAllDone, onSkip }) {
  const done    = checklist.filter((i) => i.completed);
  const pending = checklist.filter((i) => !i.completed);
  const current = pending[0];
  const total   = checklist.length;

  /* ── Todas concluídas ── */
  if (!current) {
    return (
      <div className={styles.subtaskFlow}>
        <div className={styles.subtaskFlowDone}>
          🎉 Todas as subtarefas concluídas!
        </div>
        {done.map((item) => (
          <div key={item.id} className={`${styles.checklistRow} ${styles.checklistRowDone}`}>
            <span className={styles.checklistBox}>✓</span>
            <span className={styles.checklistRowText}>{item.description}</span>
          </div>
        ))}
        <button
          className={`${styles.btn} ${styles.btnSuccess}`}
          style={{ marginTop: 10 }}
          onClick={onAllDone}
        >
          ✅ Concluir tarefa
        </button>
      </div>
    );
  }

  /* ── Subtarefa atual ── */
  return (
    <div className={styles.subtaskFlow}>
      {/* Progresso */}
      <div className={styles.subtaskProgress}>
        <span className={styles.subtaskProgressLabel}>
          Subtarefa {done.length + 1} de {total}
        </span>
        <div className={styles.subtaskProgressBar}>
          <div
            className={styles.subtaskProgressFill}
            style={{ width: `${(done.length / total) * 100}%` }}
          />
        </div>
      </div>

      {/* Itens já feitos (acima, riscados) */}
      {done.map((item) => (
        <div key={item.id} className={`${styles.checklistRow} ${styles.checklistRowDone}`}>
          <span className={styles.checklistBox}>✓</span>
          <span className={styles.checklistRowText}>{item.description}</span>
        </div>
      ))}

      {/* Subtarefa atual em destaque */}
      <div className={styles.subtaskCurrent}>
        <span className={styles.subtaskCurrentArrow}>→</span>
        <span className={styles.subtaskCurrentText}>{current.description}</span>
      </div>

      {/* Próximas subtarefas (dimmed) */}
      {pending.slice(1).map((item) => (
        <div key={item.id} className={`${styles.checklistRow} ${styles.checklistRowPending}`}>
          <span className={styles.checklistBox} />
          <span className={styles.checklistRowText}>{item.description}</span>
        </div>
      ))}

      {/* Ação */}
      <button
        className={`${styles.btn} ${styles.btnPrimary}`}
        style={{ marginTop: 10 }}
        onClick={() => onToggle(current.id)}
      >
        ✓ Feito → próxima
      </button>

      {onSkip && (
        <button
          className={`${styles.btn} ${styles.btnSecondary}`}
          onClick={onSkip}
        >
          Pular e concluir tarefa direto
        </button>
      )}
    </div>
  );
}
