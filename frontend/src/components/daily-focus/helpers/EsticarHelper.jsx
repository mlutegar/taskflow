import { useState } from "react";
import styles from "../DailyFocus.module.css";
import CountdownTimer from "../../CountdownTimer";

const TIMER_SECONDS = 5 * 60; // 5 minutos

export const DEFAULT_STATE = { pauses: 0 };

export default function EsticarHelper({ state, onChange }) {
  const s = { ...DEFAULT_STATE, ...state };
  const [timerRunning, setTimerRunning] = useState(false);
  const [timerKey, setTimerKey] = useState(0);

  const handleTimerComplete = () => {
    setTimerRunning(false);
    onChange({ ...s, pauses: s.pauses + 1 });
  };

  const startTimer = () => {
    setTimerKey((k) => k + 1);
    setTimerRunning(true);
  };

  return (
    <div className={styles.helperPanelBody}>
      {timerRunning ? (
        <CountdownTimer
          key={timerKey}
          seconds={TIMER_SECONDS}
          title="🤸 Alongando 5 min"
          onComplete={handleTimerComplete}
          onCancel={() => setTimerRunning(false)}
        />
      ) : (
        <>
          <button
            className={`${styles.variantBtn} ${styles.variantBtnActive}`}
            style={{ width: "100%", padding: "10px" }}
            onClick={startTimer}
          >
            ▶ Iniciar 5 min de alongamento
          </button>

          <div>
            <div className={styles.counterLabel}>🤸 Pausas de alongamento</div>
            <div className={styles.counter}>
              <button
                className={styles.counterBtn}
                onClick={() => onChange({ ...s, pauses: Math.max(0, s.pauses - 1) })}
                disabled={s.pauses === 0}
              >
                −
              </button>
              <div>
                <div className={styles.counterNum}>{s.pauses}</div>
                <div style={{ fontSize: 11, color: "var(--text-muted)", textAlign: "center" }}>
                  pausa{s.pauses !== 1 ? "s" : ""}
                </div>
              </div>
              <button
                className={styles.counterBtn}
                onClick={() => onChange({ ...s, pauses: s.pauses + 1 })}
              >
                +
              </button>
            </div>
          </div>

          {s.pauses > 0 && (
            <div className={`${styles.cycleBadge} ${styles.textCenter}`}>
              🤸 {s.pauses * 5} min de alongamento no total
            </div>
          )}
        </>
      )}
    </div>
  );
}
