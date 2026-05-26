import { useState, useEffect } from "react";
import TaskSelector from "../TaskSelector";
import CountdownTimer from "../CountdownTimer";
import SubtaskInline from "./SubtaskInline";
import SubtaskFlow from "./SubtaskFlow";
import styles from "./session.module.css";
import { useSessionPersist } from "../../lib/useSessionPersist";

export default function EspressoSession({ tasks, onCompleteTask, onToggleChecklist, onAddChecklist, onClose }) {
  const { saved, persist, clearSaved } = useSessionPersist("espresso");

  const [step,        setStep]        = useState(saved?.step      ?? "coffee_check");
  const [completed,   setCompleted]   = useState(saved?.completed ?? 0);
  const [coffees,     setCoffees]     = useState(saved?.coffees   ?? 0);
  const [sprints,     setSprints]     = useState(saved?.sprints   ?? 0);
  const [doneIds,     setDoneIds]     = useState(() => new Set(saved?.doneIds ?? []));
  const [selectedTask, setSelectedTask] = useState(() => {
    if (!saved?.selectedTaskId) return null;
    return tasks.find((t) => t.id === saved.selectedTaskId) || null;
  });
  const [wasRestored, setWasRestored] = useState(!!saved);

  const available = tasks.filter((t) => !t.completed && !doneIds.has(t.id));

  useEffect(() => {
    if (step === "summary") return;
    persist({ step, completed, coffees, sprints, doneIds: [...doneIds], selectedTaskId: selectedTask?.id ?? null });
  }, [step, completed, coffees, sprints, doneIds, selectedTask]); // eslint-disable-line

  const handleClose        = () => { clearSaved(); onClose(); };
  const handleSummaryClose  = () => { clearSaved(); onClose(); };

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
        <button className={styles.closeBtn} onClick={handleClose}>✕</button>
      </div>

      <div className={styles.body}>

        {wasRestored && step !== "coffee_check" && step !== "summary" && (
          <div className={styles.resumeBanner}>
            ↩ Sessão restaurada — Sprint {sprints + 1}, ☕ {coffees}, {completed} tarefa(s)
            <button className={styles.resumeDismiss} onClick={() => setWasRestored(false)}>✕</button>
          </div>
        )}

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
            <button className={`${styles.btn} ${styles.btnDanger}`} onClick={handleClose}>
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

        {step === "ready_sprint" && selectedTask && (() => {
          const live = tasks.find((t) => t.id === selectedTask.id) || selectedTask;
          const hasChecklist = live.checklist?.length > 0;
          return (
            <>
              <div className={styles.infoPill}>☕ Sprint #{sprints + 1} • {coffees} café(s) esta sessão</div>
              {sprints >= 4 && (
                <div className={styles.infoPill} style={{ color: "var(--warning)", borderColor: "rgba(240,165,64,0.25)" }}>
                  ⚠️ {sprints} sprints completos. Considere pausar!
                </div>
              )}
              <div className={styles.taskDisplay}>
                <span className={styles.taskName}>{live.title}</span>
                {live.description && <span className={styles.taskMeta}>{live.description}</span>}
                {hasChecklist && (
                  <SubtaskFlow
                    checklist={live.checklist}
                    onToggle={(itemId) => onToggleChecklist?.(live.id, itemId)}
                    onAllDone={completeTask}
                    onSkip={() => setStep("timing")}
                  />
                )}
              </div>
              <SubtaskInline taskId={live.id} onAdd={onAddChecklist} />
              {!hasChecklist && (
                <button className={`${styles.btn} ${styles.btnPrimary}`} onClick={() => setStep("timing")}>
                  ▶ Iniciar sprint de 25 minutos
                </button>
              )}
            </>
          );
        })()}

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
              <SubtaskInline taskId={selectedTask.id} onAdd={onAddChecklist} />
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
            <button className={`${styles.btn} ${styles.btnPrimary}`} onClick={handleSummaryClose}>Fechar</button>
          </>
        )}
      </div>
    </div>
  );
}
