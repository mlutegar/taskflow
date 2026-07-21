import { useEffect, memo } from "react";
import styles from "../DailyFocus.module.css";

function AchievementToast({ achievements, onDismiss }) {
  useEffect(() => {
    const t = setTimeout(onDismiss, 4000);
    return () => clearTimeout(t);
  }, []);

  if (!achievements.length) return null;
  return (
    <div className={styles.achievementToast}>
      {achievements.map((a) => (
        <div key={a.id} className={styles.achievementToastItem}>
          <span className={styles.achievementToastEmoji}>{a.emoji}</span>
          <div>
            <div className={styles.achievementToastTitle}>Conquista desbloqueada!</div>
            <div className={styles.achievementToastName}>{a.name} — {a.desc}</div>
          </div>
        </div>
      ))}
    </div>
  );
}

export default memo(AchievementToast);
