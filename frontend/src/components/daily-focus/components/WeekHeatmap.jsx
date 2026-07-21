import { memo } from "react";
import { getWeeklyStats } from "../../../lib/dailyFocusHistory";
import styles from "../DailyFocus.module.css";

function WeekHeatmap() {
  const weekData = getWeeklyStats();
  const DAY_LABELS = ["D", "S", "T", "Q", "Q", "S", "S"];

  return (
    <div className={styles.weekHeatmap}>
      {weekData.map((day, i) => {
        const intensity = day.maxLevel === 0 ? "empty"
          : day.maxLevel <= 2 ? "low"
          : day.maxLevel <= 4 ? "mid"
          : "high";
        return (
          <div
            key={i}
            className={styles.heatmapDay}
            title={day.count > 0
              ? `${day.dateStr} · ${day.count} sessão(ões) · Etapa máx: ${day.maxLevel}`
              : day.dateStr}
          >
            <div className={`${styles.heatmapDot} ${styles[`heatmapDot_${intensity}`]}`} />
            <span className={styles.heatmapLabel}>{DAY_LABELS[day.dayOfWeek]}</span>
          </div>
        );
      })}
    </div>
  );
}

export default memo(WeekHeatmap);
