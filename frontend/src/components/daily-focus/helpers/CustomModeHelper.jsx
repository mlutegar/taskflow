import styles from "../DailyFocus.module.css";

export const DEFAULT_STATE = { stepsDone: [] };

export default function CustomModeHelper({ state, onChange, modeConfig }) {
  const s = { ...DEFAULT_STATE, ...state };
  const steps = modeConfig?.steps || [];

  const toggle = (i) => {
    const done = s.stepsDone || [];
    const updated = done.includes(i) ? done.filter((x) => x !== i) : [...done, i];
    onChange({ ...s, stepsDone: updated });
  };

  return (
    <div className={styles.helperPanelBody}>
      {steps.length > 0 ? (
        <div className={styles.stepsList}>
          {steps.map((step, i) => {
            const done = (s.stepsDone || []).includes(i);
            return (
              <div key={i} className={styles.stepItem} onClick={() => toggle(i)}>
                <div className={`${styles.stepCheck} ${done ? styles.stepCheckDone : ""}`}>
                  {done ? "✓" : ""}
                </div>
                <span className={`${styles.stepText} ${done ? styles.stepTextDone : ""}`}>{step}</span>
              </div>
            );
          })}
        </div>
      ) : (
        <div className={styles.smallText}>Sem passos definidos para este modo.</div>
      )}

      {modeConfig?.tips && (
        <div
          style={{
            padding: "8px 10px",
            background: "var(--surface-2)",
            borderRadius: "var(--radius-sm)",
            borderLeft: "3px solid var(--accent)",
          }}
        >
          <div style={{ fontSize: 11, color: "var(--text-muted)", marginBottom: 4 }}>💡 Dica</div>
          <div style={{ fontSize: 12, lineHeight: 1.5, color: "var(--text)" }}>{modeConfig.tips}</div>
        </div>
      )}
    </div>
  );
}
