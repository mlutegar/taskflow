import { useState, useEffect, useRef } from "react";
import styles from "./CountdownTimer.module.css";

export default function CountdownTimer({ seconds, title, onComplete, onCancel }) {
  const [remaining, setRemaining] = useState(seconds);
  const [paused, setPaused] = useState(false);
  const intervalRef = useRef(null);
  const firedRef = useRef(false);

  useEffect(() => {
    if (paused) { clearInterval(intervalRef.current); return; }
    intervalRef.current = setInterval(() => {
      setRemaining((prev) => {
        if (prev <= 1) {
          clearInterval(intervalRef.current);
          if (!firedRef.current) { firedRef.current = true; setTimeout(() => onComplete?.(), 50); }
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(intervalRef.current);
  }, [paused, onComplete]);

  const mins = Math.floor(remaining / 60);
  const secs = remaining % 60;
  const r = 52;
  const circ = 2 * Math.PI * r;
  const progress = (seconds - remaining) / seconds;

  return (
    <div className={styles.root}>
      <div className={styles.ringWrap}>
        <svg className={styles.ring} viewBox="0 0 120 120">
          <circle cx="60" cy="60" r={r} className={styles.ringBg} />
          <circle
            cx="60" cy="60" r={r}
            className={styles.ringProgress}
            strokeDasharray={circ}
            strokeDashoffset={circ * (1 - progress)}
          />
        </svg>
        <div className={styles.timeDisplay}>
          <span className={styles.time}>
            {String(mins).padStart(2, "0")}:{String(secs).padStart(2, "0")}
          </span>
          {paused && <span className={styles.pausedLabel}>pausado</span>}
        </div>
      </div>
      {title && <div className={styles.title}>{title}</div>}
      <div className={styles.timerActions}>
        <button className={`${styles.btn} ${styles.btnPause}`} onClick={() => setPaused((v) => !v)}>
          {paused ? "▶ Continuar" : "⏸ Pausar"}
        </button>
        <button className={`${styles.btn} ${styles.btnCancel}`} onClick={onCancel}>
          ✕ Cancelar
        </button>
      </div>
    </div>
  );
}
