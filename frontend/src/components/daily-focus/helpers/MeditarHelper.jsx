import { useState } from "react";
import styles from "../DailyFocus.module.css";
import CountdownTimer from "../../CountdownTimer";
import { playTimerDone } from "../../../lib/sounds";

const DURATIONS = [5, 10, 15, 20];

export const DEFAULT_STATE = { sessions: 0, duration: 10 };

export default function MeditarHelper({ state, onChange }) {
  const s = { ...DEFAULT_STATE, ...state };
  const [timerRunning, setTimerRunning] = useState(false);
  const [timerKey, setTimerKey] = useState(0);

  const set = (field, val) => onChange({ ...s, [field]: val });

  const handleTimerComplete = () => {
    setTimerRunning(false);
    onChange({ ...s, sessions: s.sessions + 1 });
    playTimerDone();
  };

  const startTimer = () => {
    setTimerKey((k) => k + 1); // reseta o timer
    setTimerRunning(true);
  };

  return (
    <div className={styles.helperPanelBody}>
      <div>
        <div className={styles.helperInputLabel}>Duração da sessão</div>
        <div className={styles.variantRow}>
          {DURATIONS.map((d) => (
            <button
              key={d}
              className={`${styles.variantBtn} ${s.duration === d ? styles.variantBtnActive : ""}`}
              onClick={() => { set("duration", d); setTimerRunning(false); }}
            >
              {d} min
            </button>
          ))}
        </div>
      </div>

      {timerRunning ? (
        <CountdownTimer
          key={timerKey}
          seconds={s.duration * 60}
          title={`🧘 Meditando ${s.duration} min`}
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
            ▶ Iniciar {s.duration} min
          </button>

          <div>
            <div className={styles.counterLabel}>🧘 Sessões meditadas</div>
            <div className={styles.counter}>
              <button
                className={styles.counterBtn}
                onClick={() => set("sessions", Math.max(0, s.sessions - 1))}
                disabled={s.sessions === 0}
              >
                −
              </button>
              <div>
                <div className={styles.counterNum}>{s.sessions}</div>
                <div style={{ fontSize: 11, color: "var(--text-muted)", textAlign: "center" }}>
                  × {s.duration} min
                </div>
              </div>
              <button
                className={styles.counterBtn}
                onClick={() => set("sessions", s.sessions + 1)}
              >
                +
              </button>
            </div>
          </div>

          {s.sessions > 0 && (
            <div className={`${styles.cycleBadge} ${styles.textCenter}`}>
              🧘 {s.sessions * s.duration} min meditados no total
            </div>
          )}
        </>
      )}
    </div>
  );
}
