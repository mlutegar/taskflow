import { useState } from "react";
import { getPinned } from "../../../lib/splitePinned";
import styles from "../DailyFocus.module.css";

export const DEFAULT_STATE = { activity: "", cycle: 1, taskInCycle: 0, saved: [] };

export default function LazyFalconHelper({ state, onChange }) {
  const s = { ...DEFAULT_STATE, ...state };
  const [query, setQuery] = useState("");
  const [noteInput, setNoteInput] = useState("");
  const [showSaveNote, setShowSaveNote] = useState(false);
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

  const saveForLater = () => {
    const newSaved = [...(s.saved || []), {
      note: noteInput.trim() || "Sem nota",
      savedAt: s.cycle,
    }];
    onChange({ ...s, saved: newSaved });
    setNoteInput("");
    setShowSaveNote(false);
    nextTask();
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
          Tarefa {s.taskInCycle + 1}/{s.cycle}
        </span>
        {(s.saved || []).length > 0 && (
          <span className={styles.tag}>💾 {s.saved.length} salva{s.saved.length !== 1 ? "s" : ""}</span>
        )}
      </div>

      <div className={styles.statRow}>
        <div className={styles.statItem} style={{ flex: 1 }}>
          <span className={styles.statNum} style={{ fontSize: 14 }}>{s.activity}</span>
          <span className={styles.statLabel}>× {s.cycle}</span>
        </div>
      </div>

      {!showSaveNote ? (
        <div className={styles.helperRow}>
          <button
            className={`${styles.helperSmallBtn} ${styles.helperSmallBtnActive}`}
            style={{ flex: 1 }}
            onClick={nextTask}
          >
            ✓ Finalizar
          </button>
          <button
            className={styles.helperSmallBtn}
            style={{ flex: 1 }}
            onClick={() => setShowSaveNote(true)}
          >
            💾 Salvar depois
          </button>
          <button
            className={styles.helperSmallBtn}
            onClick={() => onChange({ ...DEFAULT_STATE })}
            title="Trocar atividade"
          >
            ↺
          </button>
        </div>
      ) : (
        <div className={styles.flexCol} style={{ gap: 6 }}>
          <div className={styles.helperInputLabel}>Nota de progresso (opcional)</div>
          <input
            className={styles.helperInput}
            placeholder="Onde parei…"
            value={noteInput}
            onChange={(e) => setNoteInput(e.target.value)}
            autoFocus
          />
          <div className={styles.helperRow}>
            <button className={`${styles.helperSmallBtn} ${styles.helperSmallBtnActive}`} onClick={saveForLater}>
              💾 Salvar
            </button>
            <button className={styles.helperSmallBtn} onClick={() => setShowSaveNote(false)}>
              Cancelar
            </button>
          </div>
        </div>
      )}

      {(s.saved || []).length > 0 && (
        <div>
          <div className={styles.helperInputLabel}>Tarefas salvas:</div>
          <div className={styles.savedList}>
            {s.saved.map((item, i) => (
              <div key={i} className={styles.savedItem}>
                <span className={styles.savedItemIcon}>💾</span>
                <span>{item.note}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
