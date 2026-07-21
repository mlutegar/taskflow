import { useState, useEffect, useRef, memo } from "react";
import styles from "../DailyFocus.module.css";

function formatTime(secs) {
  const m = Math.floor(Math.abs(secs) / 60);
  const s = Math.abs(secs) % 60;
  return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

function DailyTimer({ totalSeconds, initialRemaining, running, onTick, onComplete }) {
  const [remaining, setRemaining] = useState(initialRemaining ?? totalSeconds);
  const intervalRef = useRef(null);
  const firedRef = useRef(false);

  useEffect(() => {
    if (initialRemaining != null) setRemaining(initialRemaining);
  }, []);

  useEffect(() => {
    if (!running) { clearInterval(intervalRef.current); return; }
    intervalRef.current = setInterval(() => {
      setRemaining((prev) => {
        const next = prev - 1;
        onTick?.(next);
        if (next <= 0) {
          clearInterval(intervalRef.current);
          if (!firedRef.current) { firedRef.current = true; setTimeout(() => onComplete?.(), 50); }
          return 0;
        }
        return next;
      });
    }, 1000);
    return () => clearInterval(intervalRef.current);
  }, [running]);

  const r = 68;
  const circ = 2 * Math.PI * r;
  const progress = Math.max(0, Math.min(1, (totalSeconds - remaining) / totalSeconds));
  const isLow = remaining <= 60 && remaining > 0;
  const isWarning = progress >= 0.8 && !isLow;

  return (
    <div className={styles.ringWrap}>
      <svg className={styles.ring} viewBox="0 0 160 160">
        <circle cx="80" cy="80" r={r} className={styles.ringBg} />
        <circle
          cx="80" cy="80" r={r}
          className={`${styles.ringProgress} ${isLow ? styles.ringProgressDanger : isWarning ? styles.ringProgressWarning : ""}`}
          strokeDasharray={circ}
          strokeDashoffset={circ * (1 - progress)}
        />
      </svg>
      <div className={styles.timeDisplay}>
        <span className={styles.timeText}>{formatTime(remaining)}</span>
        {!running && remaining < totalSeconds && remaining > 0 && (
          <span className={styles.timePaused}>pausado</span>
        )}
        {remaining === 0 && <span className={styles.timePaused} style={{ color: "var(--success)" }}>pronto!</span>}
      </div>
    </div>
  );
}

export default memo(DailyTimer);
