import { useState, useEffect, useRef, useCallback, useMemo } from "react";
import { playBeep, playTimerDone, playNewRecord } from "../../lib/sounds";
import { tasksApi } from "../../api/tasks";
import { useSessionPersist } from "../../lib/useSessionPersist";
import { getHelper } from "./helpers/index";
import { addSession, getHistory, getMaxLevel, updateMaxLevel, getStreak, getWeeklyStats, getMaxLevelByMode, updateMaxLevelByMode, getLastDateByLevel } from "../../lib/dailyFocusHistory";
import { tryUnlock } from "../../lib/dailyFocusAchievements";
import { getDayLevel, setDayLevel, getUsedModes, addUsedModes } from "../../lib/dailyFocusDay";
import { usageStats } from "../../lib/modeLog";
import { logCheckinUsage, getCheckinCount, getCheckinStreak, logSessionFeedback } from "../../lib/checkinLog";
import CheckInScreen from "./CheckInScreen";
import styles from "./DailyFocus.module.css";
import { MODES } from "../../data/modes";
import { ESTADOS_DEFAULT } from "./stateToMode";
import HelperPickerModal from "./components/HelperPickerModal";
import HistoryPanel from "./components/HistoryPanel";
import AchievementToast from "./components/AchievementToast";
import StepsLadder, { getStageTheme } from "./components/StepsLadder";
import WeekHeatmap from "./components/WeekHeatmap";
import ProgressDots from "./components/ProgressDots";
import DailyTimer from "./components/DailyTimer";
import TaskSlot from "./components/TaskSlot";

// ── utils ────────────────────────────────────────────────
function makeTasks(level) {
  return Array.from({ length: level }, (_, i) => ({
    title: "",
    supabaseId: null,
    durationMin: (level - i) * 15,
    done: false,
    helperModeId: null,
  }));
}

function todayStr() {
  return new Date().toLocaleDateString("pt-BR");
}

function nowTimeStr() {
  return new Date().toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
}

// ── Mode helpers ─────────────────────────────────────────
function getModeById(id) {
  if (!id) return null;
  const custom = JSON.parse(localStorage.getItem("customModes") || "[]");
  return [...MODES, ...custom].find((m) => m.id === id) || null;
}

// ── Notifications ────────────────────────────────────────
function requestNotifPermission() {
  if ("Notification" in window && Notification.permission === "default") {
    Notification.requestPermission();
  }
}

function sendNotif(title, body) {
  if ("Notification" in window && Notification.permission === "granted") {
    try { new Notification(title, { body }); } catch {}
  }
}

// ── Celebrate messages by estado ────────────────────────
const ESTADO_CELEBRATE_MSG = {
  travado:    "Conseguiu sair do lugar mesmo travado — isso é o mais difícil. 💪",
  cansado:    "Focou mesmo cansado. Isso é disciplina de verdade. 🌟",
  ansioso:    "Transformou ansiedade em produção. Resiliência em ação. ⚡",
  sem_foco:   "Criou foco do zero. Nada de fácil nisso. 🔥",
  disperso:   "Ancorou a mente e fez acontecer. Missão cumprida. 🪟",
  energizado: "Aproveitou o pico de energia do jeito certo. 🚀",
};

// ── Main Page ────────────────────────────────────────────

export default function DailyFocusPage() {
  const { saved, persist, clearSaved } = useSessionPersist("daily_focus");

  const [level, setLevel]                   = useState(saved?.level ?? getDayLevel());
  const [tasks, setTasks]                   = useState(saved?.tasks ?? makeTasks(1));
  const [currentIdx, setCurrentIdx]         = useState(saved?.currentIdx ?? 0);
  const [helperStates, setHelperStates]     = useState(saved?.helperStates ?? {}); // { modeId: state }
  const [timerRemaining, setTimerRemaining] = useState(saved?.timerRemaining ?? null);
  const [timerRunning, setTimerRunning]     = useState(false);
  const [phase, setPhase]                   = useState(saved?.phase ?? "checkin");
  const [timerDone, setTimerDone]           = useState(false);
  const [rushMode, setRushMode]             = useState(saved?.rushMode ?? false);
  const [taskTimings, setTaskTimings]       = useState(saved?.taskTimings ?? []); // [{used, total}]
  const [_taskStartRemaining, setTaskStartRemaining] = useState(null);

  // Modos usados hoje (bloqueados no picker)
  const [usedModes, setUsedModes] = useState(() => getUsedModes());

  // Recorde pessoal e progresso do dia
  const maxLevel = getMaxLevel();
  const dayLevel = getDayLevel();

  // All modes (built-in + custom)
  const ALL_MODES = useMemo(() => {
    const custom = JSON.parse(localStorage.getItem("customModes") || "[]");
    return [...MODES, ...custom];
  }, []);

  // Streak e modo sugerido (calculados uma vez ao montar)
  const streak = getStreak();
  const suggestedModeId = useMemo(() => {
    const stats = usageStats(30);
    const available = stats.filter((s) => !usedModes.includes(s.modeId));
    return available[0]?.modeId ?? null;
  }, [usedModes]);

  // Check-in: modo pré-selecionado pelo estado emocional (persiste na sessão)
  const [checkinModeId, setCheckinModeId] = useState(saved?.checkinModeId ?? null);
  const [checkinEstadoId, setCheckinEstadoId] = useState(saved?.checkinEstadoId ?? null);

  // Feedback de sessão (não persiste)
  const [sessionFeedback, setSessionFeedback] = useState(null); // null | "good" | "bad"

  // UI state (not persisted)
  const [showHelperPicker, setShowHelperPicker]   = useState(false);
  const [pickerForTask, setPickerForTask]         = useState(null); // index | null (null = work-phase global)
  const [showHistory, setShowHistory]             = useState(false);
  const [newAchievements, setNewAchievements]     = useState([]);
  const [editingTitle, setEditingTitle]           = useState(false);
  const [editTitle, setEditTitle]                 = useState("");
  const [copiedShare, setCopiedShare]             = useState(false);
  const [pausedSince, setPausedSince]             = useState(null); // timestamp
  const [longPause, setLongPause]                 = useState(false);
  const [newRecord, setNewRecord]                 = useState(false);
  const [_notifRequested, _setNotifRequested]       = useState(false);
  const [ladderAnimating, setLadderAnimating]     = useState(false);

  // Recordes por modo
  const maxLevelTimer = getMaxLevelByMode(false);
  const maxLevelRush  = getMaxLevelByMode(true);
  const lastDateByLevel = getLastDateByLevel();

  // Meta semanal
  const weeklyStats = getWeeklyStats();
  const weeklyCount = weeklyStats.filter((d) => d.count > 0).length;
  const WEEKLY_GOAL = 5;

  // Persist on state changes
  useEffect(() => {
    persist({ level, tasks, currentIdx, helperStates, timerRemaining, phase, rushMode, taskTimings, checkinModeId, checkinEstadoId });
  }, [level, tasks, currentIdx, helperStates, timerRemaining, phase, rushMode, taskTimings, checkinModeId, checkinEstadoId]);

  // Atualiza document.title conforme a fase
  useEffect(() => {
    if (phase === "work") {
      document.title = `⚡ Nível ${level} — TaskFlow`;
    } else if (phase === "celebrate") {
      document.title = `🎉 Nível ${level} completo! — TaskFlow`;
    } else {
      document.title = "TaskFlow";
    }
    return () => { document.title = "TaskFlow"; };
  }, [phase, level]);

  // Space bar → pause/resume
  useEffect(() => {
    const handler = (e) => {
      if (e.target.tagName === "INPUT" || e.target.tagName === "TEXTAREA") return;
      if (e.code === "Space" && phase === "work" && !rushMode && !timerDone) {
        e.preventDefault();
        setTimerRunning((v) => !v);
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [phase, rushMode, timerDone]);

  // Avisa ao fechar aba com sessão em andamento
  useEffect(() => {
    if (phase !== "work") return;
    const handler = (e) => { e.preventDefault(); e.returnValue = ""; };
    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, [phase]);

  // Long pause detection (after 5 min paused)
  useEffect(() => {
    if (!timerRunning && phase === "work" && !rushMode && timerRemaining != null && timerRemaining > 0 && timerRemaining < (tasks[currentIdx]?.durationMin * 60)) {
      setPausedSince(Date.now());
    } else {
      setPausedSince(null);
      setLongPause(false);
    }
  }, [timerRunning]);

  useEffect(() => {
    if (!pausedSince) return;
    const interval = setInterval(() => {
      if (Date.now() - pausedSince > 5 * 60 * 1000) {
        setLongPause(true);
      }
    }, 30000);
    return () => clearInterval(interval);
  }, [pausedSince]);

  const currentTask = tasks[currentIdx] || {};
  const totalSecs = (currentTask.durationMin || 0) * 60;
  const activeHelperModeId = currentTask.helperModeId;
  const helperEntry = getHelper(activeHelperModeId);
  const helperMode = getModeById(activeHelperModeId);
  const currentHelperState = helperStates[activeHelperModeId] || {};

  // ── helpers ──────────────────────────────────────────
  const updateTask = (i, val) =>
    setTasks((prev) => prev.map((t, idx) => (idx === i ? val : t)));

  const moveTask = (i, dir) => {
    setTasks((prev) => {
      const arr = [...prev];
      const target = i + dir;
      if (target < 0 || target >= arr.length) return arr;
      [arr[i], arr[target]] = [arr[target], arr[i]];
      // Preserve durations (they're positional, not per-task)
      return arr.map((t, j) => ({ ...t, durationMin: (arr.length - j) * 15 }));
    });
  };

  const allFilled = tasks.every((t) => t.title.trim());

  const startSession = () => {
    setTimerRemaining(tasks[0].durationMin * 60);
    setTaskStartRemaining(tasks[0].durationMin * 60);
    setCurrentIdx(0);
    setTimerRunning(false);
    setTimerDone(false);
    setTaskTimings([]);
    setPhase("work");
    requestNotifPermission();
  };

  const handleTaskChange = useCallback((i, val) => updateTask(i, val), []);
  const handleTaskMoveUp = useCallback((i) => moveTask(i, -1), []);
  const handleTaskMoveDown = useCallback((i) => moveTask(i, 1), []);

  const handleDismissAchievement = useCallback(() => setNewAchievements([]), []);

  const handleCloseHistory = useCallback(() => setShowHistory(false), []);
  const handleCloseHelperPicker = useCallback(() => { setShowHelperPicker(false); setPickerForTask(null); }, []);

  const handleTimerTick = useCallback((remaining) => {
    setTimerRemaining(remaining);
  }, []);

  const handleTimerDone = useCallback(() => {
    setTimerRunning(false);
    setTimerDone(true);
    playTimerDone();
    sendNotif("⏰ Timer encerrado!", `Tarefa: ${tasks[currentIdx]?.title || ""}`);
  }, [tasks, currentIdx]);

  const handleHelperChange = useCallback((newState) => {
    setHelperStates((prev) => {
      const modeId = tasks[currentIdx]?.helperModeId;
      if (!modeId) return prev;
      const resolved = typeof newState === "function" ? newState(prev[modeId] || {}) : newState;
      return { ...prev, [modeId]: resolved };
    });
  }, [tasks, currentIdx]);

  // When switching to a new task, init helper state if needed
  const initHelperIfNeeded = (modeId) => {
    if (!modeId) return;
    setHelperStates((prev) => {
      if (prev[modeId]) return prev;
      const entry = getHelper(modeId);
      return { ...prev, [modeId]: entry?.defaultState ?? {} };
    });
  };

  const handleSelectHelper = (modeId) => {
    if (pickerForTask !== null) {
      // Slot-level picker (select phase or work-phase per-task)
      updateTask(pickerForTask, { ...tasks[pickerForTask], helperModeId: modeId });
      initHelperIfNeeded(modeId);
    } else {
      // Work-phase "add/change for current task"
      updateTask(currentIdx, { ...tasks[currentIdx], helperModeId: modeId });
      initHelperIfNeeded(modeId);
    }
    setPickerForTask(null);
    setShowHelperPicker(false);
  };

  const handleRemoveHelper = () => {
    if (pickerForTask !== null) {
      updateTask(pickerForTask, { ...tasks[pickerForTask], helperModeId: null });
    } else {
      updateTask(currentIdx, { ...tasks[currentIdx], helperModeId: null });
    }
    setPickerForTask(null);
    setShowHelperPicker(false);
  };

  const handleCompleteTask = () => {
    // Record timing feedback
    const usedSecs = totalSecs - (timerRemaining ?? totalSecs);
    const usedMin = Math.max(0, Math.round(usedSecs / 60));
    const isEarly = !rushMode && timerRemaining > 0 && timerRemaining < totalSecs;
    const newTimings = [...taskTimings, { used: usedMin, total: currentTask.durationMin, early: isEarly }];
    setTaskTimings(newTimings);

    const updated = tasks.map((t, i) => (i === currentIdx ? { ...t, done: true } : t));
    setTasks(updated);

    playBeep(); // som de conclusão de tarefa

    const nextIdx = currentIdx + 1;
    if (nextIdx >= tasks.length) {
      // Session complete
      setTimerRunning(false);
      completeSession(updated, newTimings, isEarly);
    } else {
      setCurrentIdx(nextIdx);
      setTimerRemaining(updated[nextIdx].durationMin * 60);
      setTaskStartRemaining(updated[nextIdx].durationMin * 60);
      setTimerRunning(false);
      setTimerDone(false);
      setLongPause(false);
      setPausedSince(null);
      initHelperIfNeeded(updated[nextIdx].helperModeId);
    }
  };

  const completeSession = (completedTasks, timings, hadEarlyCompletion) => {
    const isNewRecord = updateMaxLevel(level);
    updateMaxLevelByMode(level, rushMode);
    setNewRecord(isNewRecord);
    if (isNewRecord) playNewRecord();

    // Save history
    addSession({
      date: todayStr(),
      completedAt: nowTimeStr(),
      level,
      tasks: completedTasks.map((t) => t.title),
      timings,
      rushMode,
      estadoId: checkinEstadoId ?? null,
    });

    // Check achievements
    const toUnlock = [];
    const totalSessions = getHistory().length; // already saved
    if (totalSessions === 1) toUnlock.push("first_session");
    if (totalSessions >= 5) toUnlock.push("five_sessions");
    if (totalSessions >= 10) toUnlock.push("ten_sessions");
    if (level >= 2) toUnlock.push("level_2");
    if (level >= 3) toUnlock.push("level_3");
    if (level >= 5) toUnlock.push("level_5");
    if (rushMode) toUnlock.push("rush_master");
    if (completedTasks.some((t) => t.helperModeId)) toUnlock.push("helper_user");
    if (hadEarlyCompletion || timings.some((t) => t.early)) toUnlock.push("early_bird");

    const newAch = tryUnlock(toUnlock);
    if (newAch.length) setNewAchievements(newAch);

    // Salva nível do dia e modos usados
    setDayLevel(level);
    const modesUsedThisSession = completedTasks
      .map((t) => t.helperModeId)
      .filter(Boolean);
    addUsedModes(modesUsedThisSession);
    setUsedModes(getUsedModes());

    setPhase("celebrate");
  };

  const handleNextLevel = () => {
    const newLevel = level + 1;
    setLevel(newLevel);
    setTasks(makeTasks(newLevel));
    setCurrentIdx(0);
    setTimerRemaining(null);
    setTimerRunning(false);
    setTimerDone(false);
    setTaskTimings([]);
    setRushMode(false);
    setCheckinModeId(null);
    setCheckinEstadoId(null);
    setSessionFeedback(null);
    setPhase("checkin");
    setLadderAnimating(true);
    setTimeout(() => setLadderAnimating(false), 500);
  };

  const handleCheckinSelect = (modeId, estadoId) => {
    setCheckinModeId(modeId);
    setCheckinEstadoId(estadoId ?? null);
    logCheckinUsage(estadoId, modeId);
    // Pré-aplica na primeira tarefa se ela ainda não tiver modo selecionado
    setTasks((prev) => {
      if (prev[0]?.helperModeId) return prev;
      return prev.map((t, i) => i === 0 ? { ...t, helperModeId: modeId } : t);
    });
    initHelperIfNeeded(modeId);
    // Conquista "Auto-conhecimento": 5 check-ins
    if (getCheckinCount() >= 5) {
      const newAch = tryUnlock(["self_aware"]);
      if (newAch.length) setNewAchievements((prev) => [...prev, ...newAch]);
    }
    // Conquista: 7 dias seguidos de check-in
    const streak = getCheckinStreak();
    if (streak >= 7) {
      const newAchs2 = tryUnlock(["observador"]);
      if (newAchs2.length > 0) setNewAchievements((prev) => [...prev, ...newAchs2]);
    }
    setPhase("select");
  };

  const handleReset = () => {
    if (!window.confirm("Resetar tudo? O nível voltará para 1.")) return;
    clearSaved();
    setLevel(1);
    setTasks(makeTasks(1));
    setCurrentIdx(0);
    setHelperStates({});
    setTimerRemaining(null);
    setTimerRunning(false);
    setTimerDone(false);
    setTaskTimings([]);
    setRushMode(false);
    setCheckinModeId(null);
    setCheckinEstadoId(null);
    setSessionFeedback(null);
    setPhase("checkin"); // volta para o check-in ao resetar
  };

  const shareSession = async () => {
    const theme = getStageTheme(level);
    const stairWidth = Math.min(level, 8);
    const stairLines = Array.from({ length: stairWidth }, (_, i) => {
      const step = i + 1;
      const t = getStageTheme(step);
      const bar = "█".repeat(step);
      const pad = " ".repeat(stairWidth - step);
      return `${pad}${bar} ${t.emoji}${step}`;
    });
    const recLine = maxLevel > 0 ? `🏆 Recorde pessoal: Etapa ${maxLevel}` : "";
    const lines = [
      `🎯 Daily Focus · Etapa ${level} · ${theme.emoji} ${theme.name} · ${todayStr()}`,
      "",
      ...stairLines,
      "",
      ...tasks.map((t, i) => {
        const timing = taskTimings[i];
        const timeStr = timing ? ` (${timing.used}/${timing.total}min${timing.early ? " ⚡" : ""})` : ` (${t.durationMin}min)`;
        return `${i + 1}. ${t.title}${timeStr}`;
      }),
      ...(newRecord ? ["", "🏆 Novo recorde pessoal!"] : recLine ? ["", recLine] : []),
    ];
    const text = lines.join("\n");
    try {
      await navigator.clipboard.writeText(text);
      setCopiedShare(true);
      setTimeout(() => setCopiedShare(false), 2000);
    } catch {}
  };

  const startEditTitle = () => {
    setEditTitle(currentTask.title);
    setEditingTitle(true);
  };

  const saveEditTitle = () => {
    if (editTitle.trim()) {
      updateTask(currentIdx, { ...currentTask, title: editTitle.trim() });
    }
    setEditingTitle(false);
  };

  // ── Render ───────────────────────────────────────────
  return (
    <div className={styles.page}>
      {/* Header */}
      <div className={styles.header}>
        <div className={styles.headerTitle}>🎯 Daily Focus</div>
        <div className={styles.headerMeta}>
          <span className={styles.headerLevel}>Nível {level}</span>
          {streak >= 2 && <span className={styles.streakBadge}>🔥 {streak}</span>}
          {phase === "work" && checkinEstadoId && (() => {
            const estadoInfo = ESTADOS_DEFAULT.find((e) => e.id === checkinEstadoId);
            const modoInfo = checkinModeId ? getModeById(checkinModeId) : null;
            return estadoInfo ? (
              <span style={{
                fontSize: "11px",
                color: "var(--text-muted)",
                background: "var(--surface-2)",
                border: "1px solid var(--border)",
                padding: "2px 8px",
                borderRadius: "20px",
                display: "flex",
                alignItems: "center",
                gap: "4px",
              }}>
                {estadoInfo.emoji}
                {modoInfo ? ` · ${modoInfo.emoji}` : ""}
              </span>
            ) : null;
          })()}
        </div>
        <div className={styles.headerActions}>
          <button className={styles.iconBtn} onClick={() => setShowHistory(true)} title="Histórico">📋</button>
          {phase !== "select" && (
            <button className={styles.iconBtn} onClick={() => { setTimerRunning(false); setPhase("select"); }}>← Voltar</button>
          )}
          <button className={styles.iconBtn} onClick={handleReset}>↺</button>
        </div>
      </div>

      {/* Content */}
      <div className={styles.content}>

        {/* ── CHECK-IN PHASE ── */}
        {phase === "checkin" && (
          <CheckInScreen
            allModes={ALL_MODES}
            onSelect={handleCheckinSelect}
            onSkip={() => setPhase("select")}
          />
        )}

        {/* ── SELECT PHASE ── */}
        {phase === "select" && (
          <div>
            {/* Banner do modo sugerido pelo check-in */}
            {checkinModeId && (() => {
              const m = getModeById(checkinModeId);
              return m ? (
                <div style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "10px",
                  padding: "10px 14px",
                  marginBottom: "16px",
                  background: "rgba(124,110,245,0.08)",
                  border: "1px solid rgba(124,110,245,0.3)",
                  borderRadius: "var(--radius-sm)",
                  fontSize: "13px",
                }}>
                  <span style={{ fontSize: "18px" }}>{m.emoji}</span>
                  <span>
                    <span style={{ fontWeight: 700 }}>{m.name}</span>
                    <span style={{ color: "var(--text-muted)", marginLeft: "6px" }}>sugerido para você</span>
                  </span>
                  <button
                    onClick={() => setCheckinModeId(null)}
                    style={{ marginLeft: "auto", background: "none", border: "none", color: "var(--text-muted)", fontSize: "16px", cursor: "pointer", padding: "0 4px", lineHeight: 1 }}
                    title="Remover sugestão"
                  >×</button>
                </div>
              ) : null;
            })()}

            {/* Heatmap semanal */}
            <WeekHeatmap />

            {/* Meta semanal */}
            <div className={styles.weeklyMeta}>
              <span>Esta semana:</span>
              <span className={weeklyCount >= WEEKLY_GOAL ? styles.weeklyGoalReached : styles.weeklyMetaCount}>
                {weeklyCount}/{WEEKLY_GOAL} dias
              </span>
              {weeklyCount >= WEEKLY_GOAL && <span>✅ Meta atingida!</span>}
            </div>

            {/* Badges de recorde e progresso do dia */}
            {(maxLevel > 0 || dayLevel > 1) && (
              <div className={styles.focusMetaRow}>
                {maxLevel > 0 && (
                  <span className={styles.recordBadge}>
                    🏆 Seu recorde: Etapa {maxLevel}
                  </span>
                )}
                {dayLevel > 1 && dayLevel <= level && (
                  <span className={styles.dayProgressBadge}>
                    Hoje: até Etapa {dayLevel}
                  </span>
                )}
              </div>
            )}

            {/* Recordes separados por modo */}
            {(maxLevelTimer > 0 || maxLevelRush > 0) && (
              <div className={styles.typedRecordsRow}>
                {maxLevelTimer > 0 && <span className={styles.typedRecordBadge}>⏱️ Timer: Etapa {maxLevelTimer}</span>}
                {maxLevelRush > 0 && <span className={styles.typedRecordBadge}>🚀 Rush: Etapa {maxLevelRush}</span>}
              </div>
            )}

            {/* Escada de etapas */}
            <StepsLadder currentLevel={level} maxLevel={maxLevel} lastDateByLevel={lastDateByLevel} animating={ladderAnimating} />

            <div className={styles.selectTitleRow}>
              <div className={styles.selectTitle}>
                Nível {level} — {tasks.length} tarefa{tasks.length !== 1 ? "s" : ""}
              </div>
              {level > 1 && (
                <button className={styles.resetLevelBtn} onClick={() => { setLevel(1); setTasks(makeTasks(1)); }} title="Recomeçar do nível 1">
                  ↩ nível 1
                </button>
              )}
            </div>
            <div className={styles.selectSub}>
              {tasks.length === 1
                ? "Qual é a tarefa mais importante do seu dia?"
                : `Escolha as ${tasks.length} tarefas mais importantes do dia.`}
              {" "}Timers: {tasks.map((t) => `${t.durationMin}min`).join(" → ")}.
            </div>

            {/* Rush mode toggle */}
            <div className={styles.rushToggle}>
              <button
                className={`${styles.rushBtn} ${!rushMode ? styles.rushBtnActive : ""}`}
                onClick={() => setRushMode(false)}
              >
                ⏱️ Com timer
              </button>
              <button
                className={`${styles.rushBtn} ${rushMode ? styles.rushBtnActive : ""}`}
                onClick={() => setRushMode(true)}
              >
                🚀 Modo Rush
              </button>
            </div>

            {/* Task slots */}
            <div className={styles.taskSlots}>
              {tasks.map((slot, i) => (
                <TaskSlot
                  key={i}
                  slot={slot}
                  index={i}
                  level={level}
                  onChange={(val) => handleTaskChange(i, val)}
                  onMoveUp={() => handleTaskMoveUp(i)}
                  onMoveDown={() => handleTaskMoveDown(i)}
                  canMoveUp={i > 0}
                  canMoveDown={i < tasks.length - 1}
                  usedModes={usedModes}
                  suggestedModeId={checkinModeId ?? suggestedModeId}
                />
              ))}
            </div>

            <button className={styles.startBtn} disabled={!allFilled} onClick={startSession}>
              {allFilled ? (rushMode ? "🚀 Começar no Modo Rush" : "▶ Começar sessão") : "Preencha todas as tarefas"}
            </button>
          </div>
        )}

        {/* ── WORK PHASE ── */}
        {phase === "work" && (
          <div className={styles.workLayout}>
            {/* Progress dots */}
            {tasks.length > 1 && (
              <ProgressDots total={tasks.length} current={currentIdx} done={currentIdx} />
            )}

            {/* Task card */}
            <div className={styles.taskCard}>
              <div className={styles.taskCardLabel}>
                Tarefa {currentIdx + 1} / {tasks.length}
                {rushMode && <span className={styles.rushBadge}>🚀 Rush</span>}
              </div>
              {editingTitle ? (
                <div className={styles.editTitleWrap}>
                  <input
                    className={styles.editTitleInput}
                    value={editTitle}
                    onChange={(e) => setEditTitle(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && saveEditTitle()}
                    autoFocus
                  />
                  <button className={styles.editTitleSave} onClick={saveEditTitle}>✓</button>
                </div>
              ) : (
                <div className={styles.taskCardTitleRow}>
                  <div className={styles.taskCardTitle}>{currentTask.title}</div>
                  <button className={styles.editTitleBtn} onClick={startEditTitle} title="Editar título">✏️</button>
                </div>
              )}
              {!rushMode && <div className={styles.taskCardTime}>{currentTask.durationMin} min</div>}
            </div>

            {/* Timer (only in timer mode) */}
            {!rushMode && (
              <div className={styles.timerWrap}>
                <DailyTimer
                  key={`${currentIdx}-${totalSecs}`}
                  totalSeconds={totalSecs}
                  initialRemaining={timerRemaining ?? totalSecs}
                  running={timerRunning}
                  onTick={handleTimerTick}
                  onComplete={handleTimerDone}
                />

                {timerDone && (
                  <div className={styles.timerComplete}>
                    ⏰ Tempo esgotado — marque quando terminar!
                  </div>
                )}

                {longPause && !timerDone && (
                  <div className={styles.longPauseBanner}>
                    ☕ Pausado há mais de 5 min — tudo bem, retome quando quiser
                  </div>
                )}

                <div className={styles.timerBtns}>
                  <button
                    className={`${styles.timerBtn} ${styles.timerBtnPrimary}`}
                    onClick={() => { setTimerRunning((v) => !v); setLongPause(false); }}
                    disabled={timerDone}
                  >
                    {timerRunning ? "⏸ Pausar" : "▶ Iniciar"}
                  </button>
                </div>
                {!timerRunning && !timerDone && timerRemaining === totalSecs && (
                  <div className={styles.timerHint}>Pressione Espaço para iniciar</div>
                )}
              </div>
            )}

            {/* Helper panel */}
            {helperEntry && helperMode && (
              <div className={styles.helperPanel}>
                <div className={styles.helperPanelHeader}>
                  <span className={styles.helperPanelEmoji}>{helperMode.emoji}</span>
                  <span className={styles.helperPanelName}>{helperMode.name}</span>
                  <span className={styles.helperPanelBadge}>modo de apoio</span>
                </div>
                <helperEntry.Component
                  state={currentHelperState}
                  onChange={handleHelperChange}
                  modeConfig={helperMode}
                />
              </div>
            )}

            {/* Banner: quase batendo recorde */}
            {level > maxLevel && maxLevel > 0 && currentIdx === tasks.length - 1 && (
              <div className={styles.almostRecordBanner}>
                🏆 Última tarefa! Complete para bater seu recorde de Etapa {maxLevel}!
              </div>
            )}
            {level > maxLevel && maxLevel > 0 && currentIdx < tasks.length - 1 && (
              <div className={styles.almostRecordBanner}>
                ⚡ Sessão de recorde em andamento — Etapa {level}!
              </div>
            )}

            {/* Actions */}
            <div className={styles.workActions}>
              <button className={styles.doneBtn} onClick={handleCompleteTask}>
                ✅ Concluí esta tarefa
              </button>
              <button
                className={styles.changeHelperBtn}
                onClick={() => { setPickerForTask(null); setShowHelperPicker(true); }}
              >
                {helperMode ? `🔄 Trocar modo de apoio (${helperMode.name})` : "🎯 Adicionar modo de apoio"}
              </button>
            </div>
          </div>
        )}

        {/* ── CELEBRATE PHASE ── */}
        {phase === "celebrate" && (
          <div className={styles.celebration}>
            <div className={styles.celebrationEmoji}>{newRecord ? "🏆" : "🎉"}</div>
            <div className={styles.celebrationTitle}>
              {newRecord ? `🏆 Novo recorde! Etapa ${level}` : `Nível ${level} completo!`}
            </div>
            {newRecord && (
              <div className={styles.newRecordHighlight}>
                Você superou seu recorde anterior!
              </div>
            )}
            <div className={styles.celebrationSub}>
              {checkinEstadoId && ESTADO_CELEBRATE_MSG[checkinEstadoId]
                ? ESTADO_CELEBRATE_MSG[checkinEstadoId]
                : `${tasks.length} tarefa${tasks.length !== 1 ? "s" : ""} feita${tasks.length !== 1 ? "s" : ""}. O Nível ${level + 1} tem ${level + 1} tarefa${level + 1 !== 1 ? "s" : ""}.`
              }
            </div>
            {checkinEstadoId && ESTADO_CELEBRATE_MSG[checkinEstadoId] && (
              <div style={{ fontSize: "12px", color: "var(--text-muted)" }}>
                {tasks.length} tarefa{tasks.length !== 1 ? "s" : ""} · Nível {level} → {level + 1}
              </div>
            )}
            {checkinEstadoId && (() => {
              const e = ESTADOS_DEFAULT.find((est) => est.id === checkinEstadoId);
              const m = checkinModeId ? getModeById(checkinModeId) : null;
              return e ? (
                <div style={{
                  fontSize: "13px",
                  color: "var(--text-muted)",
                  background: "var(--surface)",
                  border: "1px solid var(--border)",
                  borderRadius: "var(--radius-sm)",
                  padding: "8px 14px",
                  display: "flex",
                  alignItems: "center",
                  gap: "8px",
                }}>
                  <span>{e.emoji} {e.label}</span>
                  {m && <><span style={{ color: "var(--border)" }}>·</span><span>{m.emoji} {m.name}</span></>}
                </div>
              ) : null;
            })()}

            {checkinEstadoId && checkinModeId && sessionFeedback === null && (() => {
              const m = getModeById(checkinModeId);
              return (
                <div style={{
                  marginTop: "12px",
                  padding: "10px 14px",
                  background: "var(--surface)",
                  border: "1px solid var(--border)",
                  borderRadius: "var(--radius-sm)",
                  fontSize: "13px",
                  color: "var(--text-muted)",
                  display: "flex",
                  flexDirection: "column",
                  gap: "8px",
                }}>
                  <span>O modo {m?.emoji} {m?.name} funcionou hoje?</span>
                  <div style={{ display: "flex", gap: "8px" }}>
                    <button
                      onClick={() => {
                        setSessionFeedback("good");
                        logSessionFeedback(checkinEstadoId, checkinModeId, 1);
                      }}
                      style={{
                        flex: 1, padding: "6px", borderRadius: "6px", border: "1px solid var(--border)",
                        background: "var(--surface-2)", cursor: "pointer", fontSize: "16px",
                      }}
                    >👍</button>
                    <button
                      onClick={() => {
                        setSessionFeedback("bad");
                        logSessionFeedback(checkinEstadoId, checkinModeId, -1);
                      }}
                      style={{
                        flex: 1, padding: "6px", borderRadius: "6px", border: "1px solid var(--border)",
                        background: "var(--surface-2)", cursor: "pointer", fontSize: "16px",
                      }}
                    >👎</button>
                  </div>
                </div>
              );
            })()}
            {sessionFeedback === "good" && (
              <div style={{ fontSize: "12px", color: "var(--success)", marginTop: "8px" }}>
                ✓ Ótimo! Vamos continuar recomendando esse modo para você.
              </div>
            )}
            {sessionFeedback === "bad" && (
              <div style={{ fontSize: "12px", color: "var(--text-muted)", marginTop: "8px" }}>
                ✓ Anotado. Vamos ajustar as sugestões.
              </div>
            )}

            {/* Task breakdown */}
            <div className={styles.celebrationTasks}>
              {tasks.map((t, i) => {
                const timing = taskTimings[i];
                return (
                  <div key={i} className={styles.celebrationTask}>
                    <span className={styles.celebrationTaskCheck}>✓</span>
                    <span className={styles.celebrationTaskTitle}>{t.title}</span>
                    {timing && (
                      <span className={`${styles.celebrationTaskTime} ${timing.early ? styles.success : ""}`}>
                        {timing.early ? "⚡ " : ""}{timing.used}/{timing.total}min
                      </span>
                    )}
                  </div>
                );
              })}
            </div>

            <div className={styles.celebrationBtns}>
              <button className={styles.celebrationNextBtn} onClick={handleNextLevel}>
                🚀 Ir para o Nível {level + 1}
              </button>
              <button className={styles.shareBtn} onClick={shareSession}>
                {copiedShare ? "✓ Copiado!" : "📋 Compartilhar"}
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Modals */}
      {showHelperPicker && (
        <HelperPickerModal
          current={activeHelperModeId}
          usedModes={usedModes}
          suggestedModeId={suggestedModeId}
          onSelect={handleSelectHelper}
          onRemove={activeHelperModeId ? handleRemoveHelper : null}
          onClose={handleCloseHelperPicker}
        />
      )}

      {showHistory && <HistoryPanel onClose={handleCloseHistory} />}

      {newAchievements.length > 0 && (
        <AchievementToast
          achievements={newAchievements}
          onDismiss={handleDismissAchievement}
        />
      )}
    </div>
  );
}
