/**
 * PresetCombosSection — Seção de combos pré-definidos na página de Modos.
 * Extraído de ModesPanel para facilitar manutenção.
 */
import { PRESET_COMBOS } from "../../data/presetCombos";
import styles from "../ModesPanel.module.css";
import type { Mode } from "../../types/index";

interface PresetCombosSectionProps {
  modeById: Record<string, Mode>;
  collapsed: boolean;
  onToggleCollapse: () => void;
  onSelectCombo: (modeIds: string[]) => void;
}

export default function PresetCombosSection({
  modeById,
  collapsed,
  onToggleCollapse,
  onSelectCombo,
}: PresetCombosSectionProps) {
  return (
    <div className={styles.presetCombosSection}>
      <div className={styles.presetCombosHeader}>
        <span className={styles.presetCombosTitle}>🔗 Combos Prontos</span>
        <button className={styles.presetCombosToggle} onClick={onToggleCollapse}>
          {collapsed ? "▼ mostrar" : "▲ ocultar"}
        </button>
      </div>

      {!collapsed && (
        <div className={styles.presetCombosGrid}>
          {PRESET_COMBOS.map((combo) => (
            <button
              key={combo.id}
              className={styles.presetComboCard}
              style={{ borderColor: combo.color, background: combo.colorBg }}
              onClick={() => onSelectCombo(combo.modeIds)}
              title={combo.description}
            >
              <span className={styles.presetComboEmoji}>{combo.emoji}</span>
              <div className={styles.presetComboInfo}>
                <strong className={styles.presetComboName}>{combo.name}</strong>
                <span className={styles.presetComboModes}>
                  {combo.modeIds.map((id: string) => modeById[id]?.emoji ?? "?").join(" + ")}
                </span>
              </div>
              <span className={styles.presetComboSituation}>{combo.situation}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
