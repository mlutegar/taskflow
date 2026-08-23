/**
 * ComboBar — Barra flutuante que aparece quando o usuário seleciona modos para combinar.
 * Extraído de ModesPanel para facilitar manutenção.
 */
import styles from "../ModesPanel.module.css";

interface ModeWithType {
  id: string;
  name: string;
  emoji: string;
  type?: string;
  [key: string]: unknown;
}

interface ComboBarProps {
  comboSelected: string[];
  modeById: Record<string, ModeWithType>;
  onClear: () => void;
  onStart: () => void;
}

export default function ComboBar({ comboSelected, modeById, onClear, onStart }: ComboBarProps): JSX.Element | null {
  if (!comboSelected.length) return null;

  const selectedModes: ModeWithType[] = comboSelected.map((id) => modeById[id]).filter(Boolean);
  const types: string[] = [...new Set(selectedModes.map((m) => m.type).filter(Boolean))] as string[];
  const typeMismatch: boolean = types.length > 1;
  const canStart: boolean = comboSelected.length >= 2;

  return (
    <div className={`${styles.comboBar} ${!canStart ? styles.comboBarPending : ""}`}>
      {!canStart ? (
        <>
          <span className={styles.comboBarLabel}>
            {selectedModes[0]?.emoji} {selectedModes[0]?.name}
          </span>
          <span className={styles.comboBarHint}>+ escolha mais 1–2 modos</span>
          <button className={styles.comboBarClear} onClick={onClear}>×</button>
        </>
      ) : (
        <>
          <span className={styles.comboBarLabel}>
            {selectedModes.map((m) => `${m.emoji} ${m.name}`).join(" + ")}
          </span>
          {typeMismatch && (
            <span
              className={styles.comboBarTypeMismatch}
              title={selectedModes.map((m) => `${m.name}: "${m.type}"`).join(" · ")}
            >
              ⚠️ tipos diferentes
            </span>
          )}
          <button className={styles.comboBarStart} onClick={onStart}>
            🔀 Testar juntos
          </button>
          <button className={styles.comboBarClear} onClick={onClear}>×</button>
        </>
      )}
    </div>
  );
}
