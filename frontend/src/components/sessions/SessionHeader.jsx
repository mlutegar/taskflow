import styles from "./session.module.css";

/** Cabeçalho padrão das sessões de modo (emoji, título, subtítulo, fechar). */
export default function SessionHeader({ emoji, title, sub, onClose }) {
  return (
    <div className={styles.header}>
      <span className={styles.headerEmoji} aria-hidden="true">{emoji}</span>
      <div className={styles.headerMeta}>
        <span className={styles.headerTitle}>{title}</span>
        {sub != null && <span className={styles.headerSub}>{sub}</span>}
      </div>
      <button className={styles.closeBtn} onClick={onClose} aria-label="Fechar sessão">✕</button>
    </div>
  );
}
