import { memo } from "react";
import styles from "../DailyFocus.module.css";

function ProgressDots({ total, current, done: _done }) {
  return (
    <div className={styles.progressDots}>
      {Array.from({ length: total }, (_, i) => (
        <div
          key={i}
          className={`${styles.progressDot} ${
            i < current ? styles.progressDotDone : i === current ? styles.progressDotActive : ""
          }`}
          title={`Tarefa ${i + 1}`}
        />
      ))}
    </div>
  );
}

export default memo(ProgressDots);
