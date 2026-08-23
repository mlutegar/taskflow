import { useState, useEffect } from "react";
import TaskSelector from "../TaskSelector";
import CountdownTimer from "../CountdownTimer";
import SubtaskInline from "./SubtaskInline";
import SubtaskFlow from "./SubtaskFlow";
import BaseSession from "./BaseSession";
import styles from "./session.module.css";
import { useSessionPersist } from "../../lib/useSessionPersist";

type Step = "phone_check" | "select_task" | "ready_timer" | "timing" | "post_timer" | "summary";

interface Task {
  id: string;
  title: string;
  description?: string;
  completed?: boolean;
  checklist?: { id: string; text: string; done?: boolean }[];
}

interface MomentumSessionProps {
  tasks: Task[];
  onCompleteTask: (id: string) => Promise<void>;
  onToggleChecklist?: (taskId: string, itemId: string) => void;
  onAddChecklist?: (taskId: string, text: string) => void;
  onClose: () => void;
  onComplete?: () => void;
}

export default function MomentumSession({ tasks, onCompleteTask, onToggleChecklist, onAddChecklist, onClose, onComplete }: MomentumSessionProps) {
  const { saved, persist, clearSaved } = useSessionPersist("momentum");

  const [step,        setStep]        = useState<Step>(saved?.step      ?? "phone_check");
  const [completed,   setCompleted]   = useState<number>(saved?.completed ?? 0);
  const [doneIds,     setDoneIds]     = useState<Set<string>>(() => new Set(saved?.doneIds ?? []));
  const [selectedTask, setSelectedTask] = useState<Task | null>(() => {
    if (!saved?.selectedTaskId) return null;
    return tasks.find((t) => t.id === saved.selectedTaskId) || null;
  });
  const [wasRestored, setWasRestored] = useState<boolean>(!!saved);

  const available = tasks.filter((t) => !t.completed && !doneIds.has(t.id));

  // Persistir sempre que estado mudar
  useEffect(() => {
    if (step === "summary") return;
    persist({ step, completed, doneIds: [...doneIds], selectedTaskId: selectedTask?.id ?? null });
  }, [step, completed, doneIds, selectedTask]); // eslint-disable-line

  const handleClose       = (): void => { clearSaved(); onClose(); };
  const handleSummaryClose = (): void => { clearSaved(); if (onComplete) onComplete(); else onClose(); };

  const completeTask = async (): Promise<void> => {
    await onCompleteTask(selectedTask!.id);
    setDoneIds((p) => new Set([...p, selectedTask!.id]));
    setCompleted((c) => c + 1);
    setSelectedTask(null);
    setStep(available.length - 1 === 0 ? "summary" : "post_timer");
  };

  return (
    <BaseSession
      emoji="⚡"
      title="Momentum Mode"
      sub={`${completed} tarefa(s) concluída(s)`}
      onClose={handleClose}
      showResume={wasRestored && step !== "phone_check" && step !== "summary"}
      resumeMessage={`↩ Sessão restaurada — ${completed} tarefa(s) concluída(s)`}
      onDismissResume={() => setWasRestored(false)}
    >
        {step === "phone_check" && (
          <>
            <div className={styles.promptBox}>
              <div className={styles.promptTitle}>📱 Verificação do Celular</div>
              <div className={styles.promptText}>
                Seu celular está em outro cômodo ou desligado? Isso é fundamental para quebrar a inércia!
              </div>
            </div>
            <button className={`${styles.btn} ${styles.btnPrimary}`} onClick={() => setStep("select_task")}>
              ✅ Celular está longe
            </button>
            <button className={`${styles.btn} ${styles.btnDanger}`} onClick={handleClose}>
              Não, preciso guardar primeiro
            </button>
          </>
        )}

        {step === "select_task" && (
          <TaskSelector
            tasks={available}
            onSelect={(t: Task) => { setSelectedTask(t); setStep("ready_timer"); }}
            onCancel={() => setStep("phone_check")}
          />
        )}

        {step === "ready_timer" && selectedTask && (() => {
          const live = tasks.find((t) => t.id === selectedTask.id) || selectedTask;
          const hasChecklist = live.checklist?.length > 0;
          return (
            <>
              <div className={styles.infoPill}>⚡ Objetivo: apenas COMEÇAR. Mínimo esforço!</div>
              <div className={styles.taskDisplay}>
                <span className={styles.taskName}>{live.title}</span>
                {live.description && <span className={styles.taskMeta}>{live.description}</span>}
                {hasChecklist && (
                  <SubtaskFlow
                    checklist={live.checklist}
                    onToggle={(itemId: string) => onToggleChecklist?.(live.id, itemId)}
                    onAllDone={completeTask}
                    onSkip={() => setStep("timing")}
                  />
                )}
              </div>
              <SubtaskInline taskId={live.id} onAdd={onAddChecklist} />
              {!hasChecklist && (
                <button className={`${styles.btn} ${styles.btnPrimary}`} onClick={() => setStep("timing")}>
                  ▶ Iniciar timer de 5 minutos
                </button>
              )}
            </>
          );
        })()}

        {step === "timing" && (
          <CountdownTimer
            seconds={300}
            title={selectedTask?.title}
            onComplete={() => setStep("post_timer")}
            onCancel={() => setStep("post_timer")}
          />
        )}

        {step === "post_timer" && selectedTask && (
          <>
            <div className={styles.promptBox}>
              <div className={styles.promptTitle}>✓ Você apareceu!</div>
              <div className={styles.promptText}>Isso é o que importa. O que quer fazer agora?</div>
            </div>
            <div className={styles.actions}>
              <button className={`${styles.btn} ${styles.btnPrimary}`} onClick={() => setStep("timing")}>🔄 Mais 5 minutos</button>
              <button className={`${styles.btn} ${styles.btnSuccess}`} onClick={completeTask}>✅ Tarefa concluída</button>
              <SubtaskInline taskId={selectedTask.id} onAdd={onAddChecklist} />
              <button className={`${styles.btn} ${styles.btnSecondary}`} onClick={() => setStep("summary")}>⏹ Parar (fiz progresso!)</button>
            </div>
          </>
        )}

        {step === "summary" && (
          <>
            <div className={styles.summaryBox}>
              <span className={styles.summaryEmoji}>⚡</span>
              <div className={styles.summaryTitle}>Momentum gerado!</div>
              <div className={styles.summaryText}>{completed > 0 ? `${completed} tarefa(s) concluída(s).` : "Você apareceu. Isso importa."}</div>
            </div>
            <button className={`${styles.btn} ${styles.btnPrimary}`} onClick={handleSummaryClose}>📝 Registrar uso</button>
          </>
        )}
    </BaseSession>
  );
}
