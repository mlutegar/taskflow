import { useState } from "react";
import TaskSelector from "../TaskSelector";
import SubtaskFlow from "./SubtaskFlow";
import styles from "./session.module.css";

export default function TikTokSession({ tasks, onCompleteTask, onToggleChecklist, onAddChecklist, onClose }) {
  const [step, setStep] = useState("intro");
  const [cycle, setCycle] = useState(1);
  const [taskInCycle, setTaskInCycle] = useState(0);
  const [selectedTask, setSelectedTask] = useState(null);
  const [completed, setCompleted] = useState(0);
  const [doneIds, setDoneIds] = useState(new Set());
  const [showSubtask, setShowSubtask] = useState(false);
  const [subtaskText, setSubtaskText] = useState("");
  const [savingSubtask, setSavingSubtask] = useState(false);

  const numVideos = cycle * 5;
  const numTasks = cycle;
  const available = tasks.filter((t) => !t.completed && !doneIds.has(t.id));

  const resetSubtask = () => { setShowSubtask(false); setSubtaskText(""); };

  // Avança fase após concluir a TAREFA inteira (marca como done, remove de available)
  const advanceAfterTaskComplete = (removedTaskId) => {
    resetSubtask();
    setCompleted((c) => c + 1);
    const remaining = available.filter((t) => t.id !== removedTaskId);
    const next = taskInCycle + 1;
    if (next >= numTasks || remaining.length === 0) {
      setTaskInCycle(0);
      setSelectedTask(null);
      setStep(remaining.length === 0 ? "summary" : "cycle_done");
    } else {
      setTaskInCycle(next);
      setSelectedTask(null);
      setStep("select_task");
    }
  };

  // Avança fase após concluir uma SUBTAREFA (tarefa continua ativa, disponível nos próximos ciclos)
  const advanceAfterSubtaskComplete = () => {
    resetSubtask();
    setCompleted((c) => c + 1);
    const next = taskInCycle + 1;
    if (next >= numTasks) {
      setTaskInCycle(0);
      setSelectedTask(null);
      setStep("cycle_done");
    } else {
      setTaskInCycle(next);
      setSelectedTask(null);
      setStep("select_task");
    }
  };

  const completeTask = async () => {
    await onCompleteTask(selectedTask.id);
    setDoneIds((p) => new Set([...p, selectedTask.id]));
    advanceAfterTaskComplete(selectedTask.id);
  };

  // Ao marcar uma subtarefa como concluída → avança a fase automaticamente
  const handleSubtaskToggle = async (taskId, itemId) => {
    const currentTask = tasks.find((t) => t.id === taskId);
    const item = currentTask?.checklist?.find((c) => c.id === itemId);
    const wasCompleted = item?.completed ?? true;

    await onToggleChecklist?.(taskId, itemId);

    if (!wasCompleted) {
      // Acabou de concluir uma subtarefa → avança fase
      advanceAfterSubtaskComplete();
    }
    // Se wasCompleted = true → só desmarcou, sem avançar
  };

  const handleAddSubtask = async (e) => {
    e.preventDefault();
    if (!subtaskText.trim() || !selectedTask || !onAddChecklist) return;
    setSavingSubtask(true);
    try {
      await onAddChecklist(selectedTask.id, subtaskText.trim());
      setSubtaskText("");
      setShowSubtask(false);
    } finally {
      setSavingSubtask(false);
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
                {[
                  "Ciclo 1: 5 vídeos → 1 tarefa ou subtarefa",
                  "Ciclo 2: 10 vídeos → 2 tarefas ou subtarefas",
                  "Ciclo 3: 15 vídeos → 3 tarefas ou subtarefas",
                  "Continue: n × 5 vídeos → n tarefas/subtarefas",
                ].map((s, i) => (
                  <li key={i} className={styles.stepItem}>
                    <span className={styles.stepNum}>{i + 1}</span>{s}
                  </li>
                ))}
              </ol>
            </div>
            <button
              className={`${styles.btn} ${styles.btnPrimary}`}
              onClick={() => available.length === 0 ? setStep("summary") : setStep("watching")}
            >
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
                Depois volte aqui e conclua {numTasks} tarefa{numTasks !== 1 ? "s" : ""} ou subtarefa{numTasks !== 1 ? "s" : ""}.
              </div>
            </div>
            <button
              className={`${styles.btn} ${styles.btnPrimary}`}
              onClick={() => { setTaskInCycle(0); setStep("select_task"); }}
            >
              ✅ Assisti os {numVideos} vídeos!
            </button>
            <button className={`${styles.btn} ${styles.btnDanger}`} onClick={() => setStep("summary")}>Encerrar</button>
          </>
        )}

        {step === "select_task" && (
          <>
            <div className={styles.cycleBadge}>Ciclo {cycle} — {taskInCycle + 1} de {numTasks}</div>
            <TaskSelector
              tasks={available}
              onSelect={(t) => { setSelectedTask(t); setStep("working"); }}
              onCancel={() => setStep("watching")}
            />
          </>
        )}

        {step === "working" && selectedTask && (() => {
          const live = tasks.find((t) => t.id === selectedTask.id) || selectedTask;
          const hasChecklist = live.checklist?.length > 0;
          const pendingItems = live.checklist?.filter((c) => !c.completed) ?? [];

          return (
            <>
              <div className={styles.cycleBadge}>Ciclo {cycle} — {taskInCycle + 1} de {numTasks}</div>

              <div className={styles.taskDisplay}>
                <span className={styles.taskName}>{live.title}</span>
                {live.description && <span className={styles.taskMeta}>{live.description}</span>}

                {hasChecklist ? (
                  <div className={styles.taskChecklist}>
                    <span className={styles.taskChecklistLabel}>
                      ✓ Conclua uma subtarefa para avançar de fase
                    </span>
                    {live.checklist.map((item) => (
                      <button
                        key={item.id}
                        className={`${styles.checklistRow} ${item.completed ? styles.checklistRowDone : ""}`}
                        onClick={() => handleSubtaskToggle(live.id, item.id)}
                        disabled={item.completed}
                      >
                        <span className={styles.checklistBox}>{item.completed ? "✓" : ""}</span>
                        <span className={styles.checklistRowText}>{item.description}</span>
                      </button>
                    ))}
                    {pendingItems.length === 0 && (
                      <span className={styles.taskMeta} style={{ marginTop: 4 }}>
                        Todas as subtarefas concluídas! Use "Concluir tarefa" abaixo.
                      </span>
                    )}
                  </div>
                ) : (
                  <div className={styles.taskMeta} style={{ marginTop: 4 }}>
                    💡 Sem subtarefas — adicione uma abaixo para avançar por subtarefa, ou conclua a tarefa direto.
                  </div>
                )}
              </div>

              {showSubtask && (
                <form onSubmit={handleAddSubtask} className={styles.actions}>
                  <input
                    className={styles.input}
                    value={subtaskText}
                    onChange={(e) => setSubtaskText(e.target.value)}
                    placeholder="Descrição da subtarefa..."
                    autoFocus
                  />
                  <div className={styles.actionsRow}>
                    <button
                      type="submit"
                      className={`${styles.btn} ${styles.btnPrimary}`}
                      disabled={!subtaskText.trim() || savingSubtask}
                    >
                      {savingSubtask ? "…" : "✓ Adicionar"}
                    </button>
                    <button
                      type="button"
                      className={`${styles.btn} ${styles.btnSecondary}`}
                      onClick={resetSubtask}
                    >
                      Cancelar
                    </button>
                  </div>
                </form>
              )}

              <div className={styles.actions}>
                <button className={`${styles.btn} ${styles.btnSuccess}`} onClick={completeTask}>
                  ✅ Concluir tarefa
                </button>
                <button
                  className={`${styles.btn} ${styles.btnSecondary}`}
                  onClick={() => { setSelectedTask(null); setStep("select_task"); resetSubtask(); }}
                >
                  Trocar tarefa
                </button>
                {onAddChecklist && !showSubtask && (
                  <button
                    className={`${styles.btn} ${styles.btnSecondary}`}
                    onClick={() => setShowSubtask(true)}
                  >
                    📌 Adicionar subtarefa
                  </button>
                )}
              </div>
            </>
          );
        })()}

        {step === "cycle_done" && (
          <>
            <div className={styles.promptBox}>
              <div className={styles.promptTitle}>🎉 Ciclo {cycle} completo!</div>
              <div className={styles.promptText}>
                Próximo: {(cycle + 1) * 5} vídeos → {cycle + 1} tarefa(s) ou subtarefa(s)
              </div>
            </div>
            <button
              className={`${styles.btn} ${styles.btnPrimary}`}
              onClick={() => { setCycle((c) => c + 1); setStep("watching"); }}
            >
              📱 Próximo ciclo
            </button>
            <button className={`${styles.btn} ${styles.btnSecondary}`} onClick={() => setStep("summary")}>
              Encerrar
            </button>
          </>
        )}

        {step === "summary" && (
          <>
            <div className={styles.summaryBox}>
              <span className={styles.summaryEmoji}>📱</span>
              <div className={styles.summaryTitle}>Sessão encerrada!</div>
              <div className={styles.summaryText}>{completed} tarefa(s)/subtarefa(s) em {cycle} ciclo(s).</div>
            </div>
            <button className={`${styles.btn} ${styles.btnPrimary}`} onClick={onClose}>Fechar</button>
          </>
        )}
      </div>
    </div>
  );
}
