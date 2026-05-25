import { useState } from "react";
import TaskSelector from "../TaskSelector";
import SubtaskInline from "./SubtaskInline";
import styles from "./session.module.css";

const ACTIVITIES = [
  "Ler diário", "Escrever no diário", "Beber água", "Jogar Spelunky",
  "Ver Twitter", "Ver um vídeo", "Colocar música", "Ler um capítulo de livro",
  "Esticar 5 minutos", "Meditar", "Fazer exercícios rápidos", "Organizar algo", "Responder mensagens",
];

const LS_KEY = "taskflow_lazyfal_saved";

function loadSaved() { try { return JSON.parse(localStorage.getItem(LS_KEY)) || []; } catch { return []; } }
function persistSaved(d) { localStorage.setItem(LS_KEY, JSON.stringify(d)); }

export default function LazyFalconSession({ tasks, onCompleteTask, onToggleChecklist, onClose }) {
  const [step, setStep] = useState("select_activity");
  const [activity, setActivity] = useState(null);
  const [cycle, setCycle] = useState(1);
  const [taskInCycle, setTaskInCycle] = useState(0);
  const [selectedTask, setSelectedTask] = useState(null);
  const [completed, setCompleted] = useState(0);
  const [doneIds, setDoneIds] = useState(new Set());
  const [saved, setSaved] = useState(() => loadSaved());
  const [noteInput, setNoteInput] = useState("");
  const [subStep, setSubStep] = useState(null);

  const numTasks = cycle;
  const available = tasks.filter((t) => !t.completed && !doneIds.has(t.id));

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
    setDoneIds((p) => new Set([...p, selectedTask.id]));
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
      <div className={styles.header}>
        <span className={styles.headerEmoji}>🦅</span>
        <div className={styles.headerMeta}>
          <span className={styles.headerTitle}>Lazy Falcon Mode</span>
          <span className={styles.headerSub}>Ciclo {cycle} • ✅ {completed} • 💾 {saved.length}</span>
        </div>
        <button className={styles.closeBtn} onClick={onClose}>✕</button>
      </div>

      <div className={styles.body}>
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
                <button className={`${styles.btn} ${styles.btnSuccess}`} onClick={doFinalize}>✅ Finalizar (marcar concluída)</button>
                <button className={`${styles.btn} ${styles.btnSecondary}`} onClick={() => setSubStep("save_note")}>💾 Salvar para depois</button>
                <button className={`${styles.btn} ${styles.btnSecondary}`} onClick={() => setStep("select_task")}>Trocar tarefa</button>
              </div>
            </>
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
            <button className={`${styles.btn} ${styles.btnPrimary}`} onClick={onClose}>Fechar</button>
          </>
        )}
      </div>
    </div>
  );
}
