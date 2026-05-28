import { useState } from "react";
import styles from "./ModeSession.module.css";
import MusicSession from "./sessions/MusicSession";
import TikTokSession from "./sessions/TikTokSession";
import SpliteSession from "./sessions/SpliteSession";
import MomentumSession from "./sessions/MomentumSession";
import EspressoSession from "./sessions/EspressoSession";
import RPGSession from "./sessions/RPGSession";
import LazyFalconSession from "./sessions/LazyFalconSession";
import CafeRitualSession from "./sessions/CafeRitualSession";
import TabHopSession from "./sessions/TabHopSession";
import CustomModeSession from "./sessions/CustomModeSession";

const SESSION_MAP = {
  music: MusicSession,
  tiktok: TikTokSession,
  splite: SpliteSession,
  momentum: MomentumSession,
  espresso: EspressoSession,
  rpg: RPGSession,
  lazyfal: LazyFalconSession,
  caferitual: CafeRitualSession,
  tabhop: TabHopSession,
};

export default function ModeSession({ modeId, mode, tasks, routines = [], onCompleteTask, onCompleteRoutine, onAddTask, onAddChecklist, onToggleChecklist, onAddRoutineChecklist, onToggleRoutineChecklist, onTaskComplete, onClose }) {
  const [quickAdd, setQuickAdd] = useState(false);
  const [qaMode, setQaMode] = useState("task"); // "task" | "subtask"
  const [qaTitle, setQaTitle] = useState("");
  const [qaParent, setQaParent] = useState("");
  const [qaSaving, setQaSaving] = useState(false);
  const [qaSuccess, setQaSuccess] = useState(null); // "task" | "subtask" | null

  // Mescla tarefas + rotinas pendentes num array unificado
  const items = [
    ...tasks,
    ...routines
      .filter((r) => !r.is_completed_today)
      .map((r) => ({ ...r, _isRoutine: true, completed: false })),
  ];

  const activeTasks = items.filter((t) => !t.completed);

  const openQuickAdd = (mode) => {
    setQaMode(mode);
    setQaTitle("");
    setQaParent("");
    setQaSuccess(null);
    setQuickAdd(true);
  };

  const handleQaSubmit = async (e) => {
    e.preventDefault();
    if (!qaTitle.trim()) return;
    if (qaMode === "subtask" && !qaParent) return;
    setQaSaving(true);
    try {
      if (qaMode === "task") {
        await onAddTask({ title: qaTitle.trim(), priority: 4 });
        setQaSuccess("task");
      } else {
        await wrappedAddChecklist(qaParent, qaTitle.trim());
        setQaSuccess("subtask");
      }
      setQaTitle("");
      setQaParent("");
      setTimeout(() => {
        setQaSuccess(null);
        setQuickAdd(false);
      }, 1200);
    } finally {
      setQaSaving(false);
    }
  };

  // Handlers unificados: despacham para tarefa ou rotina conforme o tipo do item
  const wrappedCompleteTask = async (id) => {
    const item = items.find((i) => i.id === id);
    if (item?._isRoutine) {
      await onCompleteRoutine?.(id);
    } else {
      await onCompleteTask(id);
    }
    onTaskComplete?.(modeId);
  };

  const wrappedToggleChecklist = async (parentId, itemId) => {
    const parent = items.find((i) => i.id === parentId);
    if (parent?._isRoutine) {
      await onToggleRoutineChecklist?.(parentId, itemId);
    } else {
      await onToggleChecklist?.(parentId, itemId);
    }
  };

  const wrappedAddChecklist = async (parentId, description) => {
    const parent = items.find((i) => i.id === parentId);
    if (parent?._isRoutine) {
      await onAddRoutineChecklist?.(parentId, description);
    } else {
      await onAddChecklist?.(parentId, description);
    }
  };

  const Session = SESSION_MAP[modeId];

  // Modo personalizado: usa sessão genérica se não há entrada no mapa
  const isCustom = !Session && mode?.isCustom;
  if (!Session && !isCustom) return null;

  return (
    <div className={styles.overlay} onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className={styles.modal}>
        {isCustom ? (
          <CustomModeSession
            mode={mode}
            tasks={items}
            onCompleteTask={wrappedCompleteTask}
            onToggleChecklist={wrappedToggleChecklist}
            onAddChecklist={wrappedAddChecklist}
            onClose={onClose}
          />
        ) : (
          <Session tasks={items} onCompleteTask={wrappedCompleteTask} onToggleChecklist={wrappedToggleChecklist} onAddChecklist={wrappedAddChecklist} onClose={onClose} />
        )}

        {/* ── Quick-Add bar ─────────────────────────────────── */}
        <div className={styles.quickAddBar}>
          {!quickAdd ? (
            <div className={styles.quickAddBtns}>
              <button className={styles.qaShortcut} onClick={() => openQuickAdd("task")}>
                <span>＋</span> Nova tarefa
              </button>
              <button className={styles.qaShortcut} onClick={() => openQuickAdd("subtask")}>
                <span>＋</span> Subtarefa
              </button>
            </div>
          ) : (
            <div className={styles.quickAddForm}>
              <div className={styles.qaTabs}>
                <button
                  className={`${styles.qaTab} ${qaMode === "task" ? styles.qaTabActive : ""}`}
                  onClick={() => { setQaMode("task"); setQaTitle(""); setQaParent(""); }}
                  type="button"
                >
                  📋 Tarefa
                </button>
                <button
                  className={`${styles.qaTab} ${qaMode === "subtask" ? styles.qaTabActive : ""}`}
                  onClick={() => { setQaMode("subtask"); setQaTitle(""); setQaParent(""); }}
                  type="button"
                >
                  📌 Subtarefa
                </button>
                <button className={styles.qaClose} onClick={() => setQuickAdd(false)} type="button">✕</button>
              </div>

              {qaSuccess ? (
                <div className={styles.qaSuccessMsg}>
                  {qaSuccess === "task" ? "✅ Tarefa criada!" : "✅ Subtarefa adicionada!"}
                </div>
              ) : (
                <form onSubmit={handleQaSubmit} className={styles.qaInputRow}>
                  {qaMode === "subtask" && (
                    <select
                      className={styles.qaSelect}
                      value={qaParent}
                      onChange={(e) => setQaParent(e.target.value)}
                      required
                    >
                      <option value="">Tarefa pai...</option>
                      {activeTasks.map((t) => (
                        <option key={t.id} value={t.id}>{t.title}</option>
                      ))}
                    </select>
                  )}
                  <div className={styles.qaRow}>
                    <input
                      className={styles.qaInput}
                      value={qaTitle}
                      onChange={(e) => setQaTitle(e.target.value)}
                      placeholder={qaMode === "task" ? "Título da nova tarefa..." : "Descrição da subtarefa..."}
                      autoFocus
                      required
                    />
                    <button
                      type="submit"
                      className={styles.qaSubmit}
                      disabled={qaSaving || !qaTitle.trim() || (qaMode === "subtask" && !qaParent)}
                    >
                      {qaSaving ? "…" : "✓"}
                    </button>
                  </div>
                </form>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
