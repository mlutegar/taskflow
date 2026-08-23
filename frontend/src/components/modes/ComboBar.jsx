/**
 * ComboBar — Barra flutuante que aparece quando o usuário seleciona modos para combinar.
 * Extraído de ModesPanel para facilitar manutenção.
 */
import styles from "../ModesPanel.module.css";

export default function ComboBar({ comboSelected, modeById, onClear, onStart }) {
  if (!comboSelected.length) return null;

  const selectedModes = comboSelected.map((id) => modeById[id]).filter(Boolean);
  const types = [...new Set(selectedModes.map((m) => m.type).filter(Boolean))];
  const typeMismatch = types.length > 1;
  const canStart = comboSelected.length >= 2;

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
