import { useState } from "react";
import TaskSelector from "../TaskSelector";
import CountdownTimer from "../CountdownTimer";
import styles from "./session.module.css";

export default function MomentumSession({ tasks, onCompleteTask, onToggleChecklist, onClose }) {
  const [step, setStep] = useState("phone_check");
  const [selectedTask, setSelectedTask] = useState(null);
  const [completed, setCompleted] = useState(0);
  const [doneIds, setDoneIds] = useState(new Set());

  const available = tasks.filter((t) => !t.completed && !doneIds.has(t.id));

  const completeTask = async () => {
    await onCompleteTask(selectedTask.id);
    setDoneIds((p) => new Set([...p, selectedTask.id]));
    setCompleted((c) => c + 1);
    setSelectedTask(null);
    setStep(available.length - 1 === 0 ? "summary" : "post_timer");
  };

  return (
    <div className={styles.root}>
      <div className={styles.header}>
        <span className={styles.headerEmoji}>⚡</span>
        <div className={styles.headerMeta}>
          <span className={styles.headerTitle}>Momentum Mode</span>
          <span className={styles.headerSub}>{completed} tarefa(s) concluída(s)</span>
        </div>
        <button className={styles.closeBtn} onClick={onClose}>✕</button>
      </div>

      <div className={styles.body}>
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
            <button className={`${styles.btn} ${styles.btnDanger}`} onClick={onClose}>
              Não, preciso guardar primeiro
            </button>
          </>
        )}

        {step === "select_task" && (
          <TaskSelector
            tasks={available}
            onSelect={(t) => { setSelectedTask(t); setStep("ready_timer"); }}
            onCancel={() => setStep("phone_check")}
          />
        )}

        {step === "ready_timer" && selectedTask && (() => {
          const live = tasks.find((t) => t.id === selectedTask.id) || selectedTask;
          return (
            <>
              <div className={styles.infoPill}>⚡ Objetivo: apenas COMEÇAR. Mínimo esforço!</div>
              <div className={styles.taskDisplay}>
                <span className={styles.taskName}>{live.title}</span>
                {live.description && <span className={styles.taskMeta}>{live.description}</span>}
                {live.checklist?.length > 0 && (
                  <div className={styles.taskChecklist}>
                    <span className={styles.taskChecklistLabel}>Subtarefas</span>
                    {live.checklist.map((item) => (
                      <button
                        key={item.id}
                        className={`${styles.checklistRow} ${item.completed ? styles.checklistRowDone : ""}`}
                        onClick={() => onToggleChecklist?.(live.id, item.id)}
                      >
                        <span className={styles.checklistBox}>{item.completed ? "✓" : ""}</span>
                        <span className={styles.checklistRowText}>{item.description}</span>
                      </button>
                    ))}
                  </div>
                )}
              </div>
              <button className={`${styles.btn} ${styles.btnPrimary}`} onClick={() => setStep("timing")}>
                ▶ Iniciar timer de 5 minutos
              </button>
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
            <button className={`${styles.btn} ${styles.btnPrimary}`} onClick={onClose}>Fechar</button>
          </>
        )}
      </div>
    </div>
  );
}
