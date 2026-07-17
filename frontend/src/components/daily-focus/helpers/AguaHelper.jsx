import styles from "../DailyFocus.module.css";

const GOAL = 8;

export const DEFAULT_STATE = { count: 0, lastReset: "" };

function todayIso() {
  return new Date().toISOString().slice(0, 10);
}

export default function AguaHelper({ state, onChange }) {
  const today = todayIso();

  // Reseta o contador se for um novo dia
  const s = (() => {
    const base = { ...DEFAULT_STATE, ...state };
    if (base.lastReset !== today) return { count: 0, lastReset: today };
    return base;
  })();

  const set = (count) => onChange({ ...s, count, lastReset: today });

  const pct = Math.min(100, Math.round((s.count / GOAL) * 100));

  return (
    <div className={styles.helperPanelBody}>
      <div className={styles.counterLabel}>
        💧 Copos de água hoje
      </div>

      <div className={styles.counter}>
        <button
          className={styles.counterBtn}
          onClick={() => set(Math.max(0, s.count - 1))}
          disabled={s.count === 0}
        >
          −
        </button>
        <div>
          <div className={styles.counterNum}>{s.count}</div>
          <div style={{ fontSize: 11, color: "var(--text-muted)", textAlign: "center" }}>
            de {GOAL}
          </div>
        </div>
        <button
          className={styles.counterBtn}
          onClick={() => set(s.count + 1)}
        >
          +
        </button>
      </div>

      {/* Barra de progresso */}
      <div style={{ marginTop: 8 }}>
        <div style={{
          height: 8,
          borderRadius: 4,
          background: "var(--surface-2)",
          overflow: "hidden",
          border: "1px solid var(--border)",
        }}>
          <div style={{
            height: "100%",
            width: `${pct}%`,
            background: s.count >= GOAL ? "#4ecca3" : "#4ea8cc",
            borderRadius: 4,
            transition: "width 0.3s ease",
          }} />
        </div>
        <div style={{ fontSize: 11, color: "var(--text-muted)", textAlign: "right", marginTop: 3 }}>
          {pct}%
          {s.count >= GOAL && " 🎉 Meta atingida!"}
        </div>
      </div>
    </div>
  );
}
