import { useState, useEffect, useRef, memo } from "react";
import { liveRemaining, type DailyFocusLive } from "../../../lib/dailyFocusLive";
import styles from "../DailyFocus.module.css";

function formatTime(secs: number): string {
  const m = Math.floor(Math.abs(secs) / 60);
  const s = Math.abs(secs) % 60;
  return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

interface DailyTimerProps {
  totalSeconds: number;
  snapshot: DailyFocusLive;
  onTick?: (next: number) => void;
  onComplete?: () => void;
}

function DailyTimer({ totalSeconds, snapshot, onTick, onComplete }: DailyTimerProps) {
  const firedRef = useRef<boolean>(false);

  // Calcula tempo inicial do snapshot usando a função que considera timestamps
  const initialRemaining = liveRemaining(snapshot) ?? totalSeconds;
  const [displayTime, setDisplayTime] = useState<number>(initialRemaining);

  // Recalcula quando snapshot mudar (pausar/retomar, novo anchorTs)
  useEffect(() => {
    const remaining = liveRemaining(snapshot);
    if (remaining !== null) {
      setDisplayTime(remaining);
      firedRef.current = false; // Resetar flag ao mudar snapshot
    }
  }, [snapshot.anchorTs, snapshot.remainingSecs, snapshot.running]);

  useEffect(() => {
    if (!snapshot.running) {
      // Pausado — congela no valor atual do snapshot
      const frozen = liveRemaining(snapshot);
      if (frozen !== null) setDisplayTime(frozen);
      return;
    }

    // Em execução — atualiza UI a cada 1 segundo
    const interval = setInterval(() => {
      const actualRemaining = liveRemaining(snapshot);

      if (actualRemaining === null || actualRemaining <= 0) {
        setDisplayTime(0);
        clearInterval(interval);
        if (!firedRef.current) {
          firedRef.current = true;
          setTimeout(() => onComplete?.(), 50);
        }
        return;
      }

      setDisplayTime(actualRemaining);
      onTick?.(actualRemaining);
    }, 1000);

    return () => clearInterval(interval);
  }, [snapshot.running, snapshot.anchorTs, snapshot.remainingSecs, onTick, onComplete]);

  const r = 68;
  const circ = 2 * Math.PI * r;
  const progress = Math.max(0, Math.min(1, (totalSeconds - displayTime) / totalSeconds));
  const isLow = displayTime <= 60 && displayTime > 0;
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
        <span className={styles.timeText}>{formatTime(displayTime)}</span>
        {!snapshot.running && displayTime < totalSeconds && displayTime > 0 && (
          <span className={styles.timePaused}>pausado</span>
        )}
        {displayTime === 0 && <span className={styles.timePaused} style={{ color: "var(--success)" }}>pronto!</span>}
      </div>
    </div>
  );
}

export default memo(DailyTimer);
