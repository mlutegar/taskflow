import styles from "./SessionSummary.module.css";

function formatDuration(minutes) {
  if (minutes < 60) return `${minutes} min`;
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return m > 0 ? `${h}h ${m}min` : `${h}h`;
}

function getMotivation(minutes) {
  if (minutes < 10) return "Bom começo! Todo início conta.";
  if (minutes < 30) return "Ótimo foco! Você avançou.";
  if (minutes < 60) return "Sessão sólida! Consistência vence.";
  return "Sessão épica! Isso é disciplina de alto nível. 🔥";
}

export default function SessionSummary({ mode, durationMinutes, tasksCompleted, onClose, onContinue }) {
  return (
    <div className={styles.overlay}>
      <div className={styles.card} style={{ borderTop: `4px solid ${mode?.color || '#7c6ef5'}` }}>
        <div className={styles.emoji}>{mode?.emoji || '✅'}</div>
        <h2 className={styles.modeName}>{mode?.name || 'Sessão concluída'}</h2>
        <div className={styles.duration}>{formatDuration(durationMinutes)}</div>
        <div className={styles.tasks}>
          {tasksCompleted > 0
            ? `${tasksCompleted} tarefa${tasksCompleted > 1 ? 's' : ''} concluída${tasksCompleted > 1 ? 's' : ''} 🎉`
            : 'Sessão registrada'}
        </div>
        <p className={styles.motivation}>{getMotivation(durationMinutes)}</p>
        <div className={styles.actions}>
          <button className={styles.btnClose} onClick={onClose}>Fechar</button>
          <button className={styles.btnContinue} onClick={onContinue}
            style={{ background: mode?.color || '#7c6ef5' }}>
            Continuar com este modo →
          </button>
        </div>
      </div>
    </div>
  );
}
