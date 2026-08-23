import { useState, useEffect, useRef } from "react";
import BaseSession from "./BaseSession";
import TaskSelector from "../TaskSelector";
import SubtaskFlow from "./SubtaskFlow";
import styles from "./SavedQueue.module.css";
import { useSessionPersist } from "../../lib/useSessionPersist";

const WATCH_DURATION = 3 * 60; // 3 minutos por item salvo (configurável)

const PLATFORM_META = {
  tiktok:    { label: "TikTok",    emoji: "📌", itemLabel: "vídeo salvo",   deepLink: "https://www.tiktok.com/profile/me/bookmarks" },
  instagram: { label: "Instagram", emoji: "📌", itemLabel: "post salvo",    deepLink: "https://www.instagram.com/saved/" },
};

export default function SavedQueueSession({ preset, tasks, onCompleteTask, onToggleChecklist, onAddChecklist, onClose, onComplete }) {
  const platform = preset?.platform ?? "tiktok";
  const meta = PLATFORM_META[platform] ?? PLATFORM_META.tiktok;
  const persistKey = `saved_queue_${platform}`;

  const { saved, persist, clearSaved } = useSessionPersist(persistKey);

  const [step, setStep]               = useState(saved?.step         ?? "intro");
  const [itemsWatched, setItemsWatched] = useState(saved?.itemsWatched ?? 0);
  const [tasksCompleted, setTasksCompleted] = useState(saved?.tasksCompleted ?? 0);
  const [selectedTask, setSelectedTask] = useState(() => {
    if (!saved?.selectedTaskId) return null;
    return tasks.find((t) => t.id === saved.selectedTaskId) || null;
  });
  const [timerSeconds, setTimerSeconds] = useState(saved?.timerSeconds ?? WATCH_DURATION);
  const [timerRunning, setTimerRunning] = useState(false);
  const [timerDone, setTimerDone]       = useState(false);
  const [watchDuration, setWatchDuration] = useState(saved?.watchDuration ?? WATCH_DURATION);
  const [wasRestored, setWasRestored]   = useState(!!saved);
  const timerRef = useRef(null);

  // ── Persist ──────────────────────────────────────────────────────────────
  useEffect(() => {
    if (step === "done") { clearSaved(); return; }
    persist({ step, itemsWatched, tasksCompleted, selectedTaskId: selectedTask?.id, timerSeconds, watchDuration });
  }, [step, itemsWatched, tasksCompleted, selectedTask, timerSeconds, watchDuration]); // eslint-disable-line

  // ── Timer ────────────────────────────────────────────────────────────────
  useEffect(() => {
    if (!timerRunning) return;
    timerRef.current = setInterval(() => {
      setTimerSeconds((s) => {
        if (s <= 1) {
          clearInterval(timerRef.current);
          setTimerRunning(false);
          setTimerDone(true);
          return 0;
        }
        return s - 1;
      });
    }, 1000);
    return () => clearInterval(timerRef.current);
  }, [timerRunning]);

  const startTimer = () => {
    setTimerSeconds(watchDuration);
    setTimerDone(false);
    setTimerRunning(true);
  };

  const fmtTime = (s) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;

  // ── Handlers ─────────────────────────────────────────────────────────────
  const handleStartWatching = () => {
    setStep("watching");
    startTimer();
  };

  const handleConfirmWatched = () => {
    clearInterval(timerRef.current);
    setTimerRunning(false);
    setItemsWatched((n) => n + 1);
    setStep("select_task");
  };

  const handleTaskSelected = (task) => {
    setSelectedTask(task);
    setStep("working");
  };

  const handleTaskCompleted = async (taskId) => {
    await onCompleteTask(taskId);
    setTasksCompleted((n) => n + 1);
    setSelectedTask(null);
    setStep("cycle_done");
  };

  const handleNextCycle = () => {
    setStep("watching");
    startTimer();
  };

  const handleClose = () => {
    clearInterval(timerRef.current);
    clearSaved();
    if (tasksCompleted > 0 && onComplete) onComplete(tasksCompleted);
    onClose();
  };

  // ── Render ───────────────────────────────────────────────────────────────
  const timerPct = timerSeconds / watchDuration;

  return (
    <BaseSession
      emoji={meta.emoji}
      title={`Salvos ${meta.label}`}
      sub={`${itemsWatched} vistos · ${tasksCompleted} tarefa${tasksCompleted !== 1 ? "s" : ""} concluída${tasksCompleted !== 1 ? "s" : ""}`}
      onClose={handleClose}
      showResume={wasRestored}
      resumeMessage="↩ Sessão restaurada"
      onDismissResume={() => setWasRestored(false)}
    >
      {/* ── INTRO ── */}
      {step === "intro" && (
        <div className={styles.intro}>
          <p className={styles.introText}>
            Você vai assistir seus <strong>{meta.itemLabel}s</strong> um por vez, com timer de {Math.floor(watchDuration / 60)} minutos cada.
            Depois de cada um, conclui uma tarefa. Assim a fila vai diminuindo sem culpa.
          </p>

          <div className={styles.configBlock}>
            <label className={styles.configLabel}>Tempo por {meta.itemLabel}</label>
            <div className={styles.configBtns}>
              {[60, 120, 180, 300].map((s) => (
                <button
                  key={s}
                  className={`${styles.configBtn} ${watchDuration === s ? styles.configBtnActive : ""}`}
                  onClick={() => setWatchDuration(s)}
                >
                  {Math.floor(s / 60)} min
                </button>
              ))}
            </div>
          </div>

          <a
            href={meta.deepLink}
            target="_blank"
            rel="noopener noreferrer"
            className={styles.openAppBtn}
          >
            Abrir Salvos no {meta.label} →
          </a>

          <button className={styles.primaryBtn} onClick={handleStartWatching}>
            ▶ Começar
          </button>
        </div>
      )}

      {/* ── WATCHING ── */}
      {step === "watching" && (
        <div className={styles.watchingBlock}>
          <p className={styles.watchLabel}>
            Vendo {meta.itemLabel} <strong>#{itemsWatched + 1}</strong>
          </p>

          <div className={styles.timerRing}>
            <svg viewBox="0 0 80 80" className={styles.timerSvg}>
              <circle cx="40" cy="40" r="34" className={styles.timerBg} />
              <circle
                cx="40" cy="40" r="34"
                className={styles.timerArc}
                strokeDasharray={`${213.6 * timerPct} 213.6`}
                strokeDashoffset="0"
                transform="rotate(-90 40 40)"
              />
            </svg>
            <span className={styles.timerText}>{fmtTime(timerSeconds)}</span>
          </div>

          {timerDone && (
            <p className={styles.timerDoneMsg}>⏰ Tempo esgotado!</p>
          )}

          <button className={styles.primaryBtn} onClick={handleConfirmWatched}>
            ✓ Assisti — próximo passo
          </button>

          <button className={styles.secondaryBtn} onClick={() => { startTimer(); }}>
            ↺ Reiniciar timer
          </button>
        </div>
      )}

      {/* ── SELECT TASK ── */}
      {step === "select_task" && (
        <div className={styles.selectBlock}>
          <p className={styles.selectLabel}>
            ✓ {meta.itemLabel} #{itemsWatched} visto! Agora conclua uma tarefa:
          </p>
          <TaskSelector
            tasks={tasks.filter((t) => !t.completed)}
            onSelect={handleTaskSelected}
          />
        </div>
      )}

      {/* ── WORKING ── */}
      {step === "working" && selectedTask && (
        <SubtaskFlow
          task={selectedTask}
          onComplete={handleTaskCompleted}
          onToggleChecklist={onToggleChecklist}
          onAddChecklist={onAddChecklist}
          onBack={() => setStep("select_task")}
        />
      )}

      {/* ── CYCLE DONE ── */}
      {step === "cycle_done" && (
        <div className={styles.cycleDone}>
          <div className={styles.cycleDoneEmoji}>🎉</div>
          <p className={styles.cycleDoneTitle}>Ciclo {itemsWatched} completo!</p>
          <p className={styles.cycleDoneSub}>
            {itemsWatched} salvo{itemsWatched !== 1 ? "s" : ""} vistos · {tasksCompleted} tarefa{tasksCompleted !== 1 ? "s" : ""} concluída{tasksCompleted !== 1 ? "s" : ""}
          </p>
          <button className={styles.primaryBtn} onClick={handleNextCycle}>
            ▶ Próximo salvo
          </button>
          <button className={styles.secondaryBtn} onClick={handleClose}>
            ✓ Encerrar sessão
          </button>
        </div>
      )}
    </BaseSession>
  );
}
