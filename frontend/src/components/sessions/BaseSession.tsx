import React from "react";
import SessionHeader from "./SessionHeader";
import ResumeBanner from "./ResumeBanner";
import styles from "./session.module.css";

interface BaseSessionProps {
  emoji: string;
  title: string;
  sub?: string;
  onClose: () => void;
  showResume?: boolean;
  resumeMessage?: React.ReactNode;
  onDismissResume?: () => void;
  children?: React.ReactNode;
}

export default function BaseSession({ emoji, title, sub, onClose, showResume, resumeMessage, onDismissResume, children }: BaseSessionProps): React.JSX.Element {
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
