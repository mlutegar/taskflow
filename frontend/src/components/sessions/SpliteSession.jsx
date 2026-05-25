import { useState } from "react";
import TaskSelector from "../TaskSelector";
import SubtaskInline from "./SubtaskInline";
import styles from "./session.module.css";

const ACTIVITIES = [
  "Ler diário", "Escrever no diário", "Beber água", "Jogar Spelunky",
  "Ver Twitter", "Ver um vídeo", "Colocar música", "Ler um capítulo de livro",
  "Esticar 5 minutos", "Meditar", "Fazer exercícios rápidos", "Organizar algo", "Responder mensagens",
];

export default function SpliteSession({ tasks, onCompleteTask, onToggleChecklist, onAddChecklist, onClose }) {
  const [step, setStep] = useState("select_activity");
  const [activity, setActivity] = useState(null);
  const [cycle, setCycle] = useState(1);
  const [taskInCycle, setTaskInCycle] = useState(0);
  const [selectedTask, setSelectedTask] = useState(null);
  const [completed, setCompleted] = useState(0);
  const [doneIds, setDoneIds] = useState(new Set());

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
        <span className={styles.headerEmoji}>🔪</span>
        <div className={styles.headerMeta}>
          <span className={styles.headerTitle}>Splite Mode</span>
          <span className={styles.headerSub}>{activity ? `${activity} • ` : ""}Ciclo {cycle} • {completed} concluída(s)</span>
        </div>
        <button className={styles.closeBtn} onClick={onClose}>✕</button>
      </div>

      <div className={styles.body}>
        {step === "select_activity" && (
          <>
            <div className={styles.promptBox}>
              <div className={styles.promptTitle}>🎯 Escolha sua atividade de recompensa</div>
              <div className={styles.promptText}>Esta será a atividade entre as tarefas.</div>
            </div>
            <div className={styles.activityList}>
              {ACTIVITIES.map((a) => (
                <button key={a} className={styles.activityItem} onClick={() => { setActivity(a); setStep("doing_activity"); }}>
                  {a}
                </button>
              ))}
            </div>
          </>
        )}

        {step === "doing_activity" && (
          <>
            <div className={styles.cycleBadge}>Ciclo {cycle}</div>
            <div className={styles.promptBox}>
              <div className={styles.promptTitle}>🎯 {activity} × {cycle}</div>
              <div className={styles.promptText}>
                Faça "{activity}" {cycle} vez{cycle !== 1 ? "es" : ""}. Depois conclua {numTasks} tarefa{numTasks !== 1 ? "s" : ""}.
              </div>
            </div>
            <button className={`${styles.btn} ${styles.btnPrimary}`} onClick={() => { setTaskInCycle(0); setStep("select_task"); }}>
              ✅ Fiz!
            </button>
            <button className={`${styles.btn} ${styles.btnDanger}`} onClick={() => setStep("summary")}>Encerrar</button>
          </>
        )}

        {step === "select_task" && (
          <>
            <div className={styles.cycleBadge}>Ciclo {cycle} — Tarefa {taskInCycle + 1} de {numTasks}</div>
            <TaskSelector tasks={available} onSelect={(t) => { setSelectedTask(t); setStep("working"); }} onCancel={() => setStep("doing_activity")} />
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
              <div className={styles.promptText}>Próximo: "{activity}" {cycle + 1}x → {cycle + 1} tarefa(s)</div>
            </div>
            <button className={`${styles.btn} ${styles.btnPrimary}`} onClick={() => { setCycle((c) => c + 1); setStep("doing_activity"); }}>Próximo ciclo</button>
            <button className={`${styles.btn} ${styles.btnSecondary}`} onClick={() => setStep("summary")}>Encerrar</button>
          </>
        )}

        {step === "summary" && (
          <>
            <div className={styles.summaryBox}>
              <span className={styles.summaryEmoji}>🔪</span>
              <div className={styles.summaryTitle}>Sessão encerrada!</div>
              <div className={styles.summaryText}>{completed} tarefa(s) em {cycle} ciclo(s) com "{activity}".</div>
            </div>
            <button className={`${styles.btn} ${styles.btnPrimary}`} onClick={onClose}>Fechar</button>
          </>
        )}
      </div>
    </div>
  );
}
