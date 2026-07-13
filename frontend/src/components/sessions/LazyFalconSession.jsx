import { useState, useEffect } from "react";
import TaskSelector from "../TaskSelector";
import SessionHeader from "./SessionHeader";
import ResumeBanner from "./ResumeBanner";
import WorkingTask from "./WorkingTask";
import styles from "./session.module.css";
import { useModeSession } from "../../hooks/useModeSession";
import { getActivities, addActivity, removeActivity } from "../../lib/activities";

// Tarefas "salvas para depois" (feature do LazyFalcon, separada do estado de sessão)
const LS_KEY = "taskflow_lazyfal_saved";
function loadSaved() { try { return JSON.parse(localStorage.getItem(LS_KEY)) || []; } catch { return []; } }
function persistSaved(d) { localStorage.setItem(LS_KEY, JSON.stringify(d)); }

export default function LazyFalconSession({ tasks, onCompleteTask, onToggleChecklist, onAddChecklist, onClose }) {
  const {
    persist: persistSess, clearSaved: clearSess, saved: sessState,
    completed, setCompleted,
    doneIds, addDone,
    selectedTask, setSelectedTask,
    wasRestored, setWasRestored,
    available,
  } = useModeSession("lazyfal", tasks);

  const [step,        setStep]        = useState(sessState?.step        ?? "select_activity");
  const [activity,    setActivity]    = useState(sessState?.activity    ?? null);
  const [cycle,       setCycle]       = useState(sessState?.cycle       ?? 1);
  const [taskInCycle, setTaskInCycle] = useState(sessState?.taskInCycle ?? 0);
  const [activities,  setActivities]  = useState(() => getActivities());
  const [newActivity, setNewActivity] = useState("");

  // Estado das tarefas salvas para depois (feature específica do LazyFalcon)
  const [saved,     setSaved]     = useState(() => loadSaved());
  const [noteInput, setNoteInput] = useState("");
  const [subStep,   setSubStep]   = useState(null);

  const numTasks = cycle;

  useEffect(() => {
    if (step === "summary") return;
    persistSess({
      step, activity, cycle, taskInCycle, completed,
      doneIds: [...doneIds],
      selectedTaskId: selectedTask?.id ?? null,
    });
  }, [step, activity, cycle, taskInCycle, completed, doneIds, selectedTask]); // eslint-disable-line

  const handleClose = () => { clearSess(); onClose(); };

  const handleAddActivity = () => {
    const updated = addActivity(newActivity);
    setActivities(updated);
    setNewActivity("");
  };
  const handleRemoveActivity = (a) => setActivities(removeActivity(a));

  const doSave = (note) => {
    const existing = saved.findIndex((s) => s.task_id === selectedTask.id);
    let updated;
    if (existing >= 0) {
      updated = [...saved];
      updated[existing] = { ...updated[existing], cycles: (updated[existing].cycles || 1) + 1, note, last: new Date().toISOString().slice(0, 10) };
    } else {
      updated = [...saved, { task_id: selectedTask.id, title: selectedTask.title, note, cycles: 1, last: new Date().toISOString().slice(0, 10) }];
    }
    persistSaved(updated);
    setSaved(updated);
  };

  const doFinalize = async () => {
    await onCompleteTask(selectedTask.id);
    const updated = saved.filter((s) => s.task_id !== selectedTask.id);
    persistSaved(updated);
    setSaved(updated);
    addDone(selectedTask.id);
    setCompleted((c) => c + 1);
    advanceCycle();
  };

  const advanceCycle = () => {
    const next = taskInCycle + 1;
    const rem = available.length - 1;
    if (next >= numTasks || rem <= 0) {
      setTaskInCycle(0);
      setSelectedTask(null);
      setStep(rem <= 0 ? "summary" : "cycle_done");
    } else {
      setTaskInCycle(next);
      setSelectedTask(null);
      setStep("select_task");
    }
  };

  return (
    <div className={styles.root}>
      <SessionHeader
        emoji="🦅"
        title="Lazy Falcon Mode"
        sub={`Ciclo ${cycle} • ✅ ${completed} • 💾 ${saved.length}`}
        onClose={handleClose}
      />

      <div className={styles.body}>
        <ResumeBanner show={wasRestored && step !== "select_activity" && step !== "summary"} onDismiss={() => setWasRestored(false)}>
          ↩ Sessão restaurada — {activity ? `${activity} • ` : ""}Ciclo {cycle}, {completed} tarefa(s) concluída(s)
        </ResumeBanner>

        {saved.length > 0 && step !== "summary" && (
          <>
            <div>
              <span className={styles.sectionLabel}>💾 Tarefas salvas</span>
              <div className={styles.savedTaskList}>
                {saved.map((s) => (
                  <div key={s.task_id} className={styles.savedTask}>
                    <div className={styles.savedTaskTitle}>{s.title}</div>
                    <div className={styles.savedTaskMeta}>
                      {s.cycles} ciclo(s) • última: {s.last}{s.note ? ` • ${s.note}` : ""}
                    </div>
                  </div>
                ))}
              </div>
            </div>
            <hr className={styles.divider} />
          </>
        )}

        {step === "select_activity" && (
          <>
            <div className={styles.promptBox}>
              <div className={styles.promptTitle}>🎯 Escolha sua atividade de recompensa</div>
              <div className={styles.promptText}>Você poderá salvar tarefas para continuar depois.</div>
            </div>
            <div className={styles.activityList}>
              {activities.map((a) => (
                <div key={a} style={{ display: "flex", gap: 6, alignItems: "stretch" }}>
                  <button className={styles.activityItem} style={{ flex: 1 }} onClick={() => { setActivity(a); setStep("doing_activity"); }}>
                    {a}
                  </button>
                  <button
                    className={`${styles.btn} ${styles.btnSecondary}`}
                    style={{ flex: "0 0 auto", padding: "0 12px" }}
                    title="Remover atividade"
                    aria-label={`Remover ${a}`}
                    onClick={() => handleRemoveActivity(a)}
                  >
                    ✕
                  </button>
                </div>
              ))}
            </div>
            <div className={styles.actionsRow} style={{ marginTop: 10 }}>
              <input
                className={styles.input}
                placeholder="Nova atividade..."
                value={newActivity}
                onChange={(e) => setNewActivity(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter") handleAddActivity(); }}
              />
              <button
                className={`${styles.btn} ${styles.btnPrimary}`}
                onClick={handleAddActivity}
                disabled={!newActivity.trim()}
              >
                ＋ Adicionar
              </button>
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
            <TaskSelector
              tasks={available}
              onSelect={(t) => { setSelectedTask(t); setSubStep(null); setStep("task_action"); }}
              onCancel={() => setStep("doing_activity")}
            />
          </>
        )}

        {step === "task_action" && selectedTask && !subStep && (() => {
          const live = tasks.find((t) => t.id === selectedTask.id) || selectedTask;
          return (
            <WorkingTask
              task={live}
              badge={<div className={styles.cycleBadge}>Ciclo {cycle} — Tarefa {taskInCycle + 1} de {numTasks}</div>}
              completeLabel="✅ Finalizar (marcar concluída)"
              onComplete={doFinalize}
              onToggleChecklist={onToggleChecklist}
              onAddChecklist={onAddChecklist}
              onSwap={() => setStep("select_task")}
            >
              <button className={`${styles.btn} ${styles.btnSecondary}`} onClick={() => setSubStep("save_note")}>💾 Salvar para depois</button>
            </WorkingTask>
          );
        })()}

        {step === "task_action" && selectedTask && subStep === "save_note" && (
          <>
            <div className={styles.taskDisplay}>
              <span className={styles.taskName}>{selectedTask.title}</span>
            </div>
            <input
              className={styles.input}
              placeholder="Nota de progresso (opcional)..."
              value={noteInput}
              onChange={(e) => setNoteInput(e.target.value)}
            />
            <div className={styles.actionsRow}>
              <button className={`${styles.btn} ${styles.btnPrimary}`} onClick={() => { doSave(noteInput.trim() || null); setNoteInput(""); setSubStep(null); advanceCycle(); }}>
                💾 Salvar
              </button>
              <button className={`${styles.btn} ${styles.btnSecondary}`} onClick={() => setSubStep(null)}>Voltar</button>
            </div>
          </>
        )}

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
              <span className={styles.summaryEmoji}>🦅</span>
              <div className={styles.summaryTitle}>Sessão encerrada!</div>
              <div className={styles.summaryText}>{completed} concluída(s) • {saved.length} salva(s) • {cycle} ciclo(s)</div>
            </div>
            <button className={`${styles.btn} ${styles.btnPrimary}`} onClick={handleClose}>Fechar</button>
          </>
        )}
      </div>
    </div>
  );
}
