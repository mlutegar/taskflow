import { useState, useEffect } from "react";
import styles from "./ModeSession.module.css";
import ModalOverlay from "./shared/ModalOverlay";
import { useDialog } from "../lib/useDialog";
import { logActivation } from "../lib/modeActivations";
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
import SingSession from "./sessions/SingSession";
import PomodoroSession from "./sessions/PomodoroSession";
import DiarioFaladoSession from "./sessions/DiarioFaladoSession";

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
  sing: SingSession,
  pomodoro: PomodoroSession,
  // Modos de atividade independentes — reutilizam SpliteSession com preset
  agua: SpliteSession,
  meditar: SpliteSession,
  ler_diario: SpliteSession,
  esticar: SpliteSession,
  livro: SpliteSession,
  exercicio: SpliteSession,
  diario_falado: DiarioFaladoSession,
};

export default function ModeSession({ modeId, mode, tasks, routines = [], onCompleteTask, onCompleteRoutine, onAddTask, onAddChecklist, onToggleChecklist, onAddRoutineChecklist, onToggleRoutineChecklist, onTaskComplete, onClose }) {
  const [quickAdd, setQuickAdd] = useState(false);
  const [confirmingClose, setConfirmingClose] = useState(false);

  // Intercepta o fechamento para mostrar confirmação
  const handleClose = () => setConfirmingClose(true);

  // Registra ativação do modo ao abrir a sessão
  useEffect(() => {
    if (modeId) logActivation(modeId);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps
  const [qaMode, setQaMode] = useState("task"); // "task" | "subtask"
  const [qaTitle, setQaTitle] = useState("");
  const [qaParent, setQaParent] = useState("");
  const [qaSaving, setQaSaving] = useState(false);
  const [qaSuccess, setQaSuccess] = useState(null); // "task" | "subtask" | null

  const dialogRef = useDialog(handleClose);

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

  const Session = SESSION_MAP[mode?.session || modeId];
  const preset = mode?.preset;

  // Modo personalizado: usa sessão genérica se não há entrada no mapa
  const isCustom = !Session && mode?.isCustom;
  if (!Session && !isCustom) return null;

  return (
    <ModalOverlay onClose={handleClose}>
      <div className={styles.modal} ref={dialogRef} role="dialog" aria-modal="true" aria-label={mode?.name ? `Sessão: ${mode.name}` : "Sessão de modo"} tabIndex={-1}>
        {/* ── Confirmação de encerramento ─── */}
        {confirmingClose && (
          <div style={{
            position: "sticky", top: 0, zIndex: 10,
            background: "var(--surface)",
            borderBottom: "1px solid var(--border)",
            padding: "14px 18px",
            display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap",
          }}>
            <span style={{ flex: 1, fontSize: 13, fontWeight: 600, color: "var(--text)" }}>
              ⚠️ Encerrar a sessão? O progresso será perdido.
            </span>
            <button
              onClick={onClose}
              style={{
                padding: "7px 14px", borderRadius: "var(--radius-sm)", border: "none",
                background: "#e05252", color: "#fff", fontWeight: 700, fontSize: 13, cursor: "pointer",
              }}
            >
              Encerrar
            </button>
            <button
              onClick={() => setConfirmingClose(false)}
              style={{
                padding: "7px 14px", borderRadius: "var(--radius-sm)",
                border: "1px solid var(--border)", background: "var(--surface-2)",
                color: "var(--text-muted)", fontWeight: 600, fontSize: 13, cursor: "pointer",
              }}
            >
              Cancelar
            </button>
          </div>
        )}
        {isCustom ? (
          <CustomModeSession
            mode={mode}
            tasks={items}
            onCompleteTask={wrappedCompleteTask}
            onToggleChecklist={wrappedToggleChecklist}
            onAddChecklist={wrappedAddChecklist}
            onClose={handleClose}
          />
        ) : (
          <Session preset={preset} tasks={items} onCompleteTask={wrappedCompleteTask} onToggleChecklist={wrappedToggleChecklist} onAddChecklist={wrappedAddChecklist} onClose={handleClose} />
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
    </ModalOverlay>
  );
}
