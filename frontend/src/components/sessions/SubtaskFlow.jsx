import styles from "./session.module.css";

/**
 * SubtaskFlow — exibe subtarefas com liberdade de ordem.
 *
 * Props:
 *   checklist   : array de { id, description, completed }
 *   onToggle    : async (itemId) => void  — chamado ao concluir qualquer subtarefa
 *   onAllDone   : () => void              — chamado quando todas as subtarefas estão feitas
 *   onSkip      : () => void (opcional)   — "Pular subtarefas / concluir tarefa direto"
 */
export default function SubtaskFlow({ checklist, onToggle, onAllDone, onSkip }) {
  const done    = checklist.filter((i) => i.completed);
  const pending = checklist.filter((i) => !i.completed);
  const total   = checklist.length;

  /* ── Todas concluídas ── */
  if (pending.length === 0) {
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

  /* ── Subtarefas pendentes — qualquer uma pode ser concluída ── */
  return (
    <div className={styles.subtaskFlow}>
      {/* Progresso */}
      <div className={styles.subtaskProgress}>
        <span className={styles.subtaskProgressLabel}>
          {done.length} de {total} subtarefa{total !== 1 ? "s" : ""} concluída{done.length !== 1 ? "s" : ""}
        </span>
        <div className={styles.subtaskProgressBar}>
          <div
            className={styles.subtaskProgressFill}
            style={{ width: `${(done.length / total) * 100}%` }}
          />
        </div>
      </div>

      {/* Itens já feitos (riscados) */}
      {done.map((item) => (
        <div key={item.id} className={`${styles.checklistRow} ${styles.checklistRowDone}`}>
          <span className={styles.checklistBox}>✓</span>
          <span className={styles.checklistRowText}>{item.description}</span>
        </div>
      ))}

      {/* Subtarefas pendentes — todas clicáveis */}
      {pending.map((item) => (
        <button
          key={item.id}
          className={`${styles.subtaskPendingBtn}`}
          onClick={() => onToggle(item.id)}
        >
          <span className={styles.checklistBox} />
          <span className={styles.checklistRowText}>{item.description}</span>
          <span className={styles.subtaskDoneHint}>✓ feito</span>
        </button>
      ))}

      {onSkip && (
        <button
          className={`${styles.btn} ${styles.btnSecondary}`}
          style={{ marginTop: 10 }}
          onClick={onSkip}
        >
          Pular e concluir tarefa direto
        </button>
      )}
    </div>
  );
}
