import SessionHeader from "./SessionHeader";
import ResumeBanner from "./ResumeBanner";
import styles from "./session.module.css";

export default function BaseSession({ emoji, title, sub, onClose, showResume, resumeMessage, onDismissResume, children }) {
  return (
    <div className={styles.root}>
      <SessionHeader emoji={emoji} title={title} sub={sub} onClose={onClose} />
      <div className={styles.body}>
        <ResumeBanner show={showResume} onDismiss={onDismissResume}>
          {resumeMessage}
        </ResumeBanner>
        {children}
      </div>
    </div>
  );
}
