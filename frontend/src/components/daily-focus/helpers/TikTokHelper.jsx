import styles from "../DailyFocus.module.css";

export const DEFAULT_STATE = { cycle: 1, videosWatched: false, taskInCycle: 0, platform: "tiktok", variant: "prog_both" };

export default function TikTokHelper({ state, onChange }) {
  const s = { ...DEFAULT_STATE, ...state };

  const variant  = s.variant  ?? "prog_both";
  const platform = s.platform ?? "tiktok";
  const baseVideos = s.baseVideos ?? 5;
  const numVideos  = variant === "fixed"  ? baseVideos
    : variant === "detox" ? Math.max(1, 4 - s.cycle) * baseVideos
    : s.cycle * baseVideos;
  const numTasks = variant === "prog_both" ? s.cycle
    : variant === "detox"   ? Math.max(1, 4 - s.cycle)
    : 1;
  const platformLabel = platform === "reels" ? "Reels" : "vídeos";
  const platformEmoji = platform === "reels" ? "🎬" : "📱";

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
          <span className={styles.statNum}>{platformEmoji}</span>
          <span className={styles.statLabel}>{numVideos} {platformLabel}</span>
        </div>
        <div className={styles.statItem}>
          <span className={styles.statNum}>{numTasks}</span>
          <span className={styles.statLabel}>tarefas</span>
        </div>
      </div>

      <div>
        <div className={styles.helperInputLabel}>
          {!s.videosWatched
            ? `Assista ${numVideos} ${platformLabel}, depois marque aqui:`
            : `Fez ${s.taskInCycle + 1}ª tarefa do ciclo?`}
        </div>
        {!s.videosWatched ? (
          <button
            className={styles.helperSmallBtn}
            style={{ width: "100%" }}
            onClick={() => onChange({ ...s, videosWatched: true })}
          >
            ✓ Assisti os {numVideos} {platformLabel}
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
