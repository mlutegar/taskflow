import { useState } from "react";
import TaskSelector from "../TaskSelector";
import CountdownTimer from "../CountdownTimer";
import styles from "./session.module.css";

export default function EspressoSession({ tasks, onCompleteTask, onToggleChecklist, onClose }) {
  const [step, setStep] = useState("coffee_check");
  const [selectedTask, setSelectedTask] = useState(null);
  const [completed, setCompleted] = useState(0);
  const [coffees, setCoffees] = useState(0);
  const [sprints, setSprints] = useState(0);
  const [doneIds, setDoneIds] = useState(new Set());

  const available = tasks.filter((t) => !t.completed && !doneIds.has(t.id));

  const completeTask = async () => {
    await onCompleteTask(selectedTask.id);
    setDoneIds((p) => new Set([...p, selectedTask.id]));
    setCompleted((c) => c + 1);
    setSelectedTask(null);
    setStep(available.length - 1 === 0 ? "summary" : "post_sprint");
  };

  return (
    <div className={styles.root}>
      <div className={styles.header}>
        <span className={styles.headerEmoji}>☕</span>
        <div className={styles.headerMeta}>
          <span className={styles.headerTitle}>Espresso Sprint</span>
          <span className={styles.headerSub}>Sprint {sprints + 1} • ☕ {coffees} • ✅ {completed}</span>
        </div>
        <button className={styles.closeBtn} onClick={onClose}>✕</button>
      </div>

      <div className={styles.body}>
        {step === "coffee_check" && (
          <>
            <div className={styles.promptBox}>
              <div className={styles.promptTitle}>☕ Verificação de Café</div>
              <div className={styles.promptText}>
                Você tomou café ou está prestes a tomar? Rastrearemos o consumo durante a sessão.
              </div>
            </div>
            <button className={`${styles.btn} ${styles.btnPrimary}`} onClick={() => { setCoffees(1); setStep("select_task"); }}>
              ☕ Sim, estou com café!
            </button>
            <button className={`${styles.btn} ${styles.btnDanger}`} onClick={onClose}>
              Sem café, sem sprint!
            </button>
          </>
        )}

        {step === "select_task" && (
          <TaskSelector
            tasks={available}
            onSelect={(t) => { setSelectedTask(t); setStep("ready_sprint"); }}
            onCancel={() => setStep("coffee_check")}
          />
        )}

        {step === "ready_sprint" && selectedTask && (
          <>
            <div className={styles.infoPill}>☕ Sprint #{sprints + 1} • {coffees} café(s) esta sessão</div>
            {sprints >= 4 && (
              <div className={styles.infoPill} style={{ color: "var(--warning)", borderColor: "rgba(240,165,64,0.25)" }}>
                ⚠️ {sprints} sprints completos. Considere pausar!
              </div>
            )}
            <div className={styles.taskDisplay}>
              <span className={styles.taskName}>{selectedTask.title}</span>
              {selectedTask.description && <span className={styles.taskMeta}>{selectedTask.description}</span>}
            </div>
            <button className={`${styles.btn} ${styles.btnPrimary}`} onClick={() => setStep("timing")}>
              ▶ Iniciar sprint de 25 minutos
            </button>
          </>
        )}

        {step === "timing" && (
          <CountdownTimer
            seconds={1500}
            title={selectedTask?.title}
            onComplete={() => { setSprints((s) => s + 1); setStep("post_sprint"); }}
            onCancel={() => { setSprints((s) => s + 1); setStep("post_sprint"); }}
          />
        )}

        {step === "post_sprint" && selectedTask && (
          <>
            <div className={styles.infoPill}>Sprint {sprints} completo! ☕ {coffees} café(s)</div>
            <div className={styles.actions}>
              <button className={`${styles.btn} ${styles.btnPrimary}`} onClick={() => { setCoffees((c) => c + 1); setStep("ready_sprint"); }}>
                ☕ Continuar com mais café
              </button>
              <button className={`${styles.btn} ${styles.btnSecondary}`} onClick={() => setStep("ready_sprint")}>
                ⚡ Continuar sem café
              </button>
              <button className={`${styles.btn} ${styles.btnSuccess}`} onClick={completeTask}>
                ✅ Tarefa concluída
              </button>
              <button className={`${styles.btn} ${styles.btnDanger}`} onClick={() => setStep("summary")}>
                ⏹ Encerrar sessão
              </button>
            </div>
          </>
        )}

        {step === "summary" && (
          <>
            <div className={styles.summaryBox}>
              <span className={styles.summaryEmoji}>☕</span>
              <div className={styles.summaryTitle}>Sessão encerrada!</div>
              <div className={styles.summaryText}>{sprints} sprint(s) • {coffees} café(s) • {completed} tarefa(s)</div>
            </div>
            <button className={`${styles.btn} ${styles.btnPrimary}`} onClick={onClose}>Fechar</button>
          </>
        )}
      </div>
    </div>
  );
}
