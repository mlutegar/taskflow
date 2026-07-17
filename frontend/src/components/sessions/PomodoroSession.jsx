import { useState, useEffect } from "react";
import TaskSelector from "../TaskSelector";
import SessionHeader from "./SessionHeader";
import ResumeBanner from "./ResumeBanner";
import WorkingTask from "./WorkingTask";
import CountdownTimer from "../CountdownTimer";
import styles from "./session.module.css";
import { useModeSession } from "../../hooks/useModeSession";

const DURATIONS = [
  { label: "15 min", value: 15 },
  { label: "25 min", value: 25 },
  { label: "30 min", value: 30 },
  { label: "45 min", value: 45 },
  { label: "60 min", value: 60 },
];

export default function PomodoroSession({ preset, tasks, onCompleteTask, onToggleChecklist, onAddChecklist, onClose }) {
  const {
    persist, clearSaved, saved,
    completed, setCompleted,
    doneIds, addDone,
    selectedTask, setSelectedTask,
    wasRestored, setWasRestored,
    available,
  } = useModeSession("pomodoro", tasks);

  const [step,     setStep]     = useState(saved?.step     ?? "pick_duration");
  const [duration, setDuration] = useState(saved?.duration ?? preset?.duration ?? 25);
  const [rounds,   setRounds]   = useState(saved?.rounds   ?? 0);

  useEffect(() => {
    if (step === "summary") return;
    persist({ step, duration, rounds, completed, doneIds: [...doneIds], selectedTaskId: selectedTask?.id ?? null });
  }, [step, duration, rounds, completed, doneIds, selectedTask]); // eslint-disable-line

  const handleClose = () => { clearSaved(); onClose(); };

  const completeTask = async () => {
    await onCompleteTask(selectedTask.id);
    addDone(selectedTask.id);
    setCompleted((c) => c + 1);
    setSelectedTask(null);
    setStep(available.length - 1 === 0 ? "summary" : "post_timer");
  };

  return (
    <div className={styles.root}>
      <SessionHeader
        emoji="🍅"
        title="Pomodoro"
        sub={`${duration} min • ${rounds} round${rounds !== 1 ? "s" : ""} • ${completed} tarefa(s)`}
        onClose={handleClose}
      />

      <div className={styles.body}>
        <ResumeBanner show={wasRestored && step !== "pick_duration" && step !== "summary"} onDismiss={() => setWasRestored(false)}>
          ↩ Sessão restaurada — {completed} tarefa(s), {rounds} round(s)
        </ResumeBanner>

        {/* Escolha de duração */}
        {step === "pick_duration" && (
          <>
            <div className={styles.promptBox}>
              <div className={styles.promptTitle}>🍅 Duração do round</div>
              <div className={styles.promptText}>Qual a duração ideal para esta sessão?</div>
            </div>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
              {DURATIONS.map((d) => (
                <button
                  key={d.value}
                  className={`${styles.btn} ${duration === d.value ? styles.btnPrimary : styles.btnSecondary}`}
                  onClick={() => setDuration(d.value)}
                >
                  {d.label}
                </button>
              ))}
            </div>
            <button className={`${styles.btn} ${styles.btnPrimary}`} onClick={() => setStep("select_task")}>
              ▶ Iniciar com {duration} min
            </button>
          </>
        )}

        {/* Seleção de tarefa */}
        {step === "select_task" && (
          <TaskSelector
            tasks={available}
            onSelect={(t) => { setSelectedTask(t); setStep("timing"); }}
            onCancel={() => setStep("pick_duration")}
          />
        )}

        {/* Timer rodando */}
        {step === "timing" && (
          <>
            <div className={styles.cycleBadge}>🍅 Round {rounds + 1} — {duration} min</div>
            <CountdownTimer
              seconds={duration * 60}
              title={selectedTask?.title}
              onComplete={() => { setRounds((r) => r + 1); setStep("post_timer"); }}
              onCancel={() => { setRounds((r) => r + 1); setStep("post_timer"); }}
            />
          </>
        )}

        {/* Pós-timer */}
        {step === "post_timer" && selectedTask && (() => {
          const live = tasks.find((t) => t.id === selectedTask.id) || selectedTask;
          return (
            <>
              <div className={styles.promptBox}>
                <div className={styles.promptTitle}>⏱️ Round {rounds} concluído!</div>
                <div className={styles.promptText}>Você trabalhou por {duration} minutos. O que quer fazer agora?</div>
              </div>
              <WorkingTask
                task={live}
                completeLabel="✅ Tarefa concluída!"
                onComplete={completeTask}
                onToggleChecklist={onToggleChecklist}
                onAddChecklist={onAddChecklist}
                onSwap={() => { setSelectedTask(null); setStep("select_task"); }}
                swapLabel="↩ Trocar tarefa"
              >
                <button
                  className={`${styles.btn} ${styles.btnPrimary}`}
                  onClick={() => setStep("timing")}
                >
                  🔄 Mais {duration} min
                </button>
              </WorkingTask>
            </>
          );
        })()}

        {/* Resumo */}
        {step === "summary" && (
          <>
            <div className={styles.summaryBox}>
              <span className={styles.summaryEmoji}>🍅</span>
              <div className={styles.summaryTitle}>Sessão encerrada!</div>
              <div className={styles.summaryText}>
                {rounds} round{rounds !== 1 ? "s" : ""} de {duration} min — {completed} tarefa(s) concluída(s).
              </div>
            </div>
            <button className={`${styles.btn} ${styles.btnPrimary}`} onClick={handleClose}>Fechar</button>
          </>
        )}
      </div>
    </div>
  );
}
