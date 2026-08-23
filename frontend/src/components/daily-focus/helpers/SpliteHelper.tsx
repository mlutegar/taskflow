import styles from "../DailyFocus.module.css";
import ActivityPicker from "./shared/ActivityPicker";
import { useHelperCycle } from "./shared/useHelperCycle";

export interface SpliteState {
  activity: string;
  cycle: number;
  taskInCycle: number;
  isDiaryMode: boolean;
}

export const DEFAULT_STATE: SpliteState = { activity: "", cycle: 1, taskInCycle: 0, isDiaryMode: false };

interface SpliteHelperProps {
  state: Partial<SpliteState>;
  onChange: (state: SpliteState) => void;
}

export default function SpliteHelper({ state, onChange }: SpliteHelperProps): JSX.Element {
  const s: SpliteState = { ...DEFAULT_STATE, ...state };

  const { nextTask } = useHelperCycle(s, onChange);

  if (!s.activity) {
    return (
      <ActivityPicker
        label="Escolha a atividade de recompensa"
        onSelect={(a: string) => onChange({ ...s, activity: a })}
      />
    );
  }

  return (
    <div className={styles.helperPanelBody}>
      <div className={styles.cycleDisplay}>
        <span className={styles.cycleBadge}>Ciclo {s.cycle}</span>
        <span className={styles.cycleTaskProgress}>
          Tarefa {s.taskInCycle + 1} / {s.cycle}
        </span>
        {s.isDiaryMode && <span className={styles.tag}>📓 Diário</span>}
      </div>

      <div className={styles.statRow}>
        <div className={styles.statItem} style={{ flex: 1 }}>
          <span className={styles.statNum} style={{ fontSize: 14 }}>{s.activity}</span>
          <span className={styles.statLabel}>× {s.cycle}</span>
        </div>
      </div>

      <div className={styles.helperRow}>
        <button
          className={`${styles.helperSmallBtn} ${styles.helperSmallBtnActive}`}
          style={{ flex: 1 }}
          onClick={nextTask}
        >
          ✓ Tarefa {s.taskInCycle + 1}/{s.cycle} feita
        </button>
        <button
          className={styles.helperSmallBtn}
          onClick={() => onChange({ ...s, isDiaryMode: !s.isDiaryMode })}
          title="Alternar modo diário"
        >
          📓
        </button>
        <button
          className={styles.helperSmallBtn}
          onClick={() => onChange({ ...DEFAULT_STATE })}
          title="Trocar atividade"
        >
          ↺
        </button>
      </div>
    </div>
  );
}
