import { memo } from "react";
import styles from "../DailyFocus.module.css";

function formatElapsed(secs) {
  const h = Math.floor(secs / 3600);
  const m = Math.floor((secs % 3600) / 60);
  const s = secs % 60;
  if (h > 0) {
    return `${h}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
  }
  return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

function TabModeBar({ tasks, currentIdx, onSwitch, onNextTab, onAddTab, cycleCount, elapsedSecs }) {
  const isLast = currentIdx === tasks.length - 1;

  return (
    <div className={styles.tabModeBar}>
      {/* Linha de abas */}
      <div className={styles.tabModeTabsRow}>
        {tasks.map((task, i) => (
          <button
            key={i}
            className={[
              styles.tabModeTab,
              i === currentIdx ? styles.tabModeTabActive : "",
              task.done ? styles.tabModeTabDone : "",
            ].join(" ")}
            onClick={() => onSwitch(i)}
            title={task.title || `Aba ${i + 1}`}
          >
            <span className={styles.tabModeTabNum}>{i + 1}</span>
            {task.done && <span className={styles.tabModeTabDoneIcon}>✓</span>}
          </button>
        ))}

        {/* Botão adicionar nova aba */}
        <button
          className={styles.tabModeAddTab}
          onClick={onAddTab}
          title="Abrir nova aba"
        >
          +
        </button>
      </div>

      {/* Título da aba atual */}
      <div className={styles.tabModeCurrentTitle}>
        {tasks[currentIdx]?.title || `Aba ${currentIdx + 1}`}
      </div>

      {/* Stats: ciclo + cronômetro */}
      <div className={styles.tabModeStats}>
        <span className={styles.tabModeCycle}>
          🔄 {cycleCount === 0 ? "Ciclo 1" : `Ciclo #${cycleCount + 1}`}
        </span>
        <span className={styles.tabModeElapsed}>⏱ {formatElapsed(elapsedSecs)}</span>
      </div>

      {/* Botão próxima aba */}
      <button className={styles.tabModeNextBtn} onClick={onNextTab}>
        {isLast
          ? `↩ Completar ciclo e voltar à aba 1`
          : `→ Próxima aba (${currentIdx + 2} / ${tasks.length})`}
      </button>
    </div>
  );
}

export default memo(TabModeBar);
