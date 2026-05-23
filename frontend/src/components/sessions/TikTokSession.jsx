import { useState } from "react";
import TaskSelector from "../TaskSelector";
import styles from "./session.module.css";

export default function TikTokSession({ tasks, onCompleteTask, onToggleChecklist, onClose }) {
  const [step, setStep] = useState("intro");
  const [cycle, setCycle] = useState(1);
  const [taskInCycle, setTaskInCycle] = useState(0);
  const [selectedTask, setSelectedTask] = useState(null);
  const [completed, setCompleted] = useState(0);
  const [doneIds, setDoneIds] = useState(new Set());

  const numVideos = cycle * 5;
  const numTasks = cycle;
  const available = tasks.filter((t) => !t.completed && !doneIds.has(t.id));

  const completeTask = async () => {
    await onCompleteTask(selectedTask.id);
    setDoneIds((p) => new Set([...p, selectedTask.id]));
    setCompleted((c) => c + 1);
    const next = taskInCycle + 1;
    if (next >= numTasks || available.length - 1 === 0) {
      setTaskInCycle(0);
      setSelectedTask(null);
      setStep(available.length - 1 === 0 ? "summary" : "cycle_done");
    } else {
      setTaskInCycle(next);
      setSelectedTask(null);
      setStep("select_task");
    }
  };

  return (
    <div className={styles.root}>
      <div className={styles.header}>
        <span className={styles.headerEmoji}>📱</span>
        <div className={styles.headerMeta}>
          <span className={styles.headerTitle}>TikTok Mode</span>
          <span className={styles.headerSub}>Ciclo {cycle} • {completed} concluída(s)</span>
        </div>
        <button className={styles.closeBtn} onClick={onClose}>✕</button>
      </div>

      <div className={styles.body}>
        {step === "intro" && (
          <>
            <div className={styles.promptBox}>
              <div className={styles.promptTitle}>Ciclos progressivos</div>
              <ol className={styles.stepList}>
                {["Ciclo 1: 5 vídeos → 1 tarefa", "Ciclo 2: 10 vídeos → 2 tarefas", "Ciclo 3: 15 vídeos → 3 tarefas", "Continue: n × 5 vídeos → n tarefas"].map((s, i) => (
                  <li key={i} className={styles.stepItem}><span className={styles.stepNum}>{i + 1}</span>{s}</li>
                ))}
              </ol>
            </div>
            <button className={`${styles.btn} ${styles.btnPrimary}`} onClick={() => available.length === 0 ? setStep("summary") : setStep("watching")}>
              📱 Começar
            </button>
          </>
        )}

        {step === "watching" && (
          <>
            <div className={styles.cycleBadge}>Ciclo {cycle}</div>
            <div className={styles.promptBox}>
              <div className={styles.promptTitle}>📺 Assista {numVideos} vídeos no TikTok</div>
              <div className={styles.promptText}>
                Depois volte aqui para completar {numTasks} tarefa{numTasks !== 1 ? "s" : ""}.
              </div>
            </div>
            <button className={`${styles.btn} ${styles.btnPrimary}`} onClick={() => { setTaskInCycle(0); setStep("select_task"); }}>
              ✅ Assisti os {numVideos} vídeos!
            </button>
            <button className={`${styles.btn} ${styles.btnDanger}`} onClick={() => setStep("summary")}>Encerrar</button>
          </>
        )}

        {step === "select_task" && (
          <>
            <div className={styles.cycleBadge}>Ciclo {cycle} — Tarefa {taskInCycle + 1} de {numTasks}</div>
            <TaskSelector tasks={available} onSelect={(t) => { setSelectedTask(t); setStep("working"); }} onCancel={() => setStep("watching")} />
          </>
        )}

        {step === "working" && selectedTask && (() => {
          const live = tasks.find((t) => t.id === selectedTask.id) || selectedTask;
          return (
            <>
              <div className={styles.cycleBadge}>Ciclo {cycle} — Tarefa {taskInCycle + 1} de {numTasks}</div>
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
              <div className={styles.actions}>
                <button className={`${styles.btn} ${styles.btnSuccess}`} onClick={completeTask}>✅ Concluída!</button>
                <button className={`${styles.btn} ${styles.btnSecondary}`} onClick={() => { setSelectedTask(null); setStep("select_task"); }}>Trocar tarefa</button>
              </div>
            </>
          );
        })()}

        {step === "cycle_done" && (
          <>
            <div className={styles.promptBox}>
              <div className={styles.promptTitle}>🎉 Ciclo {cycle} completo!</div>
              <div className={styles.promptText}>Próximo: {(cycle + 1) * 5} vídeos → {cycle + 1} tarefa(s)</div>
            </div>
            <button className={`${styles.btn} ${styles.btnPrimary}`} onClick={() => { setCycle((c) => c + 1); setStep("watching"); }}>📱 Próximo ciclo</button>
            <button className={`${styles.btn} ${styles.btnSecondary}`} onClick={() => setStep("summary")}>Encerrar</button>
          </>
        )}

        {step === "summary" && (
          <>
            <div className={styles.summaryBox}>
              <span className={styles.summaryEmoji}>📱</span>
              <div className={styles.summaryTitle}>Sessão encerrada!</div>
              <div className={styles.summaryText}>{completed} tarefa(s) em {cycle} ciclo(s).</div>
            </div>
            <button className={`${styles.btn} ${styles.btnPrimary}`} onClick={onClose}>Fechar</button>
          </>
        )}
      </div>
    </div>
  );
}
