import { ReactNode } from "react";
import styles from "./session.module.css";

interface ResumeBannerProps {
  show: boolean;
  onDismiss: () => void;
  children?: ReactNode;
}

/** Banner "↩ Sessão restaurada" com botão de dispensar. */
export default function ResumeBanner({ show, onDismiss, children }: ResumeBannerProps): JSX.Element | null {
  if (!show) return null;
  return (
    <div className={styles.resumeBanner}>
      {children}
      <button className={styles.resumeDismiss} onClick={onDismiss} aria-label="Dispensar aviso">✕</button>
    </div>
  );
}
