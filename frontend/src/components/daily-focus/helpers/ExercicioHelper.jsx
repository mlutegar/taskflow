import styles from "../DailyFocus.module.css";

export const DEFAULT_STATE = { rounds: 0 };

export default function ExercicioHelper({ state, onChange }) {
  const s = { ...DEFAULT_STATE, ...state };
  const set = (rounds) => onChange({ ...s, rounds });

  return (
    <div className={styles.helperPanelBody}>
      <div className={styles.counterLabel}>🏃 Rounds de exercício</div>
      <div className={styles.counter}>
        <button
          className={styles.counterBtn}
          onClick={() => set(Math.max(0, s.rounds - 1))}
          disabled={s.rounds === 0}
        >
          −
        </button>
        <div>
          <div className={styles.counterNum}>{s.rounds}</div>
          <div style={{ fontSize: 11, color: "var(--text-muted)", textAlign: "center" }}>
            round{s.rounds !== 1 ? "s" : ""}
          </div>
        </div>
        <button
          className={styles.counterBtn}
          onClick={() => set(s.rounds + 1)}
        >
          +
        </button>
      </div>

      {s.rounds > 0 && (
        <div className={`${styles.cycleBadge} ${styles.textCenter}`}>
          🔥 {s.rounds} round{s.rounds !== 1 ? "s" : ""} feito{s.rounds !== 1 ? "s" : ""}!
        </div>
      )}
    </div>
  );
}
