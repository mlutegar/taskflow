import styles from "../DailyFocus.module.css";

type Step = "prepare" | "hunt" | "work";

const STEPS: Step[] = ["prepare", "hunt", "work"];
const STEP_LABELS: Record<Step, string> = {
  prepare: "☕ Preparar café",
  hunt: "🎵 Caçar música",
  work: "🎯 Fazer tarefa",
};

export interface CafeRitualState {
  cycles: number;
  currentSong: string;
  step: Step;
}

export const DEFAULT_STATE: CafeRitualState = { cycles: 0, currentSong: "", step: "prepare" };

interface CafeRitualHelperProps {
  state: Partial<CafeRitualState>;
  onChange: (state: CafeRitualState) => void;
}

export default function CafeRitualHelper({ state, onChange }: CafeRitualHelperProps) {
  const s: CafeRitualState = { ...DEFAULT_STATE, ...state };

  const advance = (): void => {
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
            onChange={(e: React.ChangeEvent<HTMLInputElement>) => onChange({ ...s, currentSong: e.target.value })}
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
