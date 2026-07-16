import styles from "../DailyFocus.module.css";

const STEPS = ["prepare", "hunt", "work"];
const STEP_LABELS = {
  prepare: "☕ Preparar café",
  hunt: "🎵 Caçar música",
  work: "🎯 Fazer tarefa",
};

export const DEFAULT_STATE = { cycles: 0, currentSong: "", step: "prepare" };

export default function CafeRitualHelper({ state, onChange }) {
  const s = { ...DEFAULT_STATE, ...state };

  const advance = () => {
    const idx = STEPS.indexOf(s.step);
    if (idx < STEPS.length - 1) {
      onChange({ ...s, step: STEPS[idx + 1] });
    } else {
      onChange({ ...s, cycles: s.cycles + 1, step: "prepare", currentSong: "" });
    }
  };

  return (
    <div className={styles.helperPanelBody}>
      <div className={styles.cycleDisplay}>
        <span className={styles.cycleBadge}>☕ Ciclo {s.cycles + 1}</span>
        <span className={styles.cycleTaskProgress}>{STEP_LABELS[s.step]}</span>
      </div>

      {s.step === "hunt" && (
        <div>
          <div className={styles.helperInputLabel}>Música encontrada</div>
          <input
            className={styles.helperInput}
            placeholder="Ex: Sweet Home Alabama"
            value={s.currentSong}
            onChange={(e) => onChange({ ...s, currentSong: e.target.value })}
          />
        </div>
      )}

      {s.step === "work" && s.currentSong && (
        <div className={`${styles.cycleBadge} ${styles.textCenter}`}>
          🎵 {s.currentSong}
        </div>
      )}

      <button
        className={`${styles.helperSmallBtn} ${styles.helperSmallBtnActive}`}
        style={{ width: "100%" }}
        onClick={advance}
      >
        {s.step === "prepare" && "✓ Café preparado"}
        {s.step === "hunt" && "✓ Música encontrada"}
        {s.step === "work" && "✓ Ciclo completo → Próximo"}
      </button>

      {s.cycles > 0 && (
        <div className={styles.textCenter}>
          <span className={styles.tag}>✅ {s.cycles} ciclo{s.cycles !== 1 ? "s" : ""} completo{s.cycles !== 1 ? "s" : ""}</span>
        </div>
      )}
    </div>
  );
}
