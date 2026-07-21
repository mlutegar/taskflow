import { memo } from "react";
import styles from "../DailyFocus.module.css";

const STAGE_THEMES = [
  { emoji: "🔹", name: "Ignição" },
  { emoji: "🟡", name: "Aquecimento" },
  { emoji: "🟠", name: "Ritmo" },
  { emoji: "🔥", name: "Chama" },
  { emoji: "⚡", name: "Turbina" },
  { emoji: "💜", name: "Máxima" },
  { emoji: "👑", name: "Lenda" },
  { emoji: "🚀", name: "Além" },
];

export function getStageTheme(level) {
  return STAGE_THEMES[Math.min(level - 1, STAGE_THEMES.length - 1)] || STAGE_THEMES[0];
}

function StepsLadder({ currentLevel, maxLevel, lastDateByLevel = {}, animating = false }) {
  const totalSteps = Math.min(8, Math.max(currentLevel + 2, (maxLevel || 0) + 1, 5));

  return (
    <div className={styles.stepsLadder}>
      {Array.from({ length: totalSteps }, (_, i) => {
        const step = i + 1;
        const isDone = step < currentLevel;
        const isCurrent = step === currentLevel;
        const isRecord = step === maxLevel && maxLevel > 0;
        const theme = getStageTheme(step);
        const tooltip = isDone && lastDateByLevel[step]
          ? `Etapa ${step} · ${theme.name} · ${lastDateByLevel[step]}`
          : isCurrent
          ? `Etapa ${step} · ${theme.name} · em andamento`
          : `Etapa ${step} · ${theme.name}`;

        return (
          <div
            key={step}
            className={[
              styles.ladderStep,
              isDone ? styles.ladderStepDone : "",
              isCurrent ? styles.ladderStepCurrent : "",
              isCurrent && animating ? styles.ladderStepEnter : "",
              isRecord ? styles.ladderStepRecord : "",
            ].filter(Boolean).join(" ")}
            style={{ height: `${28 + step * 10}px` }}
            title={tooltip}
          >
            <span className={styles.ladderStepEmoji}>{theme.emoji}</span>
            <span className={styles.ladderStepNum}>{step}</span>
            {isDone && <span className={styles.ladderStepCheck}>✓</span>}
            {isRecord && !isCurrent && <span className={styles.ladderStepTrophy}>🏆</span>}
          </div>
        );
      })}
    </div>
  );
}

export default memo(StepsLadder);
