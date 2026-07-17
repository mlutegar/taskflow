import styles from "../DailyFocus.module.css";

const DURATIONS = [15, 25, 30, 45, 60];

export const DEFAULT_STATE = { duration: 25, rounds: 0 };

export default function PomodoroHelper({ state, onChange }) {
  const s = { ...DEFAULT_STATE, ...state };
  const set = (field, val) => onChange({ ...s, [field]: val });

  return (
    <div className={styles.helperPanelBody}>
      <div>
        <div className={styles.helperInputLabel}>Duração do round</div>
        <div className={styles.variantRow} style={{ flexWrap: "wrap" }}>
          {DURATIONS.map((d) => (
            <button
              key={d}
              className={`${styles.variantBtn} ${s.duration === d ? styles.variantBtnActive : ""}`}
              onClick={() => set("duration", d)}
            >
              {d} min
            </button>
          ))}
        </div>
      </div>

      <div>
        <div className={styles.counterLabel}>🍅 Rounds completos</div>
        <div className={styles.counter}>
          <button
            className={styles.counterBtn}
            onClick={() => set("rounds", Math.max(0, s.rounds - 1))}
            disabled={s.rounds === 0}
          >
            −
          </button>
          <div>
            <div className={styles.counterNum}>{s.rounds}</div>
            <div style={{ fontSize: 11, color: "var(--text-muted)", textAlign: "center" }}>
              × {s.duration} min
            </div>
          </div>
          <button className={styles.counterBtn} onClick={() => set("rounds", s.rounds + 1)}>
            +
          </button>
        </div>
      </div>

      {s.rounds > 0 && (
        <div className={`${styles.cycleBadge} ${styles.textCenter}`}>
          🍅 {s.rounds * s.duration} min focados no total
        </div>
      )}
    </div>
  );
}
