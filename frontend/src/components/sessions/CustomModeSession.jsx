import { useState, useEffect } from "react";
import TaskSelector from "../TaskSelector";
import SubtaskFlow from "./SubtaskFlow";
import SubtaskInline from "./SubtaskInline";
import styles from "./session.module.css";
import { useSessionPersist } from "../../lib/useSessionPersist";

/**
 * Sessão genérica para modos personalizados criados pelo usuário.
 * Exibe os passos do modo, permite selecionar e concluir tarefas.
 */
export default function CustomModeSession({ mode, tasks, onCompleteTask, onToggleChecklist, onAddChecklist, onClose }) {
  // Cada modo custom tem sua própria chave baseada no id
  const { saved, persist, clearSaved } = useSessionPersist(`custom_${mode?.id}`);

  const [step,        setStep]        = useState(saved?.step      ?? "intro");
  const [completed,   setCompleted]   = useState(saved?.completed ?? 0);
  const [doneIds,     setDoneIds]     = useState(() => new Set(saved?.doneIds ?? []));
  const [selectedTask, setSelectedTask] = useState(() => {
    if (!saved?.selectedTaskId) return null;
    return tasks.find((t) => t.id === saved.selectedTaskId) || null;
  });
  const [wasRestored, setWasRestored] = useState(!!saved);

  const available = tasks.filter((t) => !t.completed && !doneIds.has(t.id));

  useEffect(() => {
    if (step === "summary") return;
    persist({ step, completed, doneIds: [...doneIds], selectedTaskId: selectedTask?.id ?? null });
  }, [step, completed, doneIds, selectedTask]); // eslint-disable-line

  const handleClose        = () => { clearSaved(); onClose(); };
  const handleSummaryClose  = () => { clearSaved(); onClose(); };

  const completeTask = async () => {
    await onCompleteTask(selectedTask.id);
    setDoneIds((p) => new Set([...p, selectedTask.id]));
    setCompleted((c) => c + 1);
    setSelectedTask(null);
    setStep(available.length - 1 === 0 ? "summary" : "post_task");
  };

  const modeColor = mode?.color || "var(--accent)";
  const modeBg    = mode?.colorBg || "rgba(124,110,245,0.08)";

  return (
    <div className={styles.root}>
      {/* ── Header ── */}
      <div className={styles.header}>
        <span className={styles.headerEmoji}>{mode?.emoji || "🚀"}</span>
        <div className={styles.headerMeta}>
          <span className={styles.headerTitle}>{mode?.name || "Modo Personalizado"}</span>
          <span className={styles.headerSub}>{completed} tarefa(s) concluída(s)</span>
        </div>
        <button className={styles.closeBtn} onClick={handleClose}>✕</button>
      </div>

      <div className={styles.body}>

        {/* ── Introdução ── */}
        {step === "intro" && (
          <>
            <div className={styles.promptBox} style={{ background: modeBg, borderColor: `${modeColor}33` }}>
              <div className={styles.promptTitle} style={{ color: modeColor }}>
                {mode?.emoji} {mode?.tagline || "Vamos começar!"}
              </div>

              {mode?.steps?.length > 0 && (
                <ol className={styles.stepList} style={{ marginTop: 8 }}>
                  {mode.steps.map((s, i) => (
                    <li key={i} className={styles.stepItem}>
                      <span className={styles.stepNum} style={{ background: modeColor }}>{i + 1}</span>
                      {s}
                    </li>
                  ))}
                </ol>
              )}
            </div>

            {mode?.tips && (
              <div className={styles.infoPill} style={{ borderColor: `${modeColor}33`, color: "var(--text-muted)" }}>
                💡 {mode.tips}
              </div>
            )}

            <button
              className={`${styles.btn} ${styles.btnPrimary}`}
              style={{ background: modeColor }}
              onClick={() => available.length === 0 ? setStep("summary") : setStep("select_task")}
            >
              ▶ Começar sessão
            </button>
          </>
        )}

        {/* ── Selecionar tarefa ── */}
        {step === "select_task" && (
          <>
            <div className={styles.cycleBadge} style={{ background: `${modeColor}1a`, borderColor: `${modeColor}40`, color: modeColor }}>
              {mode?.emoji} Tarefa {completed + 1}
            </div>
            <TaskSelector
              tasks={available}
              onSelect={(t) => { setSelectedTask(t); setStep("working"); }}
              onCancel={() => setStep("intro")}
            />
          </>
        )}

        {/* ── Trabalhando na tarefa ── */}
        {step === "working" && selectedTask && (() => {
          const live = tasks.find((t) => t.id === selectedTask.id) || selectedTask;
          const hasChecklist = live.checklist?.length > 0;
          return (
            <>
              <div
                className={styles.cycleBadge}
                style={{ background: `${modeColor}1a`, borderColor: `${modeColor}40`, color: modeColor }}
              >
                {mode?.emoji} Tarefa {completed + 1}
              </div>

              <div className={styles.taskDisplay} style={{ borderLeftColor: modeColor }}>
                <span className={styles.taskName}>{live.title}</span>
                {live.description && <span className={styles.taskMeta}>{live.description}</span>}

                {hasChecklist && (
                  <SubtaskFlow
                    checklist={live.checklist}
                    onToggle={(itemId) => onToggleChecklist?.(live.id, itemId)}
                    onAllDone={completeTask}
                    onSkip={completeTask}
                  />
                )}
              </div>

              <div className={styles.actions}>
                {!hasChecklist && (
                  <button
                    className={`${styles.btn} ${styles.btnSuccess}`}
                    onClick={completeTask}
                  >
                    ✅ Concluída!
                  </button>
                )}
                <button
                  className={`${styles.btn} ${styles.btnSecondary}`}
                  onClick={() => { setSelectedTask(null); setStep("select_task"); }}
                >
                  Trocar tarefa
                </button>
                <SubtaskInline taskId={live.id} onAdd={onAddChecklist} />
              </div>
            </>
          );
        })()}

        {/* ── Pós-tarefa: continuar? ── */}
        {step === "post_task" && (
          <>
            <div className={styles.promptBox} style={{ background: modeBg, borderColor: `${modeColor}33` }}>
              <div className={styles.promptTitle}>✓ Tarefa {completed} concluída!</div>
              <div className={styles.promptText}>
                {available.length} tarefa{available.length !== 1 ? "s" : ""} ainda disponíve{available.length !== 1 ? "is" : "l"}.
              </div>
            </div>
            <button
              className={`${styles.btn} ${styles.btnPrimary}`}
              style={{ background: modeColor }}
              onClick={() => setStep("select_task")}
            >
              Próxima tarefa
            </button>
            <button
              className={`${styles.btn} ${styles.btnSecondary}`}
              onClick={() => setStep("summary")}
            >
              Encerrar sessão
            </button>
          </>
        )}

        {/* ── Resumo ── */}
        {step === "summary" && (
          <>
            <div className={styles.summaryBox}>
              <span className={styles.summaryEmoji}>{mode?.emoji || "🚀"}</span>
              <div className={styles.summaryTitle}>Sessão encerrada!</div>
              <div className={styles.summaryText}>
                {completed > 0
                  ? `${completed} tarefa${completed !== 1 ? "s" : ""} concluída${completed !== 1 ? "s" : ""} em "${mode?.name}".`
                  : "Sessão encerrada sem tarefas concluídas."}
              </div>
            </div>
            <button className={`${styles.btn} ${styles.btnPrimary}`} onClick={onClose}>Fechar</button>
          </>
        )}

      </div>
    </div>
  );
}
