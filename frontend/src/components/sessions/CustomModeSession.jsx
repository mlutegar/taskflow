import { useState, useEffect } from "react";
import TaskSelector from "../TaskSelector";
import SessionHeader from "./SessionHeader";
import ResumeBanner from "./ResumeBanner";
import WorkingTask from "./WorkingTask";
import styles from "./session.module.css";
import { useModeSession } from "../../hooks/useModeSession";

/**
 * Sessão genérica para modos personalizados criados pelo usuário.
 * Exibe os passos do modo, permite selecionar e concluir tarefas.
 */
export default function CustomModeSession({ mode, tasks, onCompleteTask, onToggleChecklist, onAddChecklist, onClose }) {
  const {
    persist, clearSaved, saved,
    completed, setCompleted,
    doneIds, addDone,
    selectedTask, setSelectedTask,
    wasRestored, setWasRestored,
    available,
  } = useModeSession(`custom_${mode?.id}`, tasks);

  const [step, setStep] = useState(saved?.step ?? "intro");

  useEffect(() => {
    if (step === "summary") return;
    persist({ step, completed, doneIds: [...doneIds], selectedTaskId: selectedTask?.id ?? null });
  }, [step, completed, doneIds, selectedTask]); // eslint-disable-line

  const handleClose = () => { clearSaved(); onClose(); };

  const completeTask = async () => {
    await onCompleteTask(selectedTask.id);
    addDone(selectedTask.id);
    setCompleted((c) => c + 1);
    setSelectedTask(null);
    setStep(available.length - 1 === 0 ? "summary" : "post_task");
  };

  const modeColor = mode?.color || "var(--accent)";
  const modeBg    = mode?.colorBg || "rgba(124,110,245,0.08)";

  const badge = (
    <div className={styles.cycleBadge} style={{ background: `${modeColor}1a`, borderColor: `${modeColor}40`, color: modeColor }}>
      {mode?.emoji} Tarefa {completed + 1}
    </div>
  );

  return (
    <div className={styles.root}>
      <SessionHeader
        emoji={mode?.emoji || "🚀"}
        title={mode?.name || "Modo Personalizado"}
        sub={`${completed} tarefa(s) concluída(s)`}
        onClose={handleClose}
      />

      <div className={styles.body}>
        <ResumeBanner show={wasRestored && step !== "intro" && step !== "summary"} onDismiss={() => setWasRestored(false)}>
          ↩ Sessão restaurada — {completed} tarefa(s) concluída(s)
        </ResumeBanner>

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
            {badge}
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
          return (
            <WorkingTask
              task={live}
              badge={badge}
              onComplete={completeTask}
              onToggleChecklist={onToggleChecklist}
              onAddChecklist={onAddChecklist}
              onSwap={() => { setSelectedTask(null); setStep("select_task"); }}
            />
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
            <button className={`${styles.btn} ${styles.btnSecondary}`} onClick={() => setStep("summary")}>
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
            <button className={`${styles.btn} ${styles.btnPrimary}`} onClick={handleClose}>Fechar</button>
          </>
        )}
      </div>
    </div>
  );
}
