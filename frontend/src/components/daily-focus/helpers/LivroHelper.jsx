import styles from "../DailyFocus.module.css";

export const DEFAULT_STATE = { chapters: 0, bookTitle: "" };

export default function LivroHelper({ state, onChange }) {
  const s = { ...DEFAULT_STATE, ...state };
  const set = (field, val) => onChange({ ...s, [field]: val });

  return (
    <div className={styles.helperPanelBody}>
      <div>
        <div className={styles.helperInputLabel}>Livro atual (opcional)</div>
        <input
          className={styles.helperInput}
          placeholder="Ex: Atomic Habits"
          value={s.bookTitle}
          onChange={(e) => set("bookTitle", e.target.value)}
        />
      </div>

      {s.bookTitle && (
        <div className={`${styles.cycleBadge} ${styles.textCenter}`}>
          📚 {s.bookTitle}
        </div>
      )}

      <div>
        <div className={styles.counterLabel}>📖 Capítulos lidos</div>
        <div className={styles.counter}>
          <button
            className={styles.counterBtn}
            onClick={() => set("chapters", Math.max(0, s.chapters - 1))}
            disabled={s.chapters === 0}
          >
            −
          </button>
          <div className={styles.counterNum}>{s.chapters}</div>
          <button
            className={styles.counterBtn}
            onClick={() => set("chapters", s.chapters + 1)}
          >
            +
          </button>
        </div>
      </div>
    </div>
  );
}
