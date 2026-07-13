import styles from "./session.module.css";

/** Banner "↩ Sessão restaurada" com botão de dispensar. */
export default function ResumeBanner({ show, onDismiss, children }) {
  if (!show) return null;
  return (
    <div className={styles.resumeBanner}>
      {children}
      <button className={styles.resumeDismiss} onClick={onDismiss} aria-label="Dispensar aviso">✕</button>
    </div>
  );
}
