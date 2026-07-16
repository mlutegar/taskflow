import styles from "../DailyFocus.module.css";

export const DEFAULT_STATE = { cycle: 1, videosWatched: false, taskInCycle: 0 };

export default function TikTokHelper({ state, onChange }) {
  const s = { ...DEFAULT_STATE, ...state };

  const numVideos = s.cycle * 5;
  const numTasks = s.cycle;

  const nextCycle = () => {
    onChange({ ...s, cycle: s.cycle + 1, videosWatched: false, taskInCycle: 0 });
  };

  const markTaskDone = () => {
    const next = s.taskInCycle + 1;
    if (next >= numTasks) {
      nextCycle();
    } else {
      onChange({ ...s, taskInCycle: next });
    }
  };

  return (
    <div className={styles.helperPanelBody}>
      <div className={styles.cycleDisplay}>
        <span className={styles.cycleBadge}>Ciclo {s.cycle}</span>
        <span className={styles.cycleTaskProgress}>
          Tarefa {s.taskInCycle + 1} / {numTasks}
        </span>
      </div>

      <div className={styles.statRow}>
        <div className={styles.statItem}>
          <span className={styles.statNum}>📱</span>
          <span className={styles.statLabel}>{numVideos} vídeos</span>
        </div>
        <div className={styles.statItem}>
          <span className={styles.statNum}>{numTasks}</span>
          <span className={styles.statLabel}>tarefas</span>
        </div>
      </div>

      <div>
        <div className={styles.helperInputLabel}>
          {!s.videosWatched
            ? `Assista ${numVideos} vídeos, depois marque aqui:`
            : `Fez ${s.taskInCycle + 1}ª tarefa do ciclo?`}
        </div>
        {!s.videosWatched ? (
          <button
            className={styles.helperSmallBtn}
            style={{ width: "100%" }}
            onClick={() => onChange({ ...s, videosWatched: true })}
          >
            ✓ Assisti os {numVideos} vídeos
          </button>
        ) : (
          <button
            className={`${styles.helperSmallBtn} ${styles.helperSmallBtnActive}`}
            style={{ width: "100%" }}
            onClick={markTaskDone}
          >
            ✓ Tarefa {s.taskInCycle + 1}/{numTasks} feita
          </button>
        )}
      </div>
    </div>
  );
}
