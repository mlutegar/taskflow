import { useState } from "react";
import { getPinned } from "../../../lib/splitePinned";
import styles from "../DailyFocus.module.css";

export const DEFAULT_STATE = { activity: "", cycle: 1, taskInCycle: 0, isDiaryMode: false };

export default function SpliteHelper({ state, onChange }) {
  const s = { ...DEFAULT_STATE, ...state };
  const [query, setQuery] = useState("");
  const pinned = getPinned();

  const filtered = query
    ? pinned.filter((a) => a.toLowerCase().includes(query.toLowerCase()))
    : pinned;

  const selectActivity = (a) => {
    onChange({ ...s, activity: a });
    setQuery("");
  };

  const nextTask = () => {
    const next = s.taskInCycle + 1;
    if (next >= s.cycle) {
      onChange({ ...s, cycle: s.cycle + 1, taskInCycle: 0 });
    } else {
      onChange({ ...s, taskInCycle: next });
    }
  };

  if (!s.activity) {
    return (
      <div className={styles.helperPanelBody}>
        <div>
          <div className={styles.helperInputLabel}>Escolha a atividade de recompensa</div>
          <input
            className={styles.activityInput}
            placeholder="Buscar atividade…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
          {filtered.length > 0 && (
            <div className={styles.activityResults}>
              {filtered.map((a) => (
                <div
                  key={a}
                  className={styles.activityResultItem}
                  onClick={() => selectActivity(a)}
                  role="button"
                  tabIndex={0}
                  aria-label={`Selecionar atividade: ${a}`}
                  onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); selectActivity(a); } }}
                >
                  {a}
                </div>
              ))}
            </div>
          )}
        </div>
        {query.trim() && !pinned.includes(query.trim()) && (
          <button
            className={styles.helperSmallBtn}
            style={{ width: "100%" }}
            onClick={() => selectActivity(query.trim())}
          >
            Usar "{query.trim()}"
          </button>
        )}
      </div>
    );
  }

  return (
    <div className={styles.helperPanelBody}>
      <div className={styles.cycleDisplay}>
        <span className={styles.cycleBadge}>Ciclo {s.cycle}</span>
        <span className={styles.cycleTaskProgress}>
          Tarefa {s.taskInCycle + 1} / {s.cycle}
        </span>
        {s.isDiaryMode && <span className={styles.tag}>📓 Diário</span>}
      </div>

      <div className={styles.statRow}>
        <div className={styles.statItem} style={{ flex: 1 }}>
          <span className={styles.statNum} style={{ fontSize: 14 }}>{s.activity}</span>
          <span className={styles.statLabel}>× {s.cycle}</span>
        </div>
      </div>

      <div className={styles.helperRow}>
        <button
          className={`${styles.helperSmallBtn} ${styles.helperSmallBtnActive}`}
          style={{ flex: 1 }}
          onClick={nextTask}
        >
          ✓ Tarefa {s.taskInCycle + 1}/{s.cycle} feita
        </button>
        <button
          className={styles.helperSmallBtn}
          onClick={() => onChange({ ...s, isDiaryMode: !s.isDiaryMode })}
          title="Alternar modo diário"
        >
          📓
        </button>
        <button
          className={styles.helperSmallBtn}
          onClick={() => onChange({ ...DEFAULT_STATE })}
          title="Trocar atividade"
        >
          ↺
        </button>
      </div>
    </div>
  );
}
