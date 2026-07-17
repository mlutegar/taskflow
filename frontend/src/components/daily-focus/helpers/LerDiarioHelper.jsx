import styles from "../DailyFocus.module.css";

export const DEFAULT_STATE = { entriesRead: 0, currentDate: null };

function randomDiaryDate() {
  const start = new Date(2024, 0, 1);
  const end = new Date();
  const ms = start.getTime() + Math.random() * (end.getTime() - start.getTime());
  return new Date(ms).toLocaleDateString("pt-BR");
}

export default function LerDiarioHelper({ state, onChange }) {
  const s = { ...DEFAULT_STATE, ...state };

  const sortearData = () => onChange({ ...s, currentDate: randomDiaryDate() });
  const marcarLido = () => onChange({ ...s, entriesRead: s.entriesRead + 1, currentDate: randomDiaryDate() });

  return (
    <div className={styles.helperPanelBody}>
      <div>
        <div className={styles.counterLabel}>📖 Data sugerida</div>
        <div style={{
          background: "var(--surface-2)",
          border: "1px solid var(--border)",
          borderRadius: "var(--radius-sm)",
          padding: "10px 14px",
          fontSize: 18,
          fontWeight: 700,
          textAlign: "center",
          letterSpacing: 1,
          marginBottom: 8,
          minHeight: 44,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
        }}>
          {s.currentDate || "—"}
        </div>
        <div style={{ display: "flex", gap: 6 }}>
          <button
            className={`${styles.helperSmallBtn}`}
            style={{ flex: 1 }}
            onClick={sortearData}
          >
            🎲 Sortear data
          </button>
          <button
            className={`${styles.helperSmallBtn}`}
            style={{ flex: 1, opacity: s.currentDate ? 1 : 0.4 }}
            onClick={marcarLido}
            disabled={!s.currentDate}
          >
            ✅ Li!
          </button>
        </div>
      </div>

      <div>
        <div className={styles.counterLabel}>📚 Entradas lidas</div>
        <div className={styles.counter}>
          <button
            className={styles.counterBtn}
            onClick={() => onChange({ ...s, entriesRead: Math.max(0, s.entriesRead - 1) })}
            disabled={s.entriesRead === 0}
          >
            −
          </button>
          <div className={styles.counterNum}>{s.entriesRead}</div>
          <button
            className={styles.counterBtn}
            onClick={() => onChange({ ...s, entriesRead: s.entriesRead + 1 })}
          >
            +
          </button>
        </div>
      </div>
    </div>
  );
}
