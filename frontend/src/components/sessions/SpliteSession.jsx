import { useState, useEffect } from "react";
import TaskSelector from "../TaskSelector";
import SubtaskInline from "./SubtaskInline";
import SubtaskFlow from "./SubtaskFlow";
import styles from "./session.module.css";
import { useSessionPersist } from "../../lib/useSessionPersist";
import { getActivities, addActivity, removeActivity } from "../../lib/activities";

const DIARY_MODE_ACTIVITY = "Escrever no diário";
const READ_DIARY_ACTIVITY = "Ler diário";

// Gera uma data aleatória entre 01/01/2024 e hoje, no formato dd/mm/aaaa
function randomDiaryDate() {
  const start = new Date(2024, 0, 1);       // 1 de janeiro de 2024
  const end = new Date();                    // hoje
  const ms = start.getTime() + Math.random() * (end.getTime() - start.getTime());
  const d = new Date(ms);
  return d.toLocaleDateString("pt-BR");      // dd/mm/aaaa
}

export default function SpliteSession({ preset, tasks, onCompleteTask, onToggleChecklist, onAddChecklist, onClose }) {
  const { saved, persist, clearSaved } = useSessionPersist(preset?.activity ? `splite:${preset.activity}` : "splite");

  // Card com atividade pré-definida: pula a etapa de seleção e já entra no ciclo.
  const presetInit = (() => {
    const a = preset?.activity;
    if (!a) return null;
    if (a === DIARY_MODE_ACTIVITY) return { activity: a, step: "writing_diary", isDiaryMode: true, diaryDate: null };
    return { activity: a, step: "doing_activity", isDiaryMode: false, diaryDate: a === READ_DIARY_ACTIVITY ? randomDiaryDate() : null };
  })();

  const [step,          setStep]          = useState(saved?.step          ?? presetInit?.step       ?? "select_activity");
  const [activity,      setActivity]      = useState(saved?.activity      ?? presetInit?.activity   ?? null);
  const [cycle,         setCycle]         = useState(saved?.cycle         ?? 1);
  const [taskInCycle,   setTaskInCycle]   = useState(saved?.taskInCycle   ?? 0);
  const [selectedTask,  setSelectedTask]  = useState(() => {
    if (!saved?.selectedTaskId) return null;
    return tasks.find((t) => t.id === saved.selectedTaskId) || null;
  });
  const [completed,     setCompleted]     = useState(saved?.completed     ?? 0);
  const [doneIds,       setDoneIds]       = useState(() => new Set(saved?.doneIds ?? []));
  const [isDiaryMode,   setIsDiaryMode]   = useState(saved?.isDiaryMode   ?? presetInit?.isDiaryMode ?? false);
  const [nextDiaryStep, setNextDiaryStep] = useState(saved?.nextDiaryStep ?? "reading_analysis");
  const [diaryDate,     setDiaryDate]     = useState(saved?.diaryDate     ?? presetInit?.diaryDate  ?? null);
  const [wasRestored,   setWasRestored]   = useState(!!saved);
  const [activities,    setActivities]    = useState(() => getActivities());
  const [newActivity,   setNewActivity]   = useState("");

  const handleAddActivity = () => {
    const updated = addActivity(newActivity);
    setActivities(updated);
    setNewActivity("");
  };
  const handleRemoveActivity = (a) => setActivities(removeActivity(a));

  const numTasks = cycle;
  const available = tasks.filter((t) => !t.completed && !doneIds.has(t.id));

  // ── Persistir no localStorage toda vez que o estado relevante mudar ─────
  useEffect(() => {
    if (step === "summary") return;
    persist({
      step,
      activity,
      cycle,
      taskInCycle,
      completed,
      doneIds:        [...doneIds],
      selectedTaskId: selectedTask?.id ?? null,
      isDiaryMode,
      nextDiaryStep,
      diaryDate,
    });
  }, [step, activity, cycle, taskInCycle, completed, doneIds, selectedTask, isDiaryMode, nextDiaryStep]); // eslint-disable-line

  const handleClose = () => { clearSaved(); onClose(); };

  const selectActivity = (a) => {
    setActivity(a);
    if (a === DIARY_MODE_ACTIVITY) {
      setIsDiaryMode(true);
      setDiaryDate(null);
      setNextDiaryStep("reading_analysis"); // após a 1ª tarefa vai para "ler análise"
      setStep("writing_diary");
    } else {
      setIsDiaryMode(false);
      // "Ler diário": sugere uma data aleatória entre 01/01/2024 e hoje
      setDiaryDate(a === READ_DIARY_ACTIVITY ? randomDiaryDate() : null);
      setStep("doing_activity");
    }
  };

  const completeTask = async () => {
    await onCompleteTask(selectedTask.id);
    setDoneIds((p) => new Set([...p, selectedTask.id]));
    setCompleted((c) => c + 1);
    setSelectedTask(null);

    // Modo diário: alterna entre "escrever" e "ler análise" após cada tarefa
    if (isDiaryMode) {
      if (available.length - 1 === 0) {
        setStep("summary");
      } else {
        // vai para o próximo passo do diário e já prepara o alternado para depois
        setStep(nextDiaryStep);
        setNextDiaryStep(nextDiaryStep === "reading_analysis" ? "writing_diary" : "reading_analysis");
      }
      return;
    }

    // Modo normal
    const next = taskInCycle + 1;
    if (next >= numTasks || available.length - 1 === 0) {
      setTaskInCycle(0);
      setStep(available.length - 1 === 0 ? "summary" : "cycle_done");
    } else {
      setTaskInCycle(next);
      setStep("select_task");
    }
  };

  return (
    <div className={styles.root}>
      <div className={styles.header}>
        <span className={styles.headerEmoji}>🔪</span>
        <div className={styles.headerMeta}>
          <span className={styles.headerTitle}>Splite Mode</span>
          <span className={styles.headerSub}>
            {activity ? `${activity} • ` : ""}
            {isDiaryMode ? `${completed} tarefa(s) concluída(s)` : `Ciclo ${cycle} • ${completed} concluída(s)`}
          </span>
        </div>
        <button className={styles.closeBtn} onClick={handleClose}>✕</button>
      </div>

      <div className={styles.body}>

        {/* Banner de sessão restaurada */}
        {wasRestored && step !== "select_activity" && step !== "summary" && (
          <div className={styles.resumeBanner}>
            ↩ Sessão restaurada — {activity ? `${activity} • ` : ""}Ciclo {cycle}, {completed} tarefa(s) concluída(s)
            <button className={styles.resumeDismiss} onClick={() => setWasRestored(false)}>✕</button>
          </div>
        )}

        {/* ── Seleção de atividade ── */}
        {step === "select_activity" && (
          <>
            <div className={styles.promptBox}>
              <div className={styles.promptTitle}>🎯 Escolha sua atividade de recompensa</div>
              <div className={styles.promptText}>Esta será a atividade entre as tarefas.</div>
            </div>
            <div className={styles.activityList}>
              {activities.map((a) => (
                <div key={a} style={{ display: "flex", gap: 6, alignItems: "stretch" }}>
                  <button className={styles.activityItem} style={{ flex: 1 }} onClick={() => selectActivity(a)}>
                    {a}
                  </button>
                  <button
                    className={`${styles.btn} ${styles.btnSecondary}`}
                    style={{ flex: "0 0 auto", padding: "0 12px" }}
                    title="Remover atividade"
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

        {/* ── Modo normal: fazer atividade ── */}
        {step === "doing_activity" && (
          <>
            <div className={styles.cycleBadge}>Ciclo {cycle}</div>
            <div className={styles.promptBox}>
              <div className={styles.promptTitle}>🎯 {activity} × {cycle}</div>
              <div className={styles.promptText}>
                Faça "{activity}" {cycle} vez{cycle !== 1 ? "es" : ""}. Depois conclua {numTasks} tarefa{numTasks !== 1 ? "s" : ""}.
              </div>
              {activity === READ_DIARY_ACTIVITY && diaryDate && (
                <div className={styles.promptText}>
                  📅 Data sugerida para ler: <strong>{diaryDate}</strong>
                  <button
                    className={`${styles.btn} ${styles.btnSecondary}`}
                    style={{ marginLeft: 8 }}
                    onClick={() => setDiaryDate(randomDiaryDate())}
                  >
                    🎲 Sortear outra
                  </button>
                </div>
              )}
            </div>
            <button className={`${styles.btn} ${styles.btnPrimary}`} onClick={() => { setTaskInCycle(0); setStep("select_task"); }}>
              ✅ Fiz!
            </button>
            <button className={`${styles.btn} ${styles.btnDanger}`} onClick={() => setStep("summary")}>Encerrar</button>
          </>
        )}

        {/* ── Modo diário: escrever o diário ── */}
        {step === "writing_diary" && (
          <>
            <div className={styles.promptBox}>
              <div className={styles.promptTitle}>📓 Escreva no seu diário</div>
              <div className={styles.promptText}>
                Abra seu diário e escreva livremente. Quando terminar, clique em "Fiz!" para partir para a primeira tarefa.
              </div>
            </div>
            <button
              className={`${styles.btn} ${styles.btnPrimary}`}
              onClick={() => setStep("select_task")}
            >
              ✅ Escrevi! Partir para a tarefa
            </button>
            <button className={`${styles.btn} ${styles.btnDanger}`} onClick={() => setStep("summary")}>Encerrar</button>
          </>
        )}

        {/* ── Modo diário: ler análise ── */}
        {step === "reading_analysis" && (
          <>
            <div className={styles.promptBox}>
              <div className={styles.promptTitle}>🔍 Leia a análise do seu diário</div>
              <div className={styles.promptText}>
                Abra a análise gerada do seu diário e leia com atenção. Quando terminar, parta para a próxima tarefa.
              </div>
            </div>
            <button
              className={`${styles.btn} ${styles.btnPrimary}`}
              onClick={() => setStep("select_task")}
            >
              ✅ Li! Partir para a tarefa
            </button>
            <button className={`${styles.btn} ${styles.btnDanger}`} onClick={() => setStep("summary")}>Encerrar</button>
          </>
        )}

        {/* ── Selecionar tarefa ── */}
        {step === "select_task" && (
          <>
            {isDiaryMode ? (
              <div className={styles.cycleBadge}>
                {/* nextDiaryStep já aponta para o PRÓXIMO, então o atual foi o oposto */}
                {nextDiaryStep === "writing_diary" ? "🔍 Após análise — Tarefa" : "📓 Após escrever — Tarefa"}
                {` ${completed + 1}`}
              </div>
            ) : (
              <div className={styles.cycleBadge}>Ciclo {cycle} — Tarefa {taskInCycle + 1} de {numTasks}</div>
            )}
            <TaskSelector
              tasks={available}
              onSelect={(t) => { setSelectedTask(t); setStep("working"); }}
              onCancel={() => {
                if (isDiaryMode) {
                  // volta para o passo que estava antes (oposto do nextDiaryStep)
                  setStep(nextDiaryStep === "writing_diary" ? "reading_analysis" : "writing_diary");
                } else {
                  setStep("doing_activity");
                }
              }}
            />
          </>
        )}

        {/* ── Trabalhando na tarefa ── */}
        {step === "working" && selectedTask && (() => {
          const live = tasks.find((t) => t.id === selectedTask.id) || selectedTask;
          const hasChecklist = live.checklist?.length > 0;

          return (
            <>
              {isDiaryMode ? (
                <div className={styles.cycleBadge}>
                  {nextDiaryStep === "writing_diary" ? "🔍 Tarefa após análise" : "📓 Tarefa após diário"}
                </div>
              ) : (
                <div className={styles.cycleBadge}>Ciclo {cycle} — Tarefa {taskInCycle + 1} de {numTasks}</div>
              )}

              <div className={styles.taskDisplay}>
                <span className={styles.taskName}>{live.title}</span>
                {live.description && <span className={styles.taskMeta}>{live.description}</span>}

                {/* Subtarefas com auto-avanço */}
                {hasChecklist && (
                  <SubtaskFlow
                    checklist={live.checklist}
                    onToggle={(itemId) => onToggleChecklist?.(live.id, itemId)}
                    onAllDone={completeTask}
                    onSkip={completeTask}
                  />
                )}
              </div>

              <div className={styles.actions}>
                {/* Só mostra "Concluída" direto se não houver checklist */}
                {!hasChecklist && (
                  <button className={`${styles.btn} ${styles.btnSuccess}`} onClick={completeTask}>
                    ✅ Concluída!
                  </button>
                )}
                <button
                  className={`${styles.btn} ${styles.btnSecondary}`}
                  onClick={() => { setSelectedTask(null); setStep("select_task"); }}
                >
                  Trocar tarefa
                </button>
                <SubtaskInline taskId={live.id} onAdd={onAddChecklist} />
              </div>
            </>
          );
        })()}

        {/* ── Ciclo completo (modo normal) ── */}
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

        {/* ── Resumo final ── */}
        {step === "summary" && (
          <>
            <div className={styles.summaryBox}>
              <span className={styles.summaryEmoji}>🔪</span>
              <div className={styles.summaryTitle}>Sessão encerrada!</div>
              {isDiaryMode
                ? <div className={styles.summaryText}>{completed} tarefa(s) concluída(s) no modo diário 📓</div>
                : <div className={styles.summaryText}>{completed} tarefa(s) em {cycle} ciclo(s) com "{activity}".</div>
              }
            </div>
            <button className={`${styles.btn} ${styles.btnPrimary}`} onClick={() => { clearSaved(); onClose(); }}>Fechar</button>
          </>
        )}

      </div>
    </div>
  );
}
