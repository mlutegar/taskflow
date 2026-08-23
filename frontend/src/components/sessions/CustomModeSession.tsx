import { useState, useEffect, ReactNode } from "react";
import TaskSelector from "../TaskSelector";
import SessionHeader from "./SessionHeader";
import ResumeBanner from "./ResumeBanner";
import WorkingTask from "./WorkingTask";
import styles from "./session.module.css";
import { useModeSession } from "../../hooks/useModeSession";
import { Task } from "../../types/index";

interface CustomMode {
  id: string;
  name?: string;
  emoji?: string;
  tagline?: string;
  color?: string;
  colorBg?: string;
  steps?: string[];
  tips?: string;
}

interface CustomModeSessionProps {
  mode: CustomMode | null | undefined;
  tasks: Task[];
  onCompleteTask: (id: string) => Promise<void>;
  onToggleChecklist: (taskId: string, itemId: string) => void;
  onAddChecklist: (taskId: string, text: string) => void;
  onClose: () => void;
  onComplete?: (() => void) | null;
}

type Step = "intro" | "select_task" | "working" | "post_task" | "summary";

export default function CustomModeSession({
  mode,
  tasks,
  onCompleteTask,
  onToggleChecklist,
  onAddChecklist,
  onClose,
  onComplete,
}: CustomModeSessionProps): ReactNode {
  const {
    persist, clearSaved, saved,
    completed, setCompleted,
    doneIds, addDone,
    selectedTask, setSelectedTask,
    wasRestored, setWasRestored,
    available,
  } = useModeSession(`custom_${mode?.id}`, tasks);

  const [step, setStep] = useState<Step>(saved?.step ?? "intro");

  useEffect(() => {
    if (step === "summary") return;
    persist({ step, completed, doneIds: [...doneIds], selectedTaskId: selectedTask?.id ?? null });
  }, [step, completed, doneIds, selectedTask]); // eslint-disable-line

  const handleClose = (): void => { clearSaved(); onClose(); };

  const completeTask = async (): Promise<void> => {
    await onCompleteTask(selectedTask.id);
    addDone(selectedTask.id);
    setCompleted((c: number) => c + 1);
    setSelectedTask(null);
    setStep(available.length - 1 === 0 ? "summary" : "post_task");
  };

  const modeColor: string = mode?.color || "var(--accent)";
  const modeBg: string    = mode?.colorBg || "rgba(124,110,245,0.08)";

  const badge: ReactNode = (
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
                  {mode.steps.map((s: string, i: number) => (
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
              onSelect={(t: Task) => { setSelectedTask(t); setStep("working"); }}
              onCancel={() => setStep("intro")}
            />
          </>
        )}

        {/* ── Trabalhando na tarefa ── */}
        {step === "working" && selectedTask && (() => {
          const live: Task = tasks.find((t: Task) => t.id === selectedTask.id) || selectedTask;
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
            <button className={`${styles.btn} ${styles.btnPrimary}`} onClick={onComplete ?? handleClose}>📝 Registrar uso</button>
          </>
        )}
      </div>
    </div>
  );
}
