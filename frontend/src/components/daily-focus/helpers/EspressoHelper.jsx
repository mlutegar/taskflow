import { useEffect, useRef } from "react";
import styles from "../DailyFocus.module.css";

const MINI_DURATION = 1500; // 25 min

export const DEFAULT_STATE = { sprints: 0, coffees: 1, miniRemaining: MINI_DURATION, miniRunning: false };

export default function EspressoHelper({ state, onChange }) {
  const s = { ...DEFAULT_STATE, ...state };
  const intervalRef = useRef(null);

  useEffect(() => {
    if (s.miniRunning && s.miniRemaining > 0) {
      intervalRef.current = setInterval(() => {
        onChange((prev) => {
          const cur = { ...DEFAULT_STATE, ...prev };
          if (cur.miniRemaining <= 1) {
            clearInterval(intervalRef.current);
            return { ...cur, miniRemaining: 0, miniRunning: false };
          }
          return { ...cur, miniRemaining: cur.miniRemaining - 1 };
        });
      }, 1000);
    } else {
      clearInterval(intervalRef.current);
    }
    return () => clearInterval(intervalRef.current);
  }, [s.miniRunning, s.miniRemaining > 0]);

  const mins = Math.floor(s.miniRemaining / 60);
  const secs = s.miniRemaining % 60;
  const r = 38;
  const circ = 2 * Math.PI * r;
  const progress = (MINI_DURATION - s.miniRemaining) / MINI_DURATION;

  const toggle = () => onChange({ ...s, miniRunning: !s.miniRunning });
  const completeSprint = () =>
    onChange({ ...s, miniRemaining: MINI_DURATION, miniRunning: false, sprints: s.sprints + 1 });

  const overload = s.sprints >= 4;

  return (
    <div className={styles.helperPanelBody}>
      <div className={styles.statRow}>
        <div className={styles.statItem}>
          <span className={styles.statNum}>☕</span>
          <span className={styles.statLabel}>{s.coffees} café{s.coffees !== 1 ? "s" : ""}</span>
        </div>
        <div className={styles.statItem}>
          <span className={styles.statNum}>{s.sprints}</span>
          <span className={`${styles.statLabel} ${overload ? styles.danger : ""}`}>
            sprint{s.sprints !== 1 ? "s" : ""}
            {overload ? " ⚠️" : ""}
          </span>
        </div>
      </div>

      <div className={styles.miniTimerWrap}>
        <div className={styles.miniRingWrap}>
          <svg className={styles.miniRing} viewBox="0 0 90 90">
            <circle cx="45" cy="45" r={r} fill="none" stroke="var(--surface-2)" strokeWidth="8" />
            <circle
              cx="45" cy="45" r={r}
              fill="none"
              stroke="#c8874a"
              strokeWidth="8"
              strokeLinecap="round"
              strokeDasharray={circ}
              strokeDashoffset={circ * (1 - progress)}
              style={{ transition: "stroke-dashoffset 0.9s linear" }}
            />
          </svg>
          <div className={styles.timeDisplay}>
            <span className={styles.miniTimeText}>
              {String(mins).padStart(2, "0")}:{String(secs).padStart(2, "0")}
            </span>
          </div>
        </div>

        <div className={styles.counterLabel}>☕ Sprint de 25 min</div>

        <div className={styles.helperRow}>
          {s.miniRemaining > 0 ? (
            <button
              className={`${styles.helperSmallBtn} ${s.miniRunning ? "" : styles.helperSmallBtnActive}`}
              onClick={toggle}
            >
              {s.miniRunning ? "⏸ Pausar" : "▶ Iniciar"}
            </button>
          ) : (
            <button className={`${styles.helperSmallBtn} ${styles.helperSmallBtnActive}`} onClick={completeSprint}>
              ✓ +1 Sprint
            </button>
          )}
          <button
            className={styles.helperSmallBtn}
            onClick={() => onChange({ ...s, coffees: s.coffees + 1 })}
          >
            +☕
          </button>
        </div>
      </div>

      {overload && (
        <div className={`${styles.smallText} ${styles.danger} ${styles.textCenter}`}>
          ⚠️ {s.sprints} sprints — considere pausar
        </div>
      )}
    </div>
  );
}
