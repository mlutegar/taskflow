import { useState, useEffect } from "react";
import TaskSelector from "../TaskSelector";
import SubtaskInline from "./SubtaskInline";
import SubtaskFlow from "./SubtaskFlow";
import styles from "./session.module.css";
import { useSessionPersist } from "../../lib/useSessionPersist";

const ACTIVITIES = [
  "Ler diário", "Escrever no diário", "Beber água", "Jogar Spelunky",
  "Ver Twitter", "Ver um vídeo", "Colocar música", "Ler um capítulo de livro",
  "Esticar 5 minutos", "Meditar", "Fazer exercícios rápidos", "Organizar algo", "Responder mensagens",
];

const DIARY_MODE_ACTIVITY = "Escrever no diário";

export default function SpliteSession({ tasks, onCompleteTask, onToggleChecklist, onAddChecklist, onClose }) {
  const { saved, persist, clearSaved } = useSessionPersist("splite");

  const [step,          setStep]          = useState(saved?.step          ?? "select_activity");
  const [activity,      setActivity]      = useState(saved?.activity      ?? null);
  const [cycle,         setCycle]         = useState(saved?.cycle         ?? 1);
  const [taskInCycle,   setTaskInCycle]   = useState(saved?.taskInCycle   ?? 0);
  const [selectedTask,  setSelectedTask]  = useState(() => {
    if (!saved?.selectedTaskId) return null;
    return tasks.find((t) => t.id === saved.selectedTaskId) || null;
  });
  const [completed,     setCompleted]     = useState(saved?.completed     ?? 0);
  const [doneIds,       setDoneIds]       = useState(() => new Set(saved?.doneIds ?? []));
  const [isDiaryMode,   setIsDiaryMode]   = useState(saved?.isDiaryMode   ?? false);
  const [nextDiaryStep, setNextDiaryStep] = useState(saved?.nextDiaryStep ?? "reading_analysis");
  const [wasRestored,   setWasRestored]   = useState(!!saved);

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
    });
  }, [step, activity, cycle, taskInCycle, completed, doneIds, selectedTask, isDiaryMode, nextDiaryStep]); // eslint-disable-line

  const handleClose = () => { clearSaved(); onClose(); };

  const selectActivity = (a) => {
    setActivity(a);
    if (a === DIARY_MODE_ACTIVITY) {
      setIsDiaryMode(true);
      setNextDiaryStep("reading_analysis"); // após a 1ª tarefa vai para "ler análise"
      setStep("writing_diary");
    } else {
      setIsDiaryMode(false);
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
        <button className={styles.closeBtn} onClick={onClose}>✕</button>
      </div>

      <div className={styles.body}>

        {/* ── Seleção de atividade ── */}
        {step === "select_activity" && (
          <>
            <div className={styles.promptBox}>
              <div className={styles.promptTitle}>🎯 Escolha sua atividade de recompensa</div>
              <div className={styles.promptText}>Esta será a atividade entre as tarefas.</div>
            </div>
            <div className={styles.activityList}>
              {ACTIVITIES.map((a) => (
                <button key={a} className={styles.activityItem} onClick={() => selectActivity(a)}>
                  {a}
                </button>
              ))}
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
            <button className={`${styles.btn} ${styles.btnPrimary}`} onClick={onClose}>Fechar</button>
          </>
        )}

      </div>
    </div>
  );
}
