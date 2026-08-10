import { useState, useEffect, useRef } from "react";
import TaskSelector from "../TaskSelector";
import SubtaskFlow from "./SubtaskFlow";
import styles from "./session.module.css";
import { useSessionPersist } from "../../lib/useSessionPersist";

export default function TikTokSession({ preset, tasks, onCompleteTask, onToggleChecklist, onAddChecklist, onClose, onComplete }) {
  const platform = preset?.platform ?? "tiktok";
  const variant  = preset?.variant  ?? "prog_both";
  const persistKey = `${platform}_${variant}`;
  const { saved, persist, clearSaved } = useSessionPersist(persistKey);

  // ── Estado base ──────────────────────────────────────────────────────────
  const [step,         setStep]         = useState(saved?.step         ?? "intro");
  const [cycle,        setCycle]        = useState(saved?.cycle        ?? 1);
  const [taskInCycle,  setTaskInCycle]  = useState(saved?.taskInCycle  ?? 0);
  const [completed,    setCompleted]    = useState(saved?.completed    ?? 0);
  const [doneIds,      setDoneIds]      = useState(() => new Set(saved?.doneIds ?? []));
  const [selectedTask, setSelectedTask] = useState(() => {
    if (!saved?.selectedTaskId) return null;
    return tasks.find((t) => t.id === saved.selectedTaskId) || null;
  });
  const [showSubtask,   setShowSubtask]   = useState(false);
  const [subtaskText,   setSubtaskText]   = useState("");
  const [savingSubtask, setSavingSubtask] = useState(false);
  const [wasRestored,   setWasRestored]   = useState(!!saved);

  // ── Configurações (definidas na intro) ───────────────────────────────────
  const [baseVideos,    setBaseVideos]    = useState(saved?.baseVideos    ?? 5);  // 3, 5, 10
  const [videoDuration, setVideoDuration] = useState(saved?.videoDuration ?? 60); // segundos por vídeo
  const [maxCycles,     setMaxCycles]     = useState(saved?.maxCycles     ?? 0);  // 0 = ilimitado

  // ── Funcionalidades novas ────────────────────────────────────────────────
  const [videosCount,       setVideosCount]       = useState(saved?.videosCount       ?? 0);
  const [streak,            setStreak]            = useState(saved?.streak            ?? 0);
  const [cycleHistory,      setCycleHistory]      = useState(saved?.cycleHistory      ?? []);
  const [currentCycleTasks, setCurrentCycleTasks] = useState(saved?.currentCycleTasks ?? []);

  // ── Timer ────────────────────────────────────────────────────────────────
  const [timerRemaining, setTimerRemaining] = useState(null);
  const [timerDone,      setTimerDone]      = useState(false);
  const timerRef         = useRef(null);
  const originalTitleRef = useRef(document.title);

  // ── Derivados ────────────────────────────────────────────────────────────
  const numVideos =
    variant === "fixed"  ? baseVideos
    : variant === "detox" ? Math.max(1, 4 - cycle) * baseVideos
    : cycle * baseVideos;

  const numTasks =
    variant === "prog_both" ? cycle
    : variant === "detox"   ? Math.max(1, 4 - cycle)
    : 1;

  const isDetoxFinalCycle = variant === "detox" && cycle >= 3;

  // Labels de plataforma
  const platformLabel = platform === "reels" ? "Reels" : "TikTok";
  const platformEmoji = platform === "reels" ? "🎬" : "📱";
  const videosLabel   = platform === "reels" ? "Reels" : "vídeos";

  // Passos da tela intro (reage a baseVideos)
  const variantSteps =
    variant === "fixed"
      ? [`Todos os ciclos: ${baseVideos} ${videosLabel} → 1 tarefa`, "Repita quantas vezes quiser!"]
    : variant === "prog_videos"
      ? [
          `Ciclo 1: ${baseVideos} ${videosLabel} → 1 tarefa`,
          `Ciclo 2: ${baseVideos * 2} ${videosLabel} → 1 tarefa`,
          `Ciclo 3: ${baseVideos * 3} ${videosLabel} → 1 tarefa`,
          `Continue: n × ${baseVideos} → sempre 1 tarefa`,
        ]
    : variant === "detox"
      ? [
          `Ciclo 1: ${baseVideos * 3} ${videosLabel} → 3 tarefas`,
          `Ciclo 2: ${baseVideos * 2} ${videosLabel} → 2 tarefas`,
          `Ciclo 3: ${baseVideos} ${videosLabel} → 1 tarefa`,
          "Fim! Detox completo 🎊",
        ]
    : [
        `Ciclo 1: ${baseVideos} ${videosLabel} → 1 tarefa`,
        `Ciclo 2: ${baseVideos * 2} ${videosLabel} → 2 tarefas`,
        `Ciclo 3: ${baseVideos * 3} ${videosLabel} → 3 tarefas`,
        `Continue: n × ${baseVideos} → n tarefas`,
      ];

  const available = tasks.filter((t) => !t.completed && !doneIds.has(t.id));

  // ── Persistir ────────────────────────────────────────────────────────────
  useEffect(() => {
    if (step === "summary") return;
    persist({
      step, cycle, taskInCycle, completed,
      doneIds:         [...doneIds],
      selectedTaskId:  selectedTask?.id ?? null,
      baseVideos, videoDuration, maxCycles,
      videosCount, streak, cycleHistory, currentCycleTasks,
    });
  }, [step, cycle, taskInCycle, completed, doneIds, selectedTask, baseVideos, videoDuration, maxCycles, videosCount, streak, cycleHistory, currentCycleTasks]); // eslint-disable-line

  // ── Defensive resets ─────────────────────────────────────────────────────
  useEffect(() => {
    if (step === "working" && !selectedTask) {
      setStep(available.length > 0 ? "select_task" : "summary");
    }
  }, [step, selectedTask, available.length]); // eslint-disable-line

  useEffect(() => {
    if (step !== "working" || !selectedTask) return;
    const live = tasks.find((t) => t.id === selectedTask.id);
    if (live?.completed && !doneIds.has(live.id)) {
      setDoneIds((p) => new Set([...p, live.id]));
      advanceAfterTaskComplete(live.id, live.title);
    }
  }, [tasks, step, selectedTask, doneIds]); // eslint-disable-line

  // ── Timer: inicia ao entrar em "watching", limpa ao sair ─────────────────
  useEffect(() => {
    if (step !== "watching") {
      clearInterval(timerRef.current);
      setTimerRemaining(null);
      setTimerDone(false);
      document.title = originalTitleRef.current;
      return;
    }
    const total = numVideos * videoDuration;
    setTimerRemaining(total);
    setTimerDone(false);

    timerRef.current = setInterval(() => {
      setTimerRemaining((prev) => {
        if (prev <= 1) {
          clearInterval(timerRef.current);
          setTimerDone(true);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(timerRef.current);
  }, [step, cycle]); // eslint-disable-line

  // Timer acabou → pisca title da aba
  useEffect(() => {
    if (!timerDone) return;
    let on = true;
    const id = setInterval(() => {
      document.title = on
        ? `⏰ Volte agora! — ${platformLabel}`
        : originalTitleRef.current;
      on = !on;
    }, 800);
    return () => { clearInterval(id); document.title = originalTitleRef.current; };
  }, [timerDone, platformLabel]);

  // ── Helpers ──────────────────────────────────────────────────────────────
  const resetSubtask = () => { setShowSubtask(false); setSubtaskText(""); };

  const formatTimer = (secs) => {
    const m = Math.floor(secs / 60);
    const s = secs % 60;
    return `${m}:${String(s).padStart(2, "0")}`;
  };

  const startWatching = () => { setVideosCount(0); setTaskInCycle(0); setStep("watching"); };

  const nextVideoCount = () => setVideosCount((v) => Math.min(v + 1, numVideos));

  // ── Avançar após completar tarefa ────────────────────────────────────────
  const advanceAfterTaskComplete = (removedTaskId, taskName) => {
    resetSubtask();
    setCompleted((c) => c + 1);

    const newCycleTasks = taskName
      ? [...currentCycleTasks, taskName]
      : currentCycleTasks;

    const remaining = available.filter((t) => t.id !== removedTaskId);
    const next = taskInCycle + 1;

    if (next >= numTasks || remaining.length === 0) {
      const newStreak = streak + 1;
      setStreak(newStreak);
      setCycleHistory((prev) => [...prev, { cycle, tasks: newCycleTasks }]);
      setCurrentCycleTasks([]);
      setTaskInCycle(0);
      setSelectedTask(null);

      const reachedMaxCycles = maxCycles > 0 && cycle >= maxCycles;
      const detoxDone        = variant === "detox" && cycle >= 3;
      const noTasks          = remaining.length === 0;

      setStep(noTasks || detoxDone || reachedMaxCycles ? "summary" : "cycle_done");
    } else {
      setCurrentCycleTasks(newCycleTasks);
      setTaskInCycle(next);
      setSelectedTask(null);
      setStep("select_task");
    }
  };

  const advanceAfterSubtaskComplete = (taskName) => {
    resetSubtask();
    setCompleted((c) => c + 1);

    const newCycleTasks = taskName
      ? [...currentCycleTasks, taskName]
      : currentCycleTasks;

    const next = taskInCycle + 1;

    if (next >= numTasks) {
      const newStreak = streak + 1;
      setStreak(newStreak);
      setCycleHistory((prev) => [...prev, { cycle, tasks: newCycleTasks }]);
      setCurrentCycleTasks([]);
      setTaskInCycle(0);
      setSelectedTask(null);

      const reachedMaxCycles = maxCycles > 0 && cycle >= maxCycles;
      const detoxDone        = variant === "detox" && cycle >= 3;
      setStep(detoxDone || reachedMaxCycles ? "summary" : "cycle_done");
    } else {
      setCurrentCycleTasks(newCycleTasks);
      setTaskInCycle(next);
      setSelectedTask(null);
      setStep("select_task");
    }
  };

  const completeTask = async () => {
    const name = selectedTask?.title;
    await onCompleteTask(selectedTask.id);
    setDoneIds((p) => new Set([...p, selectedTask.id]));
    advanceAfterTaskComplete(selectedTask.id, name);
  };

  const handleSubtaskToggle = async (taskId, itemId) => {
    const currentTask = tasks.find((t) => t.id === taskId);
    const item = currentTask?.checklist?.find((c) => c.id === itemId);
    const wasCompleted = item?.completed ?? true;
    await onToggleChecklist?.(taskId, itemId);
    if (!wasCompleted) advanceAfterSubtaskComplete(currentTask?.title);
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

  const handleClose = () => {
    clearSaved();
    document.title = originalTitleRef.current;
    onClose();
  };

  const handleSummaryClose = () => {
    document.title = originalTitleRef.current;
    if (onComplete) { clearSaved(); onComplete(); return; }
    clearSaved();
    onClose();
  };

  // ── Helpers de estilo para botões de config ──────────────────────────────
  const cfgBtn = (active) => ({
    padding: "4px 14px",
    borderRadius: "var(--radius-sm)",
    fontSize: 13,
    fontWeight: 600,
    cursor: "pointer",
    border: "1px solid var(--border)",
    background: active ? "var(--accent)" : "var(--surface-2)",
    color:      active ? "#fff"          : "var(--text)",
    transition: "background 0.15s",
  });

  // ── Render ───────────────────────────────────────────────────────────────
  return (
    <div className={styles.root}>
      {/* Header */}
      <div className={styles.header}>
        <span className={styles.headerEmoji}>{platformEmoji}</span>
        <div className={styles.headerMeta}>
          <span className={styles.headerTitle}>{platformLabel} Mode</span>
          <span className={styles.headerSub}>
            Ciclo {cycle}{maxCycles > 0 ? `/${maxCycles}` : ""} • {completed} concluída(s)
            {streak > 0 && (
              <span style={{ marginLeft: 6, color: "#f0a540" }}>🔥 {streak}</span>
            )}
          </span>
        </div>
        <button className={styles.closeBtn} onClick={handleClose}>✕</button>
      </div>

      <div className={styles.body}>
        {/* Banner restauração */}
        {wasRestored && step !== "intro" && step !== "summary" && (
          <div className={styles.resumeBanner}>
            ↩ Sessão restaurada — Ciclo {cycle}, {completed} tarefa(s) concluída(s)
            <button className={styles.resumeDismiss} onClick={() => setWasRestored(false)}>✕</button>
          </div>
        )}

        {/* ─────────────────────── INTRO ─────────────────────── */}
        {step === "intro" && (
          <>
            <div className={styles.promptBox}>
              <div className={styles.promptTitle}>
                {variant === "fixed"
                  ? "Ciclo fixo"
                  : variant === "detox"
                  ? "🧹 Detox progressivo"
                  : "Ciclos progressivos"}
              </div>
              <ol className={styles.stepList}>
                {variantSteps.map((s, i) => (
                  <li key={i} className={styles.stepItem}>
                    <span className={styles.stepNum}>{i + 1}</span>{s}
                  </li>
                ))}
              </ol>
            </div>

            {/* Configurações */}
            <div className={styles.promptBox} style={{ marginTop: 8 }}>
              <div className={styles.promptTitle} style={{ fontSize: 13, marginBottom: 10 }}>
                ⚙️ Configurações
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>

                {/* Base de vídeos */}
                <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                  <span style={{ fontSize: 13, color: "var(--text-muted)", flex: 1, minWidth: 120 }}>
                    {videosLabel} base por ciclo
                  </span>
                  {[3, 5, 10].map((v) => (
                    <button key={v} onClick={() => setBaseVideos(v)} style={cfgBtn(baseVideos === v)}>{v}</button>
                  ))}
                </div>

                {/* Duração por vídeo */}
                <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                  <span style={{ fontSize: 13, color: "var(--text-muted)", flex: 1, minWidth: 120 }}>
                    Duração por vídeo
                  </span>
                  {[{ v: 30, l: "30s" }, { v: 60, l: "1min" }, { v: 90, l: "1m30" }].map(({ v, l }) => (
                    <button key={v} onClick={() => setVideoDuration(v)} style={cfgBtn(videoDuration === v)}>{l}</button>
                  ))}
                </div>

                {/* Cap de ciclos (só quando não é detox) */}
                {variant !== "detox" && (
                  <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                    <span style={{ fontSize: 13, color: "var(--text-muted)", flex: 1, minWidth: 120 }}>
                      Máx. de ciclos
                    </span>
                    {[{ v: 0, l: "∞" }, { v: 2, l: "2" }, { v: 3, l: "3" }, { v: 5, l: "5" }].map(({ v, l }) => (
                      <button key={v} onClick={() => setMaxCycles(v)} style={cfgBtn(maxCycles === v)}>{l}</button>
                    ))}
                  </div>
                )}
              </div>
            </div>

            <button
              className={`${styles.btn} ${styles.btnPrimary}`}
              onClick={() => available.length === 0 ? setStep("summary") : startWatching()}
            >
              {platformEmoji} Começar
            </button>
          </>
        )}

        {/* ─────────────────────── WATCHING ─────────────────────── */}
        {step === "watching" && (
          <>
            <div className={styles.cycleBadge}>
              Ciclo {cycle}{maxCycles > 0 ? `/${maxCycles}` : ""}
            </div>

            <div className={styles.promptBox}>
              <div className={styles.promptTitle}>
                {platformEmoji} Assista {numVideos} {videosLabel} no {platformLabel}
              </div>
              <div className={styles.promptText}>
                Depois volte aqui e conclua {numTasks} tarefa{numTasks !== 1 ? "s" : ""} ou subtarefa{numTasks !== 1 ? "s" : ""}.
              </div>

              {/* Contador manual de vídeos */}
              <div style={{ marginTop: 16, display: "flex", alignItems: "center", gap: 12, justifyContent: "center" }}>
                <span style={{
                  fontSize: 30,
                  fontWeight: 800,
                  color: videosCount >= numVideos ? "#4ecca3" : "var(--text)",
                  transition: "color 0.2s",
                }}>
                  {videosCount}/{numVideos}
                </span>
                <button
                  onClick={nextVideoCount}
                  disabled={videosCount >= numVideos}
                  style={{
                    padding: "7px 18px",
                    borderRadius: "var(--radius-sm)",
                    border: "none",
                    background: videosCount >= numVideos ? "var(--surface-3, #444)" : "var(--accent)",
                    color: "#fff",
                    fontWeight: 700,
                    fontSize: 14,
                    cursor: videosCount >= numVideos ? "default" : "pointer",
                    opacity: videosCount >= numVideos ? 0.6 : 1,
                    transition: "all 0.15s",
                  }}
                >
                  +1 {platform === "reels" ? "Reel" : "vídeo"}
                </button>
              </div>

              {/* Timer */}
              {timerRemaining !== null && (
                <div style={{
                  marginTop: 10,
                  textAlign: "center",
                  fontSize: 13,
                  fontWeight: timerDone ? 700 : 400,
                  color: timerDone ? "#4ecca3" : "var(--text-muted)",
                }}>
                  {timerDone
                    ? "⏰ Tempo esgotado — hora de trabalhar!"
                    : `⏱ Estimado: ${formatTimer(timerRemaining)}`}
                </div>
              )}
            </div>

            <button
              className={`${styles.btn} ${styles.btnPrimary}`}
              onClick={() => { setTaskInCycle(0); setStep("select_task"); }}
            >
              ✅ Assisti os {numVideos} {videosLabel}!
            </button>
            <button className={`${styles.btn} ${styles.btnDanger}`} onClick={() => setStep("summary")}>Encerrar</button>
          </>
        )}

        {/* ─────────────────────── SELECT TASK ─────────────────────── */}
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

        {/* ─────────────────────── WORKING ─────────────────────── */}
        {step === "working" && selectedTask && (() => {
          const live = tasks.find((t) => t.id === selectedTask.id) || selectedTask;
          const hasChecklist = live.checklist?.length > 0;
          return (
            <>
              <div className={styles.cycleBadge}>Ciclo {cycle} — {taskInCycle + 1} de {numTasks}</div>
              <div className={styles.taskDisplay}>
                <span className={styles.taskName}>{live.title}</span>
                {live.description && <span className={styles.taskMeta}>{live.description}</span>}
                {hasChecklist ? (
                  <SubtaskFlow
                    checklist={live.checklist}
                    onToggle={(itemId) => handleSubtaskToggle(live.id, itemId)}
                    onAllDone={completeTask}
                    onSkip={completeTask}
                  />
                ) : (
                  <div className={styles.taskMeta} style={{ marginTop: 4 }}>
                    💡 Sem subtarefas — adicione uma abaixo ou conclua a tarefa direto.
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
                    <button type="submit" className={`${styles.btn} ${styles.btnPrimary}`} disabled={!subtaskText.trim() || savingSubtask}>
                      {savingSubtask ? "…" : "✓ Adicionar"}
                    </button>
                    <button type="button" className={`${styles.btn} ${styles.btnSecondary}`} onClick={resetSubtask}>Cancelar</button>
                  </div>
                </form>
              )}

              <div className={styles.actions}>
                <button className={`${styles.btn} ${styles.btnSuccess}`} onClick={completeTask}>✅ Concluir tarefa</button>
                <button className={`${styles.btn} ${styles.btnSecondary}`} onClick={() => { setSelectedTask(null); setStep("select_task"); resetSubtask(); }}>Trocar tarefa</button>
                {onAddChecklist && !showSubtask && (
                  <button className={`${styles.btn} ${styles.btnSecondary}`} onClick={() => setShowSubtask(true)}>📌 Adicionar subtarefa</button>
                )}
              </div>
            </>
          );
        })()}

        {/* ─────────────────────── CYCLE DONE ─────────────────────── */}
        {step === "cycle_done" && (
          <>
            <div className={styles.promptBox}>
              <div className={styles.promptTitle}>🎉 Ciclo {cycle} completo!</div>

              {/* Histórico do ciclo que acabou */}
              {cycleHistory.length > 0 && cycleHistory[cycleHistory.length - 1]?.tasks?.length > 0 && (
                <div style={{ marginTop: 10 }}>
                  <div style={{ fontSize: 12, color: "var(--text-muted)", marginBottom: 4 }}>Feito neste ciclo:</div>
                  <ul style={{ margin: 0, paddingLeft: 18, fontSize: 13, color: "var(--text)" }}>
                    {cycleHistory[cycleHistory.length - 1].tasks.map((t, i) => (
                      <li key={i}>✓ {t}</li>
                    ))}
                  </ul>
                </div>
              )}

              {/* Preview do próximo ciclo */}
              <div className={styles.promptText} style={{ marginTop: 10 }}>
                {variant === "fixed"
                  ? `Próximo: ${baseVideos} ${videosLabel} → 1 tarefa`
                  : variant === "prog_videos"
                  ? `Próximo: ${(cycle + 1) * baseVideos} ${videosLabel} → 1 tarefa`
                  : variant === "detox"
                  ? `Próximo: ${Math.max(1, 4 - (cycle + 1)) * baseVideos} ${videosLabel} → ${Math.max(1, 4 - (cycle + 1))} tarefa(s)`
                  : `Próximo: ${(cycle + 1) * baseVideos} ${videosLabel} → ${cycle + 1} tarefa(s)`}
              </div>

              {streak > 0 && (
                <div style={{ marginTop: 8, fontSize: 13, color: "#f0a540" }}>
                  🔥 {streak} ciclo{streak !== 1 ? "s" : ""} seguido{streak !== 1 ? "s" : ""}
                </div>
              )}
            </div>

            {/* Próximo ciclo — esconde se detox terminou ou maxCycles atingido */}
            {!(isDetoxFinalCycle) && !(maxCycles > 0 && cycle >= maxCycles) && (
              <button
                className={`${styles.btn} ${styles.btnPrimary}`}
                onClick={() => { setCycle((c) => c + 1); startWatching(); }}
              >
                {platformEmoji} Próximo ciclo
              </button>
            )}
            <button className={`${styles.btn} ${styles.btnSecondary}`} onClick={() => setStep("summary")}>Encerrar</button>
          </>
        )}

        {/* ─────────────────────── SUMMARY ─────────────────────── */}
        {step === "summary" && (
          <>
            <div className={styles.summaryBox}>
              <span className={styles.summaryEmoji}>{platformEmoji}</span>
              <div className={styles.summaryTitle}>Sessão encerrada!</div>
              <div className={styles.summaryText}>
                {completed} tarefa(s)/subtarefa(s) em {cycleHistory.length || cycle} ciclo(s).
              </div>
              {streak > 0 && (
                <div style={{ fontSize: 13, color: "#f0a540", marginTop: 4 }}>
                  🔥 Streak: {streak} ciclo{streak !== 1 ? "s" : ""} seguido{streak !== 1 ? "s" : ""}
                </div>
              )}
            </div>

            {/* Histórico completo de ciclos */}
            {cycleHistory.length > 0 && (
              <div className={styles.promptBox} style={{ marginTop: 8 }}>
                <div className={styles.promptTitle} style={{ fontSize: 13, marginBottom: 10 }}>
                  📋 Histórico da sessão
                </div>
                {cycleHistory.map((entry, i) => (
                  <div key={i} style={{ marginBottom: 10 }}>
                    <div style={{ fontSize: 12, fontWeight: 700, color: "var(--text-muted)", marginBottom: 2 }}>
                      Ciclo {entry.cycle}
                    </div>
                    {entry.tasks.length > 0 ? (
                      <ul style={{ margin: 0, paddingLeft: 18, fontSize: 13, color: "var(--text)" }}>
                        {entry.tasks.map((t, j) => <li key={j}>✓ {t}</li>)}
                      </ul>
                    ) : (
                      <div style={{ fontSize: 12, color: "var(--text-muted)", paddingLeft: 4 }}>
                        — sem tarefas registradas
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}

            <button className={`${styles.btn} ${styles.btnPrimary}`} onClick={handleSummaryClose}>
              📝 Registrar uso
            </button>
          </>
        )}
      </div>
    </div>
  );
}
