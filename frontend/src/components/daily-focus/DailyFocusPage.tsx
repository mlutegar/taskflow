import { useState, useEffect, useRef, useCallback, useMemo } from "react";
import { withOfflineFallback } from "../../lib/syncQueue";
import { getCustomModes } from "../../lib/customModes";
import { playBeep, playTimerDone, playNewRecord, playPaperReview } from "../../lib/sounds";
import { tasksApi } from "../../api/tasks";
import { useSessionPersist } from "../../lib/useSessionPersist";
import { DailyFocusLive, loadDailyFocusLive, saveDailyFocusLive, clearDailyFocusLive, liveRemaining, DAILY_FOCUS_LIVE_EVENT, endRemoteActiveSession, loadRemoteActiveSession, flushActiveSessionPush, beaconActiveSessionNow } from "../../lib/dailyFocusLive";
import { getHelper } from "./helpers/index";
import { addSession, getHistory, getMaxLevel, updateMaxLevel, getStreak, getWeeklyStats, getMaxLevelByMode, updateMaxLevelByMode, getLastDateByLevel, getMaxCycles, updateMaxCycles } from "../../lib/dailyFocusHistory";
import { tryUnlock } from "../../lib/dailyFocusAchievements";
import { getDayLevel, setDayLevel, getUsedModes, addUsedModes } from "../../lib/dailyFocusDay";
import {
  isTodaySelfDev, setTodaySelfDev, getSelfDevStreak,
  isRecommendationDismissed, dismissRecommendation,
  getExampleOfTheDay, COMPOUND_YEAR_FACTOR,
} from "../../lib/selfDevelopment";
import { getContinuousActivity, setContinuousActivity, replaceContinuousActivity, getLastActivity, getContinuousStreak, registerTick, addProgress, completeContinuousActivity, uncompleteLast, getCompletedToday, type ContinuousActivity, type CompletedEntry } from "../../lib/continuousActivity";
import ContinuousActivityPicker from "./components/ContinuousActivityPicker";
import { useToast } from "../shared/Toast";
import { usageStats } from "../../lib/sessionUsageLog";
import { logCheckinUsage, getCheckinCount, getCheckinStreak, logSessionFeedback, updateLastFeedbackEstadoAfter } from "../../lib/checkinLog";
import CheckInScreen from "./CheckInScreen";
import PrepareDayScreen, { type DayPriority } from "./PrepareDayScreen";
import EmotionCheckModal from "./components/EmotionCheckModal";
import { logEmotion, getTodayEmotions, getEmotionCount } from "../../lib/emotionLog";
import { getEmotionById } from "../../data/emotions";
import type { EmotionMoment } from "../../types";
import { useQuickTask } from "../../contexts/QuickTaskContext";
import {
  MOBILE_MQ, isMobileViewport, readMinimizedPref, writeMinimizedPref, initialContActMinimized,
} from "../../lib/continuousActivityUiPrefs";

// Contexto capturado no instante do checkpoint emocional (associa emoção ao momento da sessão).
interface EmotionCtx {
  taskTitle?: string;
  taskIndex?: number;
  taskId?: string | null;
  modeIds?: string[];
  level?: number;
  rushMode?: boolean;
  tabMode?: boolean;
  pauseSecs?: number;
  completed?: boolean;
  usedSecs?: number;
  totalSecs?: number;
}

// Cooldown para não reabrir o modal em micro-pausas (Play→Pause→Play em poucos segundos).
const EMOTION_COOLDOWN_MS = 2 * 60 * 1000;
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
import TabModeBar from "./components/TabModeBar";
import TaskSlot from "./components/TaskSlot";
import SlotBoard from "../SlotBoard";
import { useActiveMode } from "../../contexts/ActiveModeContext";
import { useConfirm } from "../ConfirmDialog";

interface Task {
  title: string;
  supabaseId: string | null;
  durationMin: number;
  done: boolean;
  helperModeIds: string[];
  interModeIds: string[];
  onHold: boolean;
  savedTimerSecs: number | null;
}

interface TaskTiming {
  used: number;
  total: number;
  early: boolean;
}

// ── utils ────────────────────────────────────────────────
function makeTasks(level: number): Task[] {
  return Array.from({ length: level }, (_, i) => ({
    title: "",
    supabaseId: null,
    durationMin: (level - i) * 15,
    done: false,
    helperModeIds: [],
    interModeIds: [],
    onHold: false,
    savedTimerSecs: null,
  }));
}

// Migra sessões antigas que usavam helperModeId (string) para helperModeIds (array)
// e adiciona interModeIds se não existir
function migrateTasks(tasks: any): Task[] {
  if (!Array.isArray(tasks)) return tasks;
  return tasks.map((t: any) => {
    let task = t;
    if ("helperModeId" in task && !("helperModeIds" in task)) {
      const { helperModeId, ...rest } = task;
      task = { ...rest, helperModeIds: helperModeId ? [helperModeId] : [] };
    }
    if (!("helperModeIds" in task)) task = { ...task, helperModeIds: [] };
    if (!("interModeIds" in task)) task = { ...task, interModeIds: [] };
    if (!("onHold" in task)) task = { ...task, onHold: false };
    if (!("savedTimerSecs" in task)) task = { ...task, savedTimerSecs: null };
    return task;
  });
}

function todayStr(): string {
  return new Date().toLocaleDateString("pt-BR");
}

function nowTimeStr(): string {
  return new Date().toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
}

// ── Mode helpers ─────────────────────────────────────────
function getModeById(id: string | null | undefined): any | null {
  if (!id) return null;
  return [...MODES, ...getCustomModes()].find((m) => m.id === id) || null;
}

// ── Notifications ────────────────────────────────────────
function requestNotifPermission(): void {
  if ("Notification" in window && Notification.permission === "default") {
    Notification.requestPermission();
  }
}

function sendNotif(title: string, body: string): void {
  if ("Notification" in window && Notification.permission === "granted") {
    try { new Notification(title, { body }); } catch {}
  }
}

// ── Paper & Pen reminder system ─────────────────────────
const PAPER_DEFAULT_REMINDERS = ["limpar wpp", "beber 4L de água"];
const PAPER_REVIEW_INTERVAL   = 15 * 60; // segundos de trabalho acumulado
const PAPER_REMINDERS_LS_KEY  = "taskflow.paperReminders";

function loadPaperReminders(): string[] {
  try {
    const raw = localStorage.getItem(PAPER_REMINDERS_LS_KEY);
    if (raw) return JSON.parse(raw);
  } catch {}
  return PAPER_DEFAULT_REMINDERS;
}
function savePaperReminders(list: string[]): void {
  try {
    localStorage.setItem(PAPER_REMINDERS_LS_KEY, JSON.stringify(list));
    withOfflineFallback("PUT", "/preferences", { paperReminders: list });
  } catch {}
}

// ── Celebrate messages by estado ────────────────────────
const ESTADO_CELEBRATE_MSG: Record<string, string> = {
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
  const { showToast } = useToast();

  // Snapshot "live" (card persistente): lido uma vez no mount para rehidratar o timer
  // caso o usuário tenha retomado a sessão pelo card enquanto navegava por outra página.
  const liveInit = useRef<DailyFocusLive | null>(loadDailyFocusLive()).current;

  const [level, setLevel]                   = useState<number>(saved?.level ?? getDayLevel());
  const [tasks, setTasks]                   = useState<Task[]>(() => migrateTasks(saved?.tasks ?? makeTasks(1)));
  const [currentIdx, setCurrentIdx]         = useState<number>(saved?.currentIdx ?? 0);
  // helperStates isolado por tarefa: chave = "${taskIdx}:${modeId}"
  // Migra formato antigo { modeId: state } → { "0:modeId": state }
  const [helperStates, setHelperStates]     = useState<Record<string, any>>(() => {
    const raw = saved?.helperStates ?? {};
    const hasCompound = Object.keys(raw).some((k: string) => k.includes(":"));
    if (hasCompound || Object.keys(raw).length === 0) return raw;
    // Formato antigo — atribui à tarefa 0
    const migrated: Record<string, any> = {};
    for (const [modeId, state] of Object.entries(raw)) {
      migrated[`0:${modeId}`] = state;
    }
    return migrated;
  });
  const [timerRemaining, setTimerRemaining] = useState<number | null>(() => {
    // Se o card retomou o timer em background, usa o restante já descontado.
    if (liveInit && liveInit.running && liveInit.remainingSecs != null) return liveRemaining(liveInit);
    return saved?.timerRemaining ?? null;
  });
  const [timerRunning, setTimerRunning]     = useState<boolean>(() => !!(liveInit && liveInit.running));
  // Fluxo direto: pula a tela de recomendação (CheckInScreen) e começa na preparação do dia.
  const [phase, setPhase]                   = useState<string>(saved?.phase ?? "prepare");
  // Checkpoint emocional exibido a cada início/retomada/fim do timer (null = fechado).
  // Guarda o momento + contexto capturado no instante do clique.
  const [emotionPrompt, setEmotionPrompt]   = useState<null | { moment: EmotionMoment; ctx: EmotionCtx }>(null);
  // Cooldown p/ evitar reabrir o modal em micro-pausas (Play→Pause→Play em segundos).
  const lastEmotionTsRef                    = useRef<number>(0);
  const [timerDone, setTimerDone]           = useState<boolean>(false);
  const [rushMode, setRushMode]             = useState<boolean>(saved?.rushMode ?? false);
  const [tabMode, setTabMode]               = useState<boolean>(saved?.tabMode ?? false);
  const [tabCycleCount, setTabCycleCount]   = useState<number>(saved?.tabCycleCount ?? 0);
  const [tabElapsed, setTabElapsed]         = useState<number>(saved?.tabElapsed ?? 0);
  const [showAddTabForm, setShowAddTabForm] = useState<boolean>(false);
  const [newTabTitle, setNewTabTitle]       = useState<string>("");
  const [taskTimings, setTaskTimings]       = useState<TaskTiming[]>(saved?.taskTimings ?? []); // [{used, total}]
  const [_taskStartRemaining, setTaskStartRemaining] = useState<number | null>(null);
  // índice da próxima tarefa aguardando após a fase "between"
  const [pendingNextIdx, setPendingNextIdx] = useState<number | null>(saved?.pendingNextIdx ?? null);

  // Modos usados hoje (bloqueados no picker)
  const [usedModes, setUsedModes] = useState<Record<string, number>>(() => getUsedModes());

  // Recorde pessoal e progresso do dia
  const maxLevel = getMaxLevel();
  const dayLevel = getDayLevel();

  // All modes (built-in + custom) — reativo ao evento customModesUpdated
  const [customModes, setCustomModes] = useState<any[]>(() => getCustomModes());
  useEffect(() => {
    const handler = () => setCustomModes(getCustomModes());
    window.addEventListener("customModesUpdated", handler);
    return () => window.removeEventListener("customModesUpdated", handler);
  }, []);
  const ALL_MODES = useMemo(() => [...MODES, ...customModes], [customModes]);

  // Streak e modo sugerido (calculados uma vez ao montar)
  const streak = getStreak();
  const suggestedModeId = useMemo(() => {
    const stats = usageStats(30);
    const available = stats.filter((s: any) => !usedModes[s.modeId]);
    return available[0]?.modeId ?? null;
  }, [usedModes]);

  // Check-in: modo pré-selecionado pelo estado emocional (persiste na sessão)
  const [checkinModeId, setCheckinModeId] = useState<string | null>(saved?.checkinModeId ?? null);
  const [checkinEstadoId, setCheckinEstadoId] = useState<string | null>(saved?.checkinEstadoId ?? null);

  // Prioridades do dia definidas na etapa de preparação (base da seleção do Daily Focus).
  const [dayPriorities, setDayPriorities] = useState<DayPriority[]>(saved?.dayPriorities ?? []);

  // Atividade Contínua do dia (atividade de fundo, sem timer, fora da sequência).
  // Persiste por dia via localStorage (continuousActivity.ts), não pelo useSessionPersist.
  const [continuousActivity, setContinuousActivityState] = useState<ContinuousActivity | null>(() => getContinuousActivity());
  // No mobile inicia minimizado (indicador compacto que expande ao tocar); no desktop, expandido.
  // Respeita preferência salva pelo usuário (ver initialContActMinimized / persistência abaixo).
  const [contActMinimized, setContActMinimized] = useState<boolean>(initialContActMinimized); // chip minimizado na fase work
  const contActUserSetRef = useRef<boolean>(false); // usuário mexeu manualmente nesta sessão?
  const contActChipRef = useRef<HTMLDivElement | null>(null); // card expandido (focus/gesto)
  const contActTouchStartY = useRef<number | null>(null); // início de swipe-down p/ minimizar
  const { isOpen: quickTaskOpen } = useQuickTask();

  // Minimizar/expandir com persistência da escolha manual do usuário (por dispositivo).
  const setContActMinimizedPref = useCallback((min: boolean): void => {
    contActUserSetRef.current = true;
    setContActMinimized(min);
    writeMinimizedPref(min);
  }, []);

  // Reavalia o padrão ao girar/redimensionar — só enquanto o usuário não escolheu manualmente.
  useEffect(() => {
    if (typeof window === "undefined" || !window.matchMedia) return;
    const mq = window.matchMedia(MOBILE_MQ);
    const onChange = (): void => {
      if (contActUserSetRef.current) return; // respeita escolha manual
      if (readMinimizedPref() !== null) return; // preferência salva vence
      setContActMinimized(mq.matches);
    };
    mq.addEventListener?.("change", onChange);
    return () => mq.removeEventListener?.("change", onChange);
  }, []);

  // Ao abrir a captura rápida (FAB/atalho), recolhe a Atividade Contínua no mobile
  // para não competir visualmente; não persiste (é automático/temporário).
  useEffect(() => {
    if (quickTaskOpen && isMobileViewport()) setContActMinimized(true);
  }, [quickTaskOpen]);
  const [contActStreak] = useState<number>(() => getContinuousStreak());
  const [contActLast] = useState<ContinuousActivity | null>(() => getLastActivity());
  const [contActCopied, setContActCopied] = useState<boolean>(false);
  const [contActPicking, setContActPicking] = useState<boolean>(false); // picker aberto na fase work (concluir/trocar)
  const [contActDoneToday, setContActDoneToday] = useState<CompletedEntry[]>(() => getCompletedToday());
  // Grava campos da atividade (merge parcial) e re-lê o estado normalizado.
  const saveContinuousActivity = useCallback((patch: Partial<ContinuousActivity>): void => {
    setContinuousActivity(patch);
    setContinuousActivityState(getContinuousActivity());
  }, []);
  // Conclui a atividade atual (registra no dia), mostra toast com Desfazer e abre
  // o picker para escolher outra.
  const handleCompleteContinuousActivity = useCallback((): void => {
    const done = completeContinuousActivity();
    setContinuousActivityState(getContinuousActivity());
    setContActDoneToday(getCompletedToday());
    setContActPicking(true);
    if (done) {
      const adv = done.goalTarget != null
        ? `${done.progress}/${done.goalTarget} ${done.goalUnit}`.trim()
        : done.ticks > 0 ? `${done.ticks}× hoje` : "";
      showToast(
        `${done.icon || "🔄"} “${done.title}” concluída${adv ? ` · ${adv}` : ""}`,
        "success",
        {
          durationMs: 6000,
          action: {
            label: "Desfazer",
            onClick: () => {
              uncompleteLast();
              setContinuousActivityState(getContinuousActivity());
              setContActDoneToday(getCompletedToday());
              setContActPicking(false);
            },
          },
        },
      );
    }
  }, [showToast]);
  // Escolhe uma nova atividade contínua durante a sessão (troca): substitui a atual
  // zerando ticks/progress e fecha o picker.
  const pickContinuousActivity = useCallback((next: Partial<ContinuousActivity>): void => {
    replaceContinuousActivity(next);
    setContinuousActivityState(getContinuousActivity());
    setContActPicking(false);
  }, []);
  const clearContinuousActivityUI = useCallback((): void => {
    setContinuousActivity({ title: "", link: "", note: "", goalTarget: null, goalUnit: "" });
    setContinuousActivityState(getContinuousActivity());
  }, []);
  // Registra um acesso à atividade (tick) e opcionalmente abre o link.
  const openContinuousActivity = useCallback((): void => {
    const updated = registerTick();
    setContinuousActivityState(updated ?? getContinuousActivity());
  }, []);
  const bumpContinuousProgress = useCallback((delta: number): void => {
    const updated = addProgress(delta);
    setContinuousActivityState(updated ?? getContinuousActivity());
  }, []);
  const copyContinuousLink = useCallback((link: string): void => {
    try { navigator.clipboard?.writeText(link); } catch {}
    setContActCopied(true);
    setTimeout(() => setContActCopied(false), 1500);
  }, []);
  // Foco profundo → minimiza o chip; pausa → revela. (o usuário ainda pode alternar manualmente)
  useEffect(() => {
    if (phase !== "work") return;
    if (contActPicking) { setContActMinimized(false); return; } // não minimiza enquanto escolhe
    setContActMinimized(timerRunning);
  }, [timerRunning, phase, contActPicking]);

  // Ao expandir: move o foco para o primeiro botão do card (a11y).
  useEffect(() => {
    if (contActMinimized || !continuousActivity || phase !== "work") return;
    const el = contActChipRef.current?.querySelector<HTMLElement>("a, button");
    el?.focus();
  }, [contActMinimized, continuousActivity, phase]);

  // Mobile: tocar fora do card expandido minimiza (fecha limpo).
  useEffect(() => {
    if (contActMinimized || !isMobileViewport()) return;
    const onPointer = (e: PointerEvent): void => {
      const node = contActChipRef.current;
      if (node && !node.contains(e.target as Node)) setContActMinimizedPref(true);
    };
    document.addEventListener("pointerdown", onPointer);
    return () => document.removeEventListener("pointerdown", onPointer);
  }, [contActMinimized, setContActMinimizedPref]);

  // Feedback de sessão (não persiste)
  const [sessionFeedback, setSessionFeedback] = useState<string | null>(null); // null | "good" | "bad"
  const [estadoAfterSelected, setEstadoAfterSelected] = useState<string | null>(null);
  const [showAfterPicker, setShowAfterPicker] = useState<boolean>(false);

  // Aba ativa no painel de helpers quando há 2+ modos (não persiste)
  const [activeHelperTab, setActiveHelperTab] = useState<string | null>(null); // modeId | null
  // Cards colapsados (Set de modeIds) — não persiste
  const [collapsedHelpers, setCollapsedHelpers] = useState<Set<string>>(() => new Set());
  const toggleHelperCollapse = (modeId: string): void =>
    setCollapsedHelpers((prev) => {
      const next = new Set(prev);
      next.has(modeId) ? next.delete(modeId) : next.add(modeId);
      return next;
    });

  // UI state (not persisted)
  // Recomendação de autodesenvolvimento na 1ª tarefa
  const [selfDevMarked, setSelfDevMarked]         = useState<boolean>(() => isTodaySelfDev());
  const [recDismissed, setRecDismissed]           = useState<boolean>(() => isRecommendationDismissed());
  const [selfDevStreak, setSelfDevStreak]         = useState<number>(() => getSelfDevStreak());
  const selfDevExample = useMemo(() => getExampleOfTheDay(), []);
  const toggleSelfDev = useCallback(() => {
    setSelfDevMarked((prev) => {
      const next = !prev;
      setTodaySelfDev(next);
      setSelfDevStreak(getSelfDevStreak());
      return next;
    });
  }, []);
  const dismissRec = useCallback(() => {
    dismissRecommendation(7);
    setRecDismissed(true);
  }, []);
  const [showHelperPicker, setShowHelperPicker]   = useState<boolean>(false);
  const [pickerForTask, setPickerForTask]         = useState<number | null>(null); // index | null (null = work-phase global)
  const [showHistory, setShowHistory]             = useState<boolean>(false);
  const [newAchievements, setNewAchievements]     = useState<any[]>([]);
  const [editingTitle, setEditingTitle]           = useState<boolean>(false);
  const [editTitle, setEditTitle]                 = useState<string>("");
  const [copiedShare, setCopiedShare]             = useState<boolean>(false);
  const [pausedSince, setPausedSince]             = useState<number | null>(null); // timestamp
  const [longPause, setLongPause]                 = useState<boolean>(false);
  const [newRecord, setNewRecord]                 = useState<boolean>(false);
  const [_notifRequested, _setNotifRequested]       = useState<boolean>(false);
  const [ladderAnimating, setLadderAnimating]     = useState<boolean>(false);
  const [showTaskSwitcher, setShowTaskSwitcher]   = useState<boolean>(false);

  // Sessão de módulos ("Minha Sessão") reaproveitada na área pausada.
  const { activateMultiCard, hasActiveSession } = useActiveMode();
  const { confirm, ConfirmUI } = useConfirm();

  // Paper & Pen
  const workSecsRef = useRef<number>(0);
  const [showPaperReview, setShowPaperReview]   = useState<boolean>(false);
  const [paperCountdown, setPaperCountdown]     = useState<number>(PAPER_REVIEW_INTERVAL);
  const [paperReminders, setPaperReminders]     = useState<string[]>(loadPaperReminders);
  const [checkedReminders, setCheckedReminders] = useState<Set<string>>(new Set()); // itens marcados no review
  const [newReminderText, setNewReminderText]   = useState<string>("");
  const [reviewCount, setReviewCount]           = useState<number>(0); // total de revisões na sessão
  const [rushElapsed, setRushElapsed]           = useState<number>(0); // segundos corridos no rush mode

  // Recordes por modo
  const maxLevelTimer = getMaxLevelByMode(false);
  const maxLevelRush  = getMaxLevelByMode(true);
  const lastDateByLevel = getLastDateByLevel();

  // Fix #9: Meta semanal configurável (cicla entre 3, 5, 7 ao clicar)
  const WEEKLY_GOAL_OPTIONS = [3, 5, 7];
  const [weeklyGoal, setWeeklyGoal] = useState<number>(() => {
    const saved = parseInt(localStorage.getItem("taskflow.weeklyGoal") || "5", 10);
    return WEEKLY_GOAL_OPTIONS.includes(saved) ? saved : 5;
  });
  const cycleWeeklyGoal = (): void => {
    const next = WEEKLY_GOAL_OPTIONS[(WEEKLY_GOAL_OPTIONS.indexOf(weeklyGoal) + 1) % WEEKLY_GOAL_OPTIONS.length];
    setWeeklyGoal(next);
    localStorage.setItem("taskflow.weeklyGoal", String(next));
    withOfflineFallback("PUT", "/preferences", { weeklyGoal: next });
  };

  // Meta semanal — memoizado para não recalcular a cada render
  const weeklyStats = useMemo(() => getWeeklyStats(), []);
  const weeklyCount = useMemo(() => weeklyStats.filter((d: any) => d.count > 0).length, [weeklyStats]);
  const WEEKLY_GOAL = weeklyGoal;

  // Persist on state changes
  useEffect(() => {
    persist({ level, tasks, currentIdx, helperStates, timerRemaining, phase, rushMode, taskTimings, checkinModeId, checkinEstadoId, pendingNextIdx, tabMode, tabCycleCount, tabElapsed, dayPriorities });
  }, [level, tasks, currentIdx, helperStates, timerRemaining, phase, rushMode, taskTimings, checkinModeId, checkinEstadoId, pendingNextIdx, tabMode, tabCycleCount, tabElapsed, dayPriorities]);

  // Atualiza document.title conforme a fase
  useEffect(() => {
    if (phase === "work" || phase === "between") {
      document.title = `⚡ Nível ${level} — TaskFlow`;
    } else if (phase === "celebrate") {
      document.title = `🎉 Nível ${level} completo! — TaskFlow`;
    } else {
      document.title = "TaskFlow";
    }
    return () => { document.title = "TaskFlow"; };
  }, [phase, level]);

  // Space bar → pause/resume (only in timer mode)
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.target as HTMLElement).tagName === "INPUT" || (e.target as HTMLElement).tagName === "TEXTAREA") return;
      if (e.code === "Space" && phase === "work" && !rushMode && !tabMode && !timerDone) {
        e.preventDefault();
        if (timerRunning) {
          setTimerRunning(false);
        } else {
          const tSecs = (tasks[currentIdx]?.durationMin || 0) * 60;
          requestStart(timerRemaining === tSecs ? "start" : "resume");
        }
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [phase, rushMode, tabMode, timerDone, timerRunning, timerRemaining, tasks, currentIdx]);

  // Avisa ao fechar aba com sessão em andamento
  useEffect(() => {
    if (phase !== "work") return;
    const handler = (e: BeforeUnloadEvent) => { e.preventDefault(); e.returnValue = ""; };
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

  // Tick de 1s para exibir há quanto tempo a tarefa está pausada.
  const [pauseNow, setPauseNow] = useState<number>(() => Date.now());
  useEffect(() => {
    if (!pausedSince) return;
    setPauseNow(Date.now());
    const id = setInterval(() => setPauseNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, [pausedSince]);

  // Marca quando a sessão de módulos ativa foi iniciada a partir do Daily Focus,
  // para evitar reconfirmar "Trocar de sessão?" ao remontar/reiniciar a própria.
  const dfSessionActiveRef = useRef<boolean>(false);
  useEffect(() => {
    if (!hasActiveSession) dfSessionActiveRef.current = false;
  }, [hasActiveSession]);

  // Rush mode: stopwatch crescente (conta segundos enquanto running)
  useEffect(() => {
    if (!rushMode || phase !== "work") return;
    if (!timerRunning) return;
    const id = setInterval(() => setRushElapsed((s) => s + 1), 1000);
    return () => clearInterval(id);
  }, [rushMode, phase, timerRunning]);

  // Tab mode: stopwatch sempre correndo durante a sessão
  useEffect(() => {
    if (!tabMode || phase !== "work") return;
    const id = setInterval(() => setTabElapsed((s) => s + 1), 1000);
    return () => clearInterval(id);
  }, [tabMode, phase]);

  // Reseta stopwatch ao trocar de tarefa ou sair do rush
  useEffect(() => {
    setRushElapsed(0);
  }, [currentIdx, rushMode]);

  const currentTask = tasks[currentIdx] || {} as Task;
  const totalSecs = (currentTask.durationMin || 0) * 60;
  const activeHelperModeIds = currentTask.helperModeIds ?? [];

  // Inicia/retoma o timer e abre o checkpoint emocional (não bloqueia o timer).
  const requestStart = (moment: EmotionMoment): void => {
    setTimerRunning(true);
    setLongPause(false);
    // Cooldown: evita re-perguntar em micro-pausas.
    if (Date.now() - lastEmotionTsRef.current < EMOTION_COOLDOWN_MS) return;
    const pauseSecs = pausedSince ? Math.round((Date.now() - pausedSince) / 1000) : undefined;
    setEmotionPrompt({
      moment,
      ctx: {
        taskTitle: currentTask?.title,
        taskIndex: currentIdx,
        taskId: currentTask?.supabaseId ?? null,
        modeIds: currentTask?.helperModeIds ?? [],
        level,
        rushMode,
        tabMode,
        pauseSecs: moment === "resume" ? pauseSecs : undefined,
      },
    });
  };

  // ── Card persistente do Daily Focus ────────────────────────────────────────
  // Mantém o snapshot "live" sincronizado. Só existe em fases com timer; nas demais
  // (checkin/select/prepare/celebrate) o snapshot é limpo e o card some.
  const liveSnapRef = useRef<DailyFocusLive | null>(null);
  // Throttle: NÃO depende de `timerRemaining` (mudaria a cada 1s). O restante é gravado
  // ancorado em `anchorTs` — o card recalcula o tempo ao vivo a partir daí. Só reescreve
  // em mudanças de estado (fase, tarefa, pausar/continuar, modo). O ref garante que a
  // gravação capture o restante mais recente sem virar dependência.
  const timerRemainingRef = useRef<number | null>(timerRemaining);
  timerRemainingRef.current = timerRemaining;
  useEffect(() => {
    const hasTimer = phase === "work" || phase === "between";
    if (!hasTimer) {
      liveSnapRef.current = null;
      clearDailyFocusLive();
      return;
    }
    const noCountdown = rushMode || tabMode;
    const snap: DailyFocusLive = {
      taskTitle: currentTask?.title ?? "",
      phase,
      running: timerRunning,
      remainingSecs: noCountdown ? null : timerRemainingRef.current,
      anchorTs: Date.now(),
      totalSecs,
      rushMode,
      tabMode,
      cycleCount: tabCycleCount,
      nextTaskTitle: tasks[currentIdx + 1]?.title ?? "",
      taskIndex: currentIdx,
      taskCount: tasks.length,
    };
    liveSnapRef.current = snap;
    saveDailyFocusLive(snap);
  }, [phase, currentIdx, currentTask?.title, timerRunning, rushMode, tabMode, totalSecs, tabCycleCount, tasks]);

  // Auto-pausa ao sair da página (desmontagem por navegação): congela o restante e
  // marca como pausado. O usuário pode retomar pelo card, e aí segue rodando em background.
  useEffect(() => {
    return () => {
      const s = liveSnapRef.current;
      if (s && s.running) {
        const frozen = s.remainingSecs == null ? null : (liveRemaining(s) ?? 0);
        saveDailyFocusLive({ ...s, running: false, remainingSecs: frozen, anchorTs: Date.now() });
      }
    };
  }, []);

  // Reidratação cross-device: quando o useRemoteSync (ou um resync por visibilidade)
  // traz a sessão ativa de outro dispositivo — grava no localStorage + dispara
  // DAILY_FOCUS_LIVE_EVENT — aplica o estado remoto aqui. Dedupe por `anchorTs`
  // (não reaplica o mesmo snapshot); também detecta encerramento remoto (tombstone).
  const lastAppliedAnchorRef = useRef<number>(0);
  useEffect(() => {
    const onLive = (): void => {
      const live = loadDailyFocusLive();

      // Snapshot sumiu enquanto esta aba mostrava o timer → sessão encerrada em
      // outro dispositivo. Reseta suavemente para a tela inicial do fluxo.
      if (!live) {
        if (phase === "work" || phase === "between") {
          showToast("Sessão encerrada em outro dispositivo.");
          setTimerRunning(false);
          setTimerRemaining(null);
          setPhase("prepare");
        }
        return;
      }

      if (live.phase !== "work" && live.phase !== "between") return;
      // Já estamos numa sessão local em andamento com o mesmo snapshot — ignora.
      if (live.anchorTs === lastAppliedAnchorRef.current) return;
      // Sessão local já em curso nesta aba (mesma fase) — não sobrescreve edições locais.
      if ((phase === "work" || phase === "between") && live.anchorTs <= lastAppliedAnchorRef.current) return;

      let sess: any;
      try {
        const raw = localStorage.getItem("taskflow_sess_daily_focus");
        sess = raw ? JSON.parse(raw) : undefined;
      } catch { sess = undefined; }

      const wasIdle = phase !== "work" && phase !== "between";
      lastAppliedAnchorRef.current = live.anchorTs;

      if (sess) {
        if (sess.level != null) setLevel(sess.level);
        if (sess.tasks) setTasks(migrateTasks(sess.tasks));
        setCurrentIdx(sess.currentIdx ?? 0);
        setHelperStates(sess.helperStates ?? {});
        setTaskTimings(sess.taskTimings ?? []);
        setRushMode(sess.rushMode ?? false);
        setTabMode(sess.tabMode ?? false);
        setTabCycleCount(sess.tabCycleCount ?? 0);
        setTabElapsed(sess.tabElapsed ?? 0);
        setPendingNextIdx(sess.pendingNextIdx ?? null);
      }

      const rem = live.running && live.remainingSecs != null
        ? liveRemaining(live)
        : (live.remainingSecs ?? sess?.timerRemaining ?? null);
      setTimerRemaining(rem);
      setTimerRunning(!!live.running);
      setPhase(live.phase);

      // Só avisa quando a sessão "apareceu do nada" (estava ocioso).
      if (wasIdle) showToast("Retomando sua sessão de outro dispositivo.");
    };
    window.addEventListener(DAILY_FOCUS_LIVE_EVENT, onLive);
    return () => window.removeEventListener(DAILY_FOCUS_LIVE_EVENT, onLive);
  }, [phase, showToast]);

  // Resync da sessão ativa quando a aba volta a ficar visível ou a rede reconecta.
  // (o useRemoteSync só roda uma vez no login — isto cobre o device já aberto.)
  useEffect(() => {
    const onVisible = (): void => { if (document.visibilityState === "visible") void loadRemoteActiveSession(); };
    const onOnline = (): void => { void loadRemoteActiveSession(); };
    document.addEventListener("visibilitychange", onVisible);
    window.addEventListener("online", onOnline);
    return () => {
      document.removeEventListener("visibilitychange", onVisible);
      window.removeEventListener("online", onOnline);
    };
  }, []);

  // Flush imediato do estado em transições importantes (play/pause, troca de tarefa),
  // sem esperar o debounce — reduz a janela de perda ao trocar de device.
  useEffect(() => {
    if (phase === "work" || phase === "between") flushActiveSessionPush();
  }, [timerRunning, currentIdx]); // eslint-disable-line react-hooks/exhaustive-deps

  // Ao fechar a aba/app: envia o último estado com fetch keepalive (sobrevive ao pagehide).
  useEffect(() => {
    const onHide = (): void => { beaconActiveSessionNow(); };
    window.addEventListener("pagehide", onHide);
    return () => window.removeEventListener("pagehide", onHide);
  }, []);
  // Aba ativa = tab selecionada manualmente, ou o primeiro modo, ou null
  const activeTabModeId = useMemo(
    () =>
      activeHelperTab && activeHelperModeIds.includes(activeHelperTab)
        ? activeHelperTab
        : activeHelperModeIds[0] ?? null,
    [activeHelperTab, activeHelperModeIds]
  );
  const helperEntry = getHelper(activeTabModeId);
  const helperMode = getModeById(activeTabModeId);
  const currentHelperState = helperStates[`${currentIdx}:${activeTabModeId}`] || {};

  // ── helpers ──────────────────────────────────────────
  const updateTask = (i: number, val: Task): void =>
    setTasks((prev) => prev.map((t, idx) => (idx === i ? val : t)));

  const moveTask = (i: number, dir: number): void => {
    setTasks((prev) => {
      const arr = [...prev];
      const target = i + dir;
      if (target < 0 || target >= arr.length) return arr;
      [arr[i], arr[target]] = [arr[target], arr[i]];
      // Preserve durations (they're positional, not per-task)
      return arr.map((t, j) => ({ ...t, durationMin: (arr.length - j) * 15 }));
    });
  };

  const allFilled = useMemo(() => tasks.every((t) => t.title.trim()), [tasks]);

  const startSession = (): void => {
    if (!tabMode) {
      setTimerRemaining(tasks[0].durationMin * 60);
      setTaskStartRemaining(tasks[0].durationMin * 60);
    } else {
      setTimerRemaining(null);
      setTaskStartRemaining(null);
    }
    setCurrentIdx(0);
    setTimerRunning(false);
    setTimerDone(false);
    setTaskTimings([]);
    setTabCycleCount(0);
    setTabElapsed(0);
    setPhase("work");
    requestNotifPermission();
    // Pré-inicializa estados de helpers "durante" e "entre" da primeira tarefa
    (tasks[0].helperModeIds ?? []).forEach((id) => initHelperIfNeeded(id, 0));
    (tasks[0].interModeIds ?? []).forEach((id) => initHelperIfNeeded(id, 0));
    // Reseta acumulador e contagem de revisões
    workSecsRef.current = 0;
    setPaperCountdown(PAPER_REVIEW_INTERVAL);
    setShowPaperReview(false);
    setReviewCount(0);
    setRushElapsed(0);
  };

  const handleTaskChange = useCallback((i: number, val: Task) => updateTask(i, val), []);
  const handleTaskMoveUp = useCallback((i: number) => moveTask(i, -1), []);
  const handleTaskMoveDown = useCallback((i: number) => moveTask(i, 1), []);

  const handleDismissAchievement = useCallback(() => setNewAchievements([]), []);

  const handleCloseHistory = useCallback(() => setShowHistory(false), []);
  const handleCloseHelperPicker = useCallback(() => { setShowHelperPicker(false); setPickerForTask(null); }, []);

  const handleTimerTick = useCallback((remaining: number) => {
    setTimerRemaining(remaining);
    // Acumula segundos de trabalho real e dispara revisão a cada 15 min
    workSecsRef.current += 1;
    const secs = workSecsRef.current;
    setPaperCountdown(PAPER_REVIEW_INTERVAL - secs);
    if (secs >= PAPER_REVIEW_INTERVAL) {
      workSecsRef.current = 0;
      setPaperCountdown(PAPER_REVIEW_INTERVAL);
      setTimerRunning(false);
      setShowPaperReview(true);
      setCheckedReminders(new Set());
      setReviewCount((n) => n + 1);
      playPaperReview();
      sendNotif("📋 Hora de revisar!", "5 min para ler suas anotações e escolher o melhor.");
    }
  }, []);

  const handleTimerDone = useCallback(() => {
    setTimerRunning(false);
    setTimerDone(true);
    playTimerDone();
    sendNotif("⏰ Timer encerrado!", `Tarefa: ${tasks[currentIdx]?.title || ""}`);
  }, [tasks, currentIdx]);

  const handlePaperReviewDone = useCallback(() => {
    workSecsRef.current = 0;
    setPaperCountdown(PAPER_REVIEW_INTERVAL);
    setShowPaperReview(false);
    setCheckedReminders(new Set());
    setTimerRunning(true);
  }, []);

  // "Mais 5 min" — retoma o timer e dispara nova revisão em 5 min (sem zerar o intervalo base)
  const handlePaperSnooze = useCallback(() => {
    workSecsRef.current = PAPER_REVIEW_INTERVAL - 5 * 60; // faltam 5 min
    setPaperCountdown(5 * 60);
    setShowPaperReview(false);
    setCheckedReminders(new Set());
    setTimerRunning(true);
  }, []);

  const handleHelperChange = useCallback((newState: any) => {
    setHelperStates((prev) => {
      if (!activeTabModeId) return prev;
      const key = `${currentIdx}:${activeTabModeId}`;
      const resolved = typeof newState === "function" ? newState(prev[key] || {}) : newState;
      return { ...prev, [key]: resolved };
    });
  }, [activeTabModeId, currentIdx]);

  // Inicializa estado de um helper se ainda não existir para essa tarefa
  const initHelperIfNeeded = (modeId: string, taskIdx: number = currentIdx): void => {
    if (!modeId) return;
    const key = `${taskIdx}:${modeId}`;
    setHelperStates((prev) => {
      if (prev[key]) return prev;
      const entry = getHelper(modeId);
      return { ...prev, [key]: entry?.defaultState ?? {} };
    });
  };

  // Helper inline para atualizar estado de um modo específico em uma tarefa
  const makeHelperOnChange = (modeId: string, taskIdx: number) => (newState: any) => {
    setHelperStates((prev) => {
      const key = `${taskIdx}:${modeId}`;
      const resolved = typeof newState === "function" ? newState(prev[key] || {}) : newState;
      return { ...prev, [key]: resolved };
    });
  };

  // Reordena um modo (helperModeIds ou interModeIds) dentro da tarefa
  const handleReorderHelper = (field: "helperModeIds" | "interModeIds", modeId: string, dir: number, taskIdx: number = currentIdx): void => {
    setTasks((prev) => prev.map((t, i) => {
      if (i !== taskIdx) return t;
      const ids = [...(t[field] ?? [])];
      const from = ids.indexOf(modeId);
      const to = from + dir;
      if (to < 0 || to >= ids.length) return t;
      [ids[from], ids[to]] = [ids[to], ids[from]];
      return { ...t, [field]: ids };
    }));
  };

  const MAX_MODES = 3;

  // Adiciona um modo à tarefa (não substitui, empurra pro array — limite: MAX_MODES)
  const handleSelectHelper = (modeId: string): void => {
    const taskIdx = pickerForTask !== null ? pickerForTask : currentIdx;
    setTasks((prev) => prev.map((t, i) => {
      if (i !== taskIdx) return t;
      const ids = t.helperModeIds ?? [];
      if (ids.includes(modeId) || ids.length >= MAX_MODES) return t;
      return { ...t, helperModeIds: [...ids, modeId] };
    }));
    initHelperIfNeeded(modeId, taskIdx);
    setPickerForTask(null);
    setShowHelperPicker(false);
  };

  // Inicia a sessão de módulos montada em "Minha Sessão" (SlotBoard) direto da
  // área pausada. Reaproveita a MultiCardSession global (overlay minimizável).
  const handleStartInterSession = async (
    cards: any[],
    mode: "sequential" | "parallel",
  ): Promise<void> => {
    if (!cards || cards.length === 0) return;
    // Só confirma se houver uma sessão ativa que NÃO seja a que o próprio Daily
    // Focus iniciou (evita fricção ao remontar/reiniciar a mesma sessão).
    if (hasActiveSession && !dfSessionActiveRef.current) {
      const ok = await confirm({
        title: "Trocar de sessão?",
        message: "Você tem uma sessão em andamento. Iniciar esta vai encerrá-la sem registrar.",
        confirmLabel: "Trocar",
      });
      if (!ok) return;
    }
    activateMultiCard(cards, mode, currentTask?.title ?? "");
    dfSessionActiveRef.current = true;
  };

  // Remove um modo específico de uma tarefa
  const handleRemoveHelperById = (modeId: string, taskIdx: number): void => {
    setTasks((prev) => prev.map((t, i) => {
      if (i !== taskIdx) return t;
      return { ...t, helperModeIds: (t.helperModeIds ?? []).filter((id) => id !== modeId) };
    }));
    // Se a aba ativa foi removida, volta para null (vai pegar o primeiro)
    if (activeHelperTab === modeId) setActiveHelperTab(null);
  };

  const handleCompleteTask = (): void => {
    // Record timing feedback
    const usedSecs = totalSecs - (timerRemaining ?? totalSecs);
    const usedMin = Math.max(0, Math.round(usedSecs / 60));
    const isEarly = !rushMode && (timerRemaining ?? 0) > 0 && (timerRemaining ?? 0) < totalSecs;
    const newTimings: TaskTiming[] = [...taskTimings, { used: usedMin, total: currentTask.durationMin, early: isEarly }];
    setTaskTimings(newTimings);

    const updated = tasks.map((t, i) => (i === currentIdx ? { ...t, done: true } : t));
    setTasks(updated);

    playBeep(); // som de conclusão de tarefa

    // Checkpoint emocional de saída (moment "end") — associado à tarefa recém-concluída.
    // Ignora o cooldown de início/retomada: o fim de tarefa é sempre um bom momento de registro.
    setEmotionPrompt({
      moment: "end",
      ctx: {
        taskTitle: currentTask?.title,
        taskIndex: currentIdx,
        taskId: currentTask?.supabaseId ?? null,
        modeIds: currentTask?.helperModeIds ?? [],
        level,
        rushMode,
        tabMode,
        completed: true,
        usedSecs: Math.max(0, Math.round(usedSecs)),
        totalSecs,
      },
    });

    // Busca a próxima tarefa pendente (não concluída), priorizando a ordem natural
    // mas considerando que pode haver tarefas em espera fora de ordem sequencial
    const nextIdx = updated.findIndex((t, i) => i !== currentIdx && !t.done);

    if (nextIdx === -1) {
      // Todas as tarefas concluídas
      setTimerRunning(false);
      completeSession(updated, newTimings, isEarly);
    } else {
      setTimerRunning(false);
      setTimerDone(false);
      setLongPause(false);
      setPausedSince(null);
      // Se a tarefa concluída tem modos "entre tarefas", mostra tela de pausa
      // Reseta acumulador de trabalho ao trocar de tarefa
      workSecsRef.current = 0;
      setPaperCountdown(PAPER_REVIEW_INTERVAL);
      setShowPaperReview(false);

      const interIds = updated[currentIdx]?.interModeIds ?? [];
      if (interIds.length > 0) {
        interIds.forEach((id) => initHelperIfNeeded(id, currentIdx));
        setPendingNextIdx(nextIdx);
        setPhase("between");
      } else {
        const resumeSecs = updated[nextIdx].savedTimerSecs ?? updated[nextIdx].durationMin * 60;
        setCurrentIdx(nextIdx);
        setTimerRemaining(resumeSecs);
        setTaskStartRemaining(resumeSecs);
        setActiveHelperTab(null);
        // Se a próxima era "em espera", limpa o hold
        if (updated[nextIdx].onHold) {
          setTasks((prev) => prev.map((t, i) =>
            i === nextIdx ? { ...t, onHold: false, savedTimerSecs: null } : t
          ));
        }
        (updated[nextIdx].helperModeIds ?? []).forEach((id) => initHelperIfNeeded(id, nextIdx));
        (updated[nextIdx].interModeIds ?? []).forEach((id) => initHelperIfNeeded(id, nextIdx));
      }
    }
  };

  const handlePutOnHold = (): void => {
    setTimerRunning(false);
    setTasks((prev) => prev.map((t, i) =>
      i === currentIdx
        ? { ...t, onHold: true, savedTimerSecs: timerRemaining }
        : t
    ));
    setShowTaskSwitcher(true);
  };

  const handleSwitchToTask = (idx: number): void => {
    const target = tasks[idx];
    const resumeSecs = target.savedTimerSecs ?? target.durationMin * 60;
    setCurrentIdx(idx);
    setTimerRemaining(resumeSecs);
    setTaskStartRemaining(resumeSecs);
    setTasks((prev) => prev.map((t, i) =>
      i === idx ? { ...t, onHold: false, savedTimerSecs: null } : t
    ));
    setTimerDone(false);
    setTimerRunning(false);
    setLongPause(false);
    setPausedSince(null);
    setActiveHelperTab(null);
    (target.helperModeIds ?? []).forEach((id) => initHelperIfNeeded(id, idx));
    (target.interModeIds ?? []).forEach((id) => initHelperIfNeeded(id, idx));
    setShowTaskSwitcher(false);
  };

  const handleCancelSwitcher = (): void => {
    // Desfaz o hold na tarefa atual e fecha o seletor
    setTasks((prev) => prev.map((t, i) =>
      i === currentIdx ? { ...t, onHold: false, savedTimerSecs: null } : t
    ));
    setShowTaskSwitcher(false);
  };

  // ── Tab Mode handlers ────────────────────────────────────
  const handleNextTab = (): void => {
    const isLast = currentIdx === tasks.length - 1;
    const nextIdx = (currentIdx + 1) % tasks.length;
    if (isLast) {
      // Completou um ciclo completo (percorreu todas as abas)
      setTabCycleCount((prev) => prev + 1);
    }
    setCurrentIdx(nextIdx);
    setActiveHelperTab(null);
    (tasks[nextIdx].helperModeIds ?? []).forEach((id) => initHelperIfNeeded(id, nextIdx));
  };

  const handleSwitchTab = (idx: number): void => {
    if (idx === currentIdx) return;
    setCurrentIdx(idx);
    setActiveHelperTab(null);
    (tasks[idx].helperModeIds ?? []).forEach((id) => initHelperIfNeeded(id, idx));
  };

  const handleAddTabConfirm = (): void => {
    if (!newTabTitle.trim()) return;
    const newTask: Task = {
      title: newTabTitle.trim(),
      supabaseId: null,
      durationMin: 15,
      done: false,
      helperModeIds: [],
      interModeIds: [],
      onHold: false,
      savedTimerSecs: null,
    };
    setTasks((prev) => [...prev, newTask]);
    setNewTabTitle("");
    setShowAddTabForm(false);
  };

  const handleFinishTabSession = (): void => {
    completeSession(tasks, [], false);
  };

  const handleBetweenComplete = (): void => {
    const nextIdx = pendingNextIdx;
    setPendingNextIdx(null);
    setCurrentIdx(nextIdx!);
    const resumeSecs = tasks[nextIdx!].savedTimerSecs ?? tasks[nextIdx!].durationMin * 60;
    setTimerRemaining(resumeSecs);
    setTaskStartRemaining(resumeSecs);
    setActiveHelperTab(null);
    if (tasks[nextIdx!].onHold) {
      setTasks((prev) => prev.map((t, i) =>
        i === nextIdx ? { ...t, onHold: false, savedTimerSecs: null } : t
      ));
    }
    (tasks[nextIdx!].helperModeIds ?? []).forEach((id) => initHelperIfNeeded(id, nextIdx!));
    (tasks[nextIdx!].interModeIds ?? []).forEach((id) => initHelperIfNeeded(id, nextIdx!));
    // Reseta acumulador de trabalho ao retomar da fase between
    workSecsRef.current = 0;
    setPaperCountdown(PAPER_REVIEW_INTERVAL);
    setShowPaperReview(false);
    setPhase("work");
  };

  const completeSession = (completedTasks: Task[], timings: TaskTiming[], hadEarlyCompletion: boolean): void => {
    const isNewRecord = updateMaxLevel(level);
    updateMaxLevelByMode(level, rushMode);
    const isNewCycleRecord = tabMode ? updateMaxCycles(tabCycleCount) : false;
    setNewRecord(isNewRecord || isNewCycleRecord);
    if (isNewRecord || isNewCycleRecord) playNewRecord();

    // Save history
    addSession({
      date: todayStr(),
      completedAt: nowTimeStr(),
      level,
      tasks: completedTasks.map((t) => t.title),
      timings,
      rushMode,
      estadoId: checkinEstadoId ?? null,
      tabMode,
      cycleCount: tabMode ? tabCycleCount : undefined,
      tabsOpened: tabMode ? completedTasks.length : undefined,
    });

    // Check achievements
    const toUnlock: string[] = [];
    const totalSessions = getHistory().length; // already saved
    if (totalSessions === 1) toUnlock.push("first_session");
    if (totalSessions >= 5) toUnlock.push("five_sessions");
    if (totalSessions >= 10) toUnlock.push("ten_sessions");
    if (level >= 2) toUnlock.push("level_2");
    if (level >= 3) toUnlock.push("level_3");
    if (level >= 5) toUnlock.push("level_5");
    if (rushMode) toUnlock.push("rush_master");
    if (tabMode && tabCycleCount >= 3) toUnlock.push("cycle_master");
    if (completedTasks.some((t) => (t.helperModeIds ?? []).length > 0)) toUnlock.push("helper_user");
    if (hadEarlyCompletion || timings.some((t) => t.early)) toUnlock.push("early_bird");
    if (getEmotionCount() >= 10) toUnlock.push("emotion_aware");

    const newAch = tryUnlock(toUnlock);
    if (newAch.length) setNewAchievements(newAch);

    // Salva nível do dia e modos usados
    setDayLevel(level);
    const modesUsedThisSession = completedTasks
      .flatMap((t) => t.helperModeIds ?? [])
      .filter(Boolean);
    addUsedModes(modesUsedThisSession);
    setUsedModes(getUsedModes());

    // Sessão concluída → encerra a sessão ativa remota (não reidrata em outro device).
    endRemoteActiveSession();

    setPhase("celebrate");
  };

  const handleNextLevel = (): void => {
    const newLevel = level + 1;
    setLevel(newLevel);
    setTasks(makeTasks(newLevel));
    setCurrentIdx(0);
    setTimerRemaining(null);
    setTimerRunning(false);
    setTimerDone(false);
    setTaskTimings([]);
    setRushMode(false);
    setTabMode(false);
    setTabCycleCount(0);
    setTabElapsed(0);
    setCheckinModeId(null);
    setCheckinEstadoId(null);
    setSessionFeedback(null);
    setPendingNextIdx(null);
    setPhase("prepare");
    setLadderAnimating(true);
    setTimeout(() => setLadderAnimating(false), 500);
  };

  // Estados de baixa energia → modos "entre" têm prioridade; alta energia → "durante"
  const ESTADOS_BAIXA_ENERGIA = new Set(["cansado", "travado", "ansioso"]);

  const handleCheckinSelect = (modeId: string, estadoId?: string | null): void => {
    setCheckinModeId(modeId);
    setCheckinEstadoId(estadoId ?? null);
    logCheckinUsage(estadoId, modeId);

    const estado = ESTADOS_DEFAULT.find((e: any) => e.id === estadoId);
    const comboIds: string[] = (estado?.modeIds?.length > 0) ? estado.modeIds : (modeId ? [modeId] : []);

    // Separa combo em "durante" e "entre" com base no type do modo
    const allModesMap: Record<string, any> = Object.fromEntries(ALL_MODES.map((m: any) => [m.id, m]));
    const duranteIds = comboIds.filter((id) => (allModesMap[id]?.type ?? "durante") === "durante");
    const entreIds   = comboIds.filter((id) => (allModesMap[id]?.type ?? "durante") === "entre");

    const isBaixaEnergia = ESTADOS_BAIXA_ENERGIA.has(estadoId ?? "");

    setTasks((prev) => {
      // Só aplica se a primeira tarefa ainda não tiver modos configurados
      const task0 = prev[0];
      if ((task0?.helperModeIds ?? []).length > 0 || (task0?.interModeIds ?? []).length > 0) return prev;

      return prev.map((t, i) => {
        if (i !== 0) return t;
        if (isBaixaEnergia) {
          // Baixa energia: modos "entre" vão para interModeIds, "durante" para helperModeIds
          return { ...t, helperModeIds: duranteIds.slice(0, MAX_MODES), interModeIds: entreIds.slice(0, MAX_MODES) };
        } else {
          // Alta energia / bem: tudo "durante"
          return { ...t, helperModeIds: comboIds.slice(0, MAX_MODES) };
        }
      });
    });
    comboIds.forEach((id) => initHelperIfNeeded(id, 0));
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
    setPhase("prepare");
  };

  // ── Etapa de preparação → seleção do Daily Focus ──────────
  // Pré-preenche os slots do nível atual com as prioridades do dia (na ordem),
  // mantendo título + vínculo com a tarefa real (supabaseId).
  const handlePrepareContinue = (priorities: DayPriority[]): void => {
    setDayPriorities(priorities);
    if (priorities.length > 0) {
      setTasks((prev) => prev.map((t, i) => {
        const p = priorities[i];
        if (!p) return t;
        // Não sobrescreve um slot que o usuário já preencheu manualmente.
        if (t.title?.trim() || t.supabaseId) return t;
        return { ...t, title: p.title, supabaseId: p.id };
      }));
    }
    setPhase("select");
  };

  const handleReset = (): void => {
    if (!window.confirm("Resetar tudo? O nível voltará para 1.")) return;
    clearSaved();
    endRemoteActiveSession();
    setLevel(1);
    setTasks(makeTasks(1));
    setCurrentIdx(0);
    setHelperStates({});
    setTimerRemaining(null);
    setTimerRunning(false);
    setTimerDone(false);
    setTaskTimings([]);
    setRushMode(false);
    setTabMode(false);
    setTabCycleCount(0);
    setTabElapsed(0);
    setCheckinModeId(null);
    setCheckinEstadoId(null);
    setDayPriorities([]);
    setSessionFeedback(null);
    setPendingNextIdx(null);
    setPhase("checkin"); // volta para o check-in ao resetar
  };

  const shareSession = async (): Promise<void> => {
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

  const startEditTitle = (): void => {
    setEditTitle(currentTask.title);
    setEditingTitle(true);
  };

  const saveEditTitle = (): void => {
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
            const estadoInfo = ESTADOS_DEFAULT.find((e: any) => e.id === checkinEstadoId);
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
          {phase === "prepare" && (
            <button className={styles.iconBtn} onClick={() => setPhase("checkin")}>← Voltar</button>
          )}
          {phase === "select" && (
            <button className={styles.iconBtn} onClick={() => setPhase("prepare")}>← Voltar</button>
          )}
          {phase !== "select" && phase !== "prepare" && phase !== "checkin" && (
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
            onSkip={() => setPhase("prepare")}
          />
        )}

        {/* ── PREPARE PHASE (preparação e priorização do dia) ── */}
        {phase === "prepare" && (
          <PrepareDayScreen
            level={level}
            estadoId={checkinEstadoId}
            onContinue={handlePrepareContinue}
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

            {/* Fix #9: Meta semanal configurável (clique para alternar entre 3/5/7 dias) */}
            <div className={styles.weeklyMeta}>
              <span>Esta semana:</span>
              <span className={weeklyCount >= WEEKLY_GOAL ? styles.weeklyGoalReached : styles.weeklyMetaCount}>
                {weeklyCount}/{WEEKLY_GOAL} dias
              </span>
              {weeklyCount >= WEEKLY_GOAL && <span>✅ Meta atingida!</span>}
              <button
                onClick={cycleWeeklyGoal}
                title={`Meta atual: ${WEEKLY_GOAL} dias/semana. Clique para alternar.`}
                style={{ marginLeft: "auto", fontSize: "10px", color: "var(--text-muted)", background: "none", border: "none", cursor: "pointer", padding: "2px 4px" }}
              >
                meta: {WEEKLY_GOAL}d ⟳
              </button>
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
            {(maxLevelTimer > 0 || maxLevelRush > 0 || getMaxCycles() > 0) && (
              <div className={styles.typedRecordsRow}>
                {maxLevelTimer > 0 && <span className={styles.typedRecordBadge}>⏱️ Timer: Etapa {maxLevelTimer}</span>}
                {maxLevelRush > 0 && <span className={styles.typedRecordBadge}>🚀 Rush: Etapa {maxLevelRush}</span>}
                {getMaxCycles() > 0 && <span className={styles.typedRecordBadge}>🪟 Abas: {getMaxCycles()} ciclos</span>}
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
                ? "Qual será sua primeira tarefa do dia?"
                : `Escolha as ${tasks.length} tarefas mais importantes do dia.`}
              {" "}Timers: {tasks.map((t) => `${t.durationMin}min`).join(" → ")}.
            </div>

            {tasks.length === 1 && !recDismissed && (
              <div className={styles.selectRecommendation}>
                <button
                  className={styles.selectRecommendationClose}
                  onClick={dismissRec}
                  title="Não mostrar por 7 dias"
                  aria-label="Dispensar recomendação por 7 dias"
                >
                  ×
                </button>
                <span className={styles.selectRecommendationIcon} aria-hidden="true">🌱</span>
                <div className={styles.selectRecommendationBody}>
                  <div>
                    <strong>Sempre que possível, comece por uma tarefa de autodesenvolvimento.</strong>{" "}
                    Invista primeiro em algo que torne você melhor nas próximas tarefas — por exemplo,{" "}
                    {selfDevExample}.
                  </div>
                  <div className={styles.selectRecommendationCompound}>
                    📈 Melhorar <strong>1% por dia</strong> ≈ <strong>{COMPOUND_YEAR_FACTOR}×</strong> em um ano.
                  </div>
                  <div className={styles.selectRecommendationActions}>
                    <button
                      className={`${styles.selfDevChip} ${selfDevMarked ? styles.selfDevChipActive : ""}`}
                      onClick={toggleSelfDev}
                      aria-pressed={selfDevMarked}
                    >
                      {selfDevMarked ? "✓ Autodesenvolvimento" : "＋ É autodesenvolvimento"}
                    </button>
                    {selfDevStreak > 0 && (
                      <span className={styles.selfDevStreak} title="Dias seguidos começando por autodesenvolvimento">
                        🔥 {selfDevStreak} {selfDevStreak === 1 ? "dia" : "dias"} seguido{selfDevStreak === 1 ? "" : "s"}
                      </span>
                    )}
                  </div>
                </div>
              </div>
            )}

            {/* Modo de sessão toggle (Timer / Rush / Abas) */}
            <div className={styles.rushToggle}>
              <button
                className={`${styles.rushBtn} ${!rushMode && !tabMode ? styles.rushBtnActive : ""}`}
                onClick={() => { setRushMode(false); setTabMode(false); }}
              >
                ⏱️ Com timer
              </button>
              <button
                className={`${styles.rushBtn} ${rushMode ? styles.rushBtnActive : ""}`}
                onClick={() => { setRushMode(true); setTabMode(false); }}
              >
                🚀 Modo Rush
              </button>
              <button
                className={`${styles.rushBtn} ${tabMode ? styles.rushBtnActive : ""}`}
                onClick={() => { setTabMode(true); setRushMode(false); }}
              >
                🪟 Abas
              </button>
            </div>

            {/* Dica do modo Abas */}
            {tabMode && (
              <div className={styles.tabModeHint}>
                Sem timer — você alterna entre as tarefas como abas de navegador.
                Faz um pouco de cada e vai abrindo novas abas conforme avança.
              </div>
            )}

            {/* Task slots */}
            <div className={styles.taskSlots}>
              {tasks.map((slot, i) => (
                <TaskSlot
                  key={i}
                  slot={slot}
                  index={i}
                  level={level}
                  onChange={(val: Task) => handleTaskChange(i, val)}
                  onMoveUp={() => handleTaskMoveUp(i)}
                  onMoveDown={() => handleTaskMoveDown(i)}
                  canMoveUp={i > 0}
                  canMoveDown={i < tasks.length - 1}
                  allModes={ALL_MODES}
                  usedModes={usedModes}
                  suggestedModeId={checkinModeId ?? suggestedModeId}
                  hideDuration={tabMode}
                  todayPriorities={dayPriorities}
                />
              ))}
            </div>

            {/* Atividade contínua do dia (fora da sequência, sem timer) */}
            <div className={styles.contActField}>
              <label className={styles.contActFieldLabel}>
                🔄 Atividade contínua do dia <span className={styles.contActFieldHint}>(opcional — sem timer, para as pausas)</span>
                {contActStreak > 0 && (
                  <span className={styles.contActStreak} title="Dias seguidos com atividade contínua">
                    🔥 {contActStreak} {contActStreak === 1 ? "dia" : "dias"}
                  </span>
                )}
              </label>

              <ContinuousActivityPicker
                activity={continuousActivity}
                last={contActLast}
                completedToday={contActDoneToday}
                onSave={saveContinuousActivity}
                onClear={clearContinuousActivityUI}
              />
            </div>

            {/* Fix #7: estimativa total de tempo */}
            {!rushMode && !tabMode && (
              <div style={{ textAlign: "center", fontSize: "12px", color: "var(--text-muted)", marginBottom: "10px" }}>
                ⏱️ ~{tasks.reduce((s, t) => s + (t.durationMin || 0), 0)}min de foco no total
              </div>
            )}

            <button className={styles.startBtn} disabled={!allFilled} onClick={startSession}>
              {allFilled
                ? tabMode
                  ? "🪟 Começar no Modo Abas"
                  : rushMode
                    ? "🚀 Começar no Modo Rush"
                    : "▶ Começar sessão"
                : "Preencha todas as tarefas"}
            </button>
          </div>
        )}

        {/* ── WORK PHASE ── */}
        {phase === "work" && (
          <div className={styles.workLayout}>
            {/* Atividade contínua — chip flutuante minimizável (sem timer) */}
            {continuousActivity && (
              contActMinimized ? (
                <button
                  className={styles.contActChipMini}
                  onClick={() => setContActMinimizedPref(false)}
                  title={`Atividade contínua: ${continuousActivity.title}`}
                  aria-label={`Atividade contínua: ${continuousActivity.title}. Toque para expandir`}
                  aria-expanded={false}
                >
                  {continuousActivity.goalTarget != null && continuousActivity.goalTarget > 0 && (
                    <span
                      className={styles.contActChipMiniRing}
                      aria-hidden="true"
                      style={{
                        background: `conic-gradient(#38bdf8 ${Math.min(
                          100,
                          Math.round((continuousActivity.progress / continuousActivity.goalTarget) * 100)
                        )}%, transparent 0)`,
                        WebkitMask: "radial-gradient(farthest-side, transparent calc(100% - 3px), #000 calc(100% - 3px))",
                        mask: "radial-gradient(farthest-side, transparent calc(100% - 3px), #000 calc(100% - 3px))",
                      }}
                    />
                  )}
                  {continuousActivity.icon || "🔄"}
                  {continuousActivity.ticks > 0 && (
                    <span className={styles.contActChipMiniBadge}>{continuousActivity.ticks}</span>
                  )}
                </button>
              ) : (
                <div
                  className={styles.contActChip}
                  ref={contActChipRef}
                  role="group"
                  aria-label="Atividade contínua"
                  aria-live="polite"
                  onTouchStart={(e) => { contActTouchStartY.current = e.touches[0]?.clientY ?? null; }}
                  onTouchEnd={(e) => {
                    const start = contActTouchStartY.current;
                    contActTouchStartY.current = null;
                    if (start == null) return;
                    const dy = (e.changedTouches[0]?.clientY ?? start) - start;
                    if (dy > 40) setContActMinimizedPref(true); // swipe-down minimiza
                  }}
                >
                  <span className={styles.contActChipIcon}>{continuousActivity.icon || "🔄"}</span>
                  <div className={styles.contActChipBody}>
                    <span className={styles.contActChipLabel}>
                      Atividade contínua
                      {continuousActivity.ticks > 0 && <> · {continuousActivity.ticks}×</>}
                    </span>
                    <span className={styles.contActChipTitle}>{continuousActivity.title}</span>
                    {continuousActivity.goalTarget != null && (
                      <span className={styles.contActChipGoal}>
                        {continuousActivity.progress}/{continuousActivity.goalTarget} {continuousActivity.goalUnit}
                        <button className={styles.contActStepBtn} onClick={() => bumpContinuousProgress(-1)} title="−1">−</button>
                        <button className={styles.contActStepBtn} onClick={() => bumpContinuousProgress(1)} title="+1">+</button>
                      </span>
                    )}
                    {continuousActivity.goalTarget != null && continuousActivity.progress >= continuousActivity.goalTarget && (
                      <button
                        className={styles.contActGoalMet}
                        onClick={handleCompleteContinuousActivity}
                        title="Meta batida — concluir e escolher outra"
                      >
                        🎯 Meta batida — concluir?
                      </button>
                    )}
                  </div>
                  {continuousActivity.link && (
                    <>
                      <a
                        className={styles.contActChipOpen}
                        href={continuousActivity.link}
                        target="_blank"
                        rel="noopener noreferrer"
                        title="Abrir (conta como avanço)"
                        onClick={openContinuousActivity}
                      >
                        ↗
                      </a>
                      <button
                        className={styles.contActChipCopy}
                        onClick={() => copyContinuousLink(continuousActivity.link)}
                        title="Copiar link (abrir no celular)"
                      >
                        {contActCopied ? "✓" : "⧉"}
                      </button>
                    </>
                  )}
                  {!continuousActivity.link && (
                    <button
                      className={styles.contActChipOpen}
                      onClick={openContinuousActivity}
                      title="Marcar avanço"
                    >
                      +1
                    </button>
                  )}
                  <button
                    className={styles.contActChipComplete}
                    onClick={handleCompleteContinuousActivity}
                    title="Concluir e escolher outra atividade contínua"
                    aria-label="Concluir atividade contínua"
                  >
                    ✓
                  </button>
                  <button
                    className={styles.contActChipSwap}
                    onClick={() => setContActPicking(true)}
                    title="Trocar atividade contínua"
                    aria-label="Trocar atividade contínua"
                  >
                    ↻
                  </button>
                  <button
                    className={styles.contActChipMinimize}
                    onClick={() => setContActMinimizedPref(true)}
                    title="Minimizar"
                    aria-label="Minimizar atividade contínua"
                  >
                    –
                  </button>
                </div>
              )
            )}

            {/* Picker de atividade contínua durante a sessão (concluir/trocar) */}
            {(contActPicking || !continuousActivity) && (
              <div className={styles.contActPicker}>
                <div className={styles.contActPickerHeader}>
                  <span>🔄 {continuousActivity ? "Trocar atividade contínua" : "Escolher atividade contínua"}</span>
                  {contActPicking && (
                    <button
                      className={styles.contActPickerClose}
                      onClick={() => setContActPicking(false)}
                      title="Fechar"
                      aria-label="Fechar seletor"
                    >
                      ✕
                    </button>
                  )}
                </div>
                <ContinuousActivityPicker
                  activity={continuousActivity}
                  last={contActLast}
                  completedToday={contActDoneToday}
                  onSave={saveContinuousActivity}
                  onPick={pickContinuousActivity}
                  onClear={clearContinuousActivityUI}
                  afterPick={() => setContActPicking(false)}
                />
              </div>
            )}

            {/* Progress dots */}
            {tasks.length > 1 && (
              <ProgressDots total={tasks.length} current={currentIdx} done={currentIdx} />
            )}

            {/* Tab Mode Bar (substitui DailyTimer no tab mode) */}
            {tabMode && (
              <>
                <TabModeBar
                  tasks={tasks}
                  currentIdx={currentIdx}
                  onSwitch={handleSwitchTab}
                  onNextTab={handleNextTab}
                  onAddTab={() => setShowAddTabForm(true)}
                  cycleCount={tabCycleCount}
                  elapsedSecs={tabElapsed}
                />
                {showAddTabForm && (
                  <div className={styles.addTabForm}>
                    <input
                      className={styles.addTabInput}
                      placeholder="Nome da nova aba..."
                      value={newTabTitle}
                      onChange={(e) => setNewTabTitle(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") handleAddTabConfirm();
                        if (e.key === "Escape") { setShowAddTabForm(false); setNewTabTitle(""); }
                      }}
                      autoFocus
                    />
                    <div className={styles.addTabActions}>
                      <button className={styles.addTabConfirm} onClick={handleAddTabConfirm}>
                        + Abrir aba
                      </button>
                      <button className={styles.addTabCancel} onClick={() => { setShowAddTabForm(false); setNewTabTitle(""); }}>
                        Cancelar
                      </button>
                    </div>
                  </div>
                )}
              </>
            )}

            {/* Task card */}
            <div className={styles.taskCard}>
              <div className={styles.taskCardLabel}>
                {tabMode
                  ? `Aba ${currentIdx + 1} / ${tasks.length}`
                  : `Tarefa ${currentIdx + 1} / ${tasks.length}`}
                {rushMode && <span className={styles.rushBadge}>🚀 Rush</span>}
                {tabMode && <span className={styles.tabModeBadge}>🪟 Abas</span>}
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
              {!rushMode && !tabMode && <div className={styles.taskCardTime}>{currentTask.durationMin} min</div>}
            </div>

            {/* Timer (only in timer mode, not rush, not tab) */}
            {!rushMode && !tabMode && (
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

                {continuousActivity && !timerRunning && !timerDone && (
                  <div className={styles.contActPauseCta}>
                    <span className={styles.contActPauseCtaText}>
                      {checkinEstadoId && continuousActivity.title.toLowerCase().match(/estud|aprend|ler|curso|anki|idioma|livro|artigo/)
                        ? <>🌱 Seu 1% de hoje mora aqui: <strong>{continuousActivity.title}</strong></>
                        : <>Em pausa? Avance sua atividade contínua: <strong>{continuousActivity.title}</strong></>}
                      {continuousActivity.ticks > 0 && <span className={styles.contActPauseCtaCount}> · {continuousActivity.ticks}× hoje</span>}
                    </span>
                    {continuousActivity.link ? (
                      <a
                        className={styles.contActPauseCtaBtn}
                        href={continuousActivity.link}
                        target="_blank"
                        rel="noopener noreferrer"
                        onClick={openContinuousActivity}
                      >
                        {continuousActivity.icon || "🔄"} Abrir
                      </a>
                    ) : (
                      <button className={styles.contActPauseCtaBtn} onClick={openContinuousActivity}>
                        {continuousActivity.icon || "🔄"} +1 avanço
                      </button>
                    )}
                  </div>
                )}

                <div className={styles.timerBtns}>
                  <button
                    className={`${styles.timerBtn} ${styles.timerBtnPrimary}`}
                    onClick={() => {
                      if (timerRunning) {
                        setTimerRunning(false);
                        setLongPause(false);
                      } else {
                        requestStart(timerRemaining === totalSecs ? "start" : "resume");
                      }
                    }}
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

            {/* ── Widget "Papel, Caneta e Régua" ── */}
            {/* Suprimido em tarefas muito curtas (≤15 min) onde a revisão coincidiria com o fim do timer */}
            {currentTask.durationMin > 15 && (showPaperReview ? (
              /* Prompt de revisão expandido */
              <div className={styles.paperReview}>
                <div className={styles.paperReviewTitle}>✏️ Hora de revisar suas anotações!</div>
                <p className={styles.paperReviewDesc}>
                  Leia tudo que você anotou na folha e escolha os melhores para fazer agora. Vale 5 minutos.
                </p>
                <div className={styles.paperReviewReminders}>
                  <span className={styles.paperReminderLabel}>Lembretes fixos:</span>
                  {paperReminders.map((r) => (
                    <span
                      key={r}
                      className={`${styles.paperReminderChip} ${checkedReminders.has(r) ? styles.paperReminderChecked : ""}`}
                      onClick={() => setCheckedReminders((prev) => {
                        const next = new Set(prev);
                        next.has(r) ? next.delete(r) : next.add(r);
                        return next;
                      })}
                      role="checkbox"
                      aria-checked={checkedReminders.has(r)}
                      tabIndex={0}
                      onKeyDown={(e) => { if (e.key === " " || e.key === "Enter") e.currentTarget.click(); }}
                    >
                      {checkedReminders.has(r) ? "✓" : "•"} {r}
                    </span>
                  ))}
                </div>
                <div className={styles.paperReviewActions}>
                  <button className={styles.paperReviewBtn} onClick={handlePaperReviewDone}>
                    ✓ Revisei — continuar
                  </button>
                  <button className={styles.paperSnoozeBtn} onClick={handlePaperSnooze}>
                    ⏱ mais 5 min
                  </button>
                </div>
              </div>
            ) : (
              /* Widget compacto sempre visível */
              <div className={styles.paperWidget}>
                <div className={styles.paperWidgetHeader}>
                  <span className={styles.paperWidgetIcon}>📋</span>
                  <span className={styles.paperWidgetTitle}>Papel, caneta e régua na mesa?</span>
                  <span className={styles.paperWidgetCountdown}>
                    {rushMode
                      ? null
                      : timerRunning
                        ? `revisão em ${Math.floor(paperCountdown / 60)}:${String(paperCountdown % 60).padStart(2, "0")}`
                        : "pausado"}
                  </span>
                </div>
                <div className={styles.paperWidgetSub}>
                  Jogue todas as ideias nessa folha — a cada 15 min você revisa e escolhe o melhor.
                </div>
                <div className={styles.paperWidgetReminders}>
                  {paperReminders.map((r) => (
                    <span key={r} className={styles.paperReminderChip}>• {r}</span>
                  ))}
                  {/* Adicionar lembrete personalizado */}
                  <span className={styles.paperAddReminderWrap}>
                    <input
                      className={styles.paperAddReminderInput}
                      placeholder="+ lembrete"
                      value={newReminderText}
                      onChange={(e) => setNewReminderText(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter" && newReminderText.trim()) {
                          const updated = [...paperReminders, newReminderText.trim()];
                          setPaperReminders(updated);
                          savePaperReminders(updated);
                          setNewReminderText("");
                        }
                      }}
                      maxLength={40}
                    />
                  </span>
                  {/* Remover lembrete (×) ao passar o mouse — mostramos sempre no widget */}
                  {paperReminders.length > 0 && (
                    <button
                      className={styles.paperClearRemindersBtn}
                      title="Remover último lembrete"
                      onClick={() => {
                        const updated = paperReminders.slice(0, -1);
                        setPaperReminders(updated);
                        savePaperReminders(updated);
                      }}
                    >×</button>
                  )}
                </div>
              </div>
            ))}

            {/* Minha Sessão — aparece automaticamente quando o timer está pausado (ou em rush mode).
                Reaproveita o SlotBoard/MultiCardSession da página Modos para montar e iniciar
                uma sessão de módulos direto da experiência de foco. */}
            {(() => {
              const isPaused = !timerRunning && !timerDone && timerRemaining != null && timerRemaining < totalSecs;
              const isRushMode = rushMode;
              // Mostra o painel se: timer pausado OU rush mode (sem timer)
              const showInter = isPaused || isRushMode;
              if (!showInter) return null;
              // Há quanto tempo pausado (#6) e contexto da sugestão (#3)
              const pausedSecs = pausedSince ? Math.max(0, Math.floor((pauseNow - pausedSince) / 1000)) : 0;
              const pausedLabel = pausedSecs >= 60
                ? `pausado há ${Math.floor(pausedSecs / 60)} min`
                : pausedSecs > 0
                  ? `pausado há ${pausedSecs}s`
                  : null;
              const suggestContext = longPause ? "long-pause" as const : "short-pause" as const;
              return (
                <div className={styles.interPanel}>
                  <div className={styles.interPanelHeader}>
                    <span className={styles.interPanelIcon}>🧩</span>
                    <span className={styles.interPanelTitle}>
                      {rushMode ? "Entre tarefas — monte sua sessão" : "Pausado — monte sua sessão"}
                    </span>
                    {!rushMode && pausedLabel && (
                      <span className={styles.interPanelLongPause}>
                        {pausedLabel}
                      </span>
                    )}
                    {longPause && !timerDone && (
                      <span className={styles.interPanelLongPause}>
                        mais de 5 min
                      </span>
                    )}
                    {/* CTA para retomar a tarefa sem sair da pausa (#2) */}
                    {isPaused && (
                      <button
                        className={styles.interPanelResumeBtn}
                        onClick={() => requestStart("resume")}
                        title="Retomar a contagem da tarefa atual"
                      >
                        ▶ Retomar tarefa
                      </button>
                    )}
                  </div>
                  <div className={styles.interSlotBoardWrap}>
                    <SlotBoard
                      onStartSession={handleStartInterSession}
                      storageNamespace="daily-focus"
                      suggestContext={rushMode ? null : suggestContext}
                      title="Minha sessão"
                      subtitle="Monte os módulos para aproveitar a pausa e inicie quando quiser."
                    />
                  </div>
                </div>
              );
            })()}

            {/* Helper panel — cards lado a lado quando há 2+ modos */}
            {activeHelperModeIds.length > 0 && (
              activeHelperModeIds.length === 1 ? (
                /* Modo único: layout original */
                <div className={styles.helperPanel} style={{ borderTop: `3px solid ${helperMode?.color || "var(--accent)"}` }}>
                  {helperMode && (
                    <div className={styles.helperPanelHeader}>
                      <span className={styles.helperPanelEmoji}>{helperMode.emoji}</span>
                      <span className={styles.helperPanelName}>{helperMode.name}</span>
                      <span className={styles.helperPanelBadge}>modo de apoio</span>
                      <button
                        className={styles.helperPanelCollapseBtn}
                        onClick={() => toggleHelperCollapse(activeHelperModeIds[0])}
                        title={collapsedHelpers.has(activeHelperModeIds[0]) ? "Expandir" : "Recolher"}
                      >{collapsedHelpers.has(activeHelperModeIds[0]) ? "▼" : "▲"}</button>
                      <button
                        className={styles.helperPanelRemove}
                        onClick={() => handleRemoveHelperById(activeHelperModeIds[0], currentIdx)}
                        title="Remover modo"
                      >×</button>
                    </div>
                  )}
                  {!collapsedHelpers.has(activeHelperModeIds[0]) && helperEntry && helperMode && (
                    <helperEntry.Component
                      state={currentHelperState}
                      onChange={handleHelperChange}
                      modeConfig={helperMode}
                    />
                  )}
                </div>
              ) : (
                /* Múltiplos modos: grade lado a lado */
                <div className={styles.helperPanelGrid}>
                  {activeHelperModeIds.map((modeId, mIdx) => {
                    const m = getModeById(modeId);
                    const entry = getHelper(modeId);
                    if (!m || !entry) return null;
                    const isCollapsed = collapsedHelpers.has(modeId);
                    return (
                      <div key={modeId} className={styles.helperPanel} style={{ borderTop: `3px solid ${m.color || "var(--accent)"}` }}>
                        <div className={styles.helperPanelHeader}>
                          <span className={styles.helperPanelEmoji}>{m.emoji}</span>
                          <span className={styles.helperPanelName}>{m.name}</span>
                          <div className={styles.helperPanelActions}>
                            {activeHelperModeIds.length > 1 && (
                              <>
                                <button className={styles.helperPanelReorderBtn} disabled={mIdx === 0} onClick={() => handleReorderHelper("helperModeIds", modeId, -1)} title="Mover para esquerda">‹</button>
                                <button className={styles.helperPanelReorderBtn} disabled={mIdx === activeHelperModeIds.length - 1} onClick={() => handleReorderHelper("helperModeIds", modeId, 1)} title="Mover para direita">›</button>
                              </>
                            )}
                            <button className={styles.helperPanelCollapseBtn} onClick={() => toggleHelperCollapse(modeId)} title={isCollapsed ? "Expandir" : "Recolher"}>{isCollapsed ? "▼" : "▲"}</button>
                            <button className={styles.helperPanelRemove} onClick={() => handleRemoveHelperById(modeId, currentIdx)} title={`Remover ${m.name}`}>×</button>
                          </div>
                        </div>
                        {!isCollapsed && (
                          <entry.Component
                            state={helperStates[`${currentIdx}:${modeId}`] || {}}
                            onChange={makeHelperOnChange(modeId, currentIdx)}
                            modeConfig={m}
                          />
                        )}
                      </div>
                    );
                  })}
                </div>
              )
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

            {/* Seletor de troca de tarefa (em espera) */}
            {showTaskSwitcher && (
              <div className={styles.taskSwitcher}>
                <div className={styles.taskSwitcherTitle}>
                  ⏸ Tarefa em espera — qual você quer fazer agora?
                </div>
                <div className={styles.taskSwitcherList}>
                  {tasks.map((t, i) => {
                    if (i === currentIdx || t.done) return null;
                    const remainSecs = t.savedTimerSecs ?? t.durationMin * 60;
                    const remainMin = Math.ceil(remainSecs / 60);
                    return (
                      <button
                        key={i}
                        className={styles.taskSwitcherItem}
                        onClick={() => handleSwitchToTask(i)}
                      >
                        <span className={styles.taskSwitcherItemTitle}>{t.title || `Tarefa ${i + 1}`}</span>
                        <span className={styles.taskSwitcherItemMeta}>
                          {t.onHold && <span className={styles.holdBadge}>⏸ Em espera</span>}
                          {!rushMode && <span>{remainMin} min</span>}
                        </span>
                      </button>
                    );
                  })}
                </div>
                <button className={styles.taskSwitcherCancel} onClick={handleCancelSwitcher}>
                  Cancelar — continuar na tarefa atual
                </button>
              </div>
            )}

            {/* Actions */}
            <div className={styles.workActions}>
              {tabMode ? (
                // Tab mode: marcar aba como feita (opcional) + finalizar sessão
                <>
                  {!currentTask.done && (
                    <button className={styles.doneBtn} onClick={handleCompleteTask}>
                      ✅ Marcar aba como feita
                    </button>
                  )}
                  <button className={styles.finishTabBtn} onClick={handleFinishTabSession}>
                    🏁 Finalizar sessão
                  </button>
                </>
              ) : (
                // Timer / Rush mode: comportamento original
                <>
                  <button className={styles.doneBtn} onClick={handleCompleteTask}>
                    ✅ Concluí esta tarefa
                  </button>
                  {!showTaskSwitcher && tasks.length > 1 && tasks.some((t, i) => i !== currentIdx && !t.done) && (
                    <button className={styles.holdBtn} onClick={handlePutOnHold}>
                      ⏸ Colocar em espera
                    </button>
                  )}
                </>
              )}
              <button
                className={styles.changeHelperBtn}
                onClick={() => { setPickerForTask(null); setShowHelperPicker(true); }}
              >
                {activeHelperModeIds.length >= MAX_MODES
                  ? `✓ ${activeHelperModeIds.map((id) => getModeById(id)?.emoji ?? "").join("")} (máx. ${MAX_MODES})`
                  : activeHelperModeIds.length > 0
                    ? `+ Modo  ${activeHelperModeIds.map((id) => getModeById(id)?.emoji ?? "").join("")} (${activeHelperModeIds.length}/${MAX_MODES})`
                    : "🎯 Adicionar modo de apoio"}
              </button>
            </div>
          </div>
        )}

        {/* ── BETWEEN PHASE ── */}
        {phase === "between" && (() => {
          const completedTask = tasks[currentIdx] || {} as Task;
          const nextTask = pendingNextIdx != null ? tasks[pendingNextIdx] : null;
          return (
            <div className={styles.workLayout}>
              {/* Header da pausa */}
              <div style={{
                textAlign: "center",
                padding: "16px 0 8px",
              }}>
                <div style={{ fontSize: "28px", marginBottom: "6px" }}>☕</div>
                <div style={{ fontSize: "16px", fontWeight: 700, marginBottom: "4px" }}>
                  Pausa entre tarefas
                </div>
                <div style={{ fontSize: "12px", color: "var(--text-muted)" }}>
                  ✓ <em>{completedTask.title}</em> concluída
                  {nextTask && <> · Próxima: <em>{nextTask.title}</em></>}
                </div>
              </div>

              {/* Atividade contínua — aproveite a pausa */}
              {continuousActivity && (
                <div className={styles.contActPauseCta}>
                  <span className={styles.contActPauseCtaText}>
                    {continuousActivity.icon || "🔄"} Aproveite para avançar: <strong>{continuousActivity.title}</strong>
                    {continuousActivity.goalTarget != null
                      ? <span className={styles.contActPauseCtaCount}> · {continuousActivity.progress}/{continuousActivity.goalTarget} {continuousActivity.goalUnit}</span>
                      : continuousActivity.ticks > 0 && <span className={styles.contActPauseCtaCount}> · {continuousActivity.ticks}× hoje</span>}
                  </span>
                  {continuousActivity.link ? (
                    <a
                      className={styles.contActPauseCtaBtn}
                      href={continuousActivity.link}
                      target="_blank"
                      rel="noopener noreferrer"
                      onClick={openContinuousActivity}
                    >
                      Abrir ↗
                    </a>
                  ) : (
                    <button className={styles.contActPauseCtaBtn} onClick={openContinuousActivity}>
                      +1 avanço
                    </button>
                  )}
                </div>
              )}

              {/* Botão para avançar */}
              <div className={styles.workActions}>
                <button className={styles.doneBtn} onClick={handleBetweenComplete}>
                  ▶ Próxima tarefa {nextTask ? `— ${nextTask.title}` : ""}
                </button>
              </div>
            </div>
          );
        })()}

        {/* ── CELEBRATE PHASE ── */}
        {phase === "celebrate" && (
          <div className={styles.celebration}>
            <div className={styles.celebrationEmoji}>{newRecord ? "🏆" : tabMode ? "🪟" : "🎉"}</div>
            <div className={styles.celebrationTitle}>
              {tabMode
                ? newRecord
                  ? `🏆 Novo recorde! ${tabCycleCount} ciclos`
                  : `Sessão de Abas concluída!`
                : newRecord
                  ? `🏆 Novo recorde! Etapa ${level}`
                  : `Nível ${level} completo!`}
            </div>
            {newRecord && (
              <div className={styles.newRecordHighlight}>
                Você superou seu recorde anterior!
              </div>
            )}

            {/* Resumo da atividade contínua */}
            {continuousActivity && (continuousActivity.ticks > 0 || continuousActivity.progress > 0) && (
              <div className={styles.contActCelebrate}>
                {continuousActivity.icon || "🔄"} Você avançou <strong>{continuousActivity.title}</strong>{" "}
                {continuousActivity.goalTarget != null
                  ? <>{continuousActivity.progress}/{continuousActivity.goalTarget} {continuousActivity.goalUnit}</>
                  : <>{continuousActivity.ticks}× hoje</>}
                {" "}👏
              </div>
            )}
            {contActDoneToday.length > 0 && (
              <div className={styles.contActCelebrate}>
                ✓ Contínuas concluídas hoje: {contActDoneToday.map((c) => `${c.icon || "🔄"} ${c.title}`).join(" · ")}
              </div>
            )}

            {/* Métricas exclusivas do Tab Mode */}
            {tabMode && (
              <div className={styles.tabModeSummary}>
                <span className={styles.tabModeSummaryItem}>🔄 {tabCycleCount} ciclo{tabCycleCount !== 1 ? "s" : ""} completo{tabCycleCount !== 1 ? "s" : ""}</span>
                <span className={styles.tabModeSummaryItem}>🪟 {tasks.length} aba{tasks.length !== 1 ? "s" : ""}</span>
                <span className={styles.tabModeSummaryItem}>⏱ {(() => {
                  const h = Math.floor(tabElapsed / 3600);
                  const m = Math.floor((tabElapsed % 3600) / 60);
                  const s = tabElapsed % 60;
                  return h > 0
                    ? `${h}h${String(m).padStart(2, "0")}min`
                    : `${m}min${s > 0 ? ` ${s}s` : ""}`;
                })()}</span>
                {(() => {
                  const maxCycles = getMaxCycles();
                  return maxCycles > 0 && !newRecord ? (
                    <span className={styles.tabModeSummaryRecord}>Recorde: {maxCycles} ciclos</span>
                  ) : null;
                })()}
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

            {/* Resumo emocional do dia (checkpoints registrados) */}
            {(() => {
              const today = getTodayEmotions();
              if (today.length === 0) return null;
              const counts: Record<string, number> = {};
              for (const e of today) counts[e.emotion] = (counts[e.emotion] || 0) + 1;
              const parts = Object.entries(counts)
                .sort((a, b) => b[1] - a[1])
                .map(([id, n]) => {
                  const em = getEmotionById(id);
                  return `${em?.emoji ?? ""} ${em?.label ?? id}${n > 1 ? ` ×${n}` : ""}`;
                });
              return (
                <div className={styles.emotionSummary}>
                  <span className={styles.emotionSummaryLabel}>Hoje você registrou:</span>{" "}
                  {parts.join(" · ")}
                </div>
              );
            })()}

            {/* Aderência ao plano: prioridades do dia executadas nesta sessão */}
            {dayPriorities.length > 0 && (() => {
              const plannedIds = new Set(dayPriorities.map((p) => String(p.id)));
              const doneFromPlan = tasks.filter((t) => t.supabaseId && plannedIds.has(String(t.supabaseId)) && t.done).length;
              const pct = Math.round((doneFromPlan / dayPriorities.length) * 100);
              return (
                <div className={styles.adherenceBox}>
                  🎯 <strong>{doneFromPlan}/{dayPriorities.length}</strong> prioridades do dia concluídas nesta sessão ({pct}%)
                  {doneFromPlan === dayPriorities.length
                    ? " — plano do dia cumprido! 🙌"
                    : dayPriorities.length - doneFromPlan === 1
                      ? " — falta 1 para fechar o dia."
                      : ` — faltam ${dayPriorities.length - doneFromPlan}.`}
                </div>
              );
            })()}
            {checkinEstadoId && (() => {
              const e = ESTADOS_DEFAULT.find((est: any) => est.id === checkinEstadoId);
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
                        setShowAfterPicker(true);
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
                        setShowAfterPicker(true);
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

            {/* ── Estado emocional pós-sessão ── */}
            {showAfterPicker && !estadoAfterSelected && (
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
                <span>E agora, como você está?</span>
                <div style={{ display: "flex", flexWrap: "wrap", gap: "6px" }}>
                  {ESTADOS_DEFAULT.map((e) => (
                    <button
                      key={e.id}
                      onClick={() => {
                        setEstadoAfterSelected(e.id);
                        updateLastFeedbackEstadoAfter(e.id);
                      }}
                      title={e.label}
                      style={{
                        fontSize: "20px", padding: "4px 8px", borderRadius: "8px",
                        background: "var(--surface-2)", border: "1px solid var(--border)",
                        cursor: "pointer",
                      }}
                    >
                      {e.emoji}
                    </button>
                  ))}
                  <button
                    onClick={() => setShowAfterPicker(false)}
                    style={{
                      fontSize: "12px", color: "var(--text-muted)", padding: "4px 10px",
                      borderRadius: "8px", background: "none", border: "1px solid var(--border)",
                      cursor: "pointer", alignSelf: "center",
                    }}
                  >
                    Pular
                  </button>
                </div>
              </div>
            )}
            {estadoAfterSelected && (() => {
              const e = ESTADOS_DEFAULT.find((s) => s.id === estadoAfterSelected);
              return e ? (
                <div style={{ fontSize: "12px", color: "var(--text-muted)", marginTop: "8px" }}>
                  ✓ Estado registrado: {e.emoji} {e.label}
                </div>
              ) : null;
            })()}

            {/* Revisões de anotações */}
            {reviewCount > 0 && (
              <div style={{ fontSize: "13px", color: "var(--text-muted)", display: "flex", alignItems: "center", gap: "6px" }}>
                📋 {reviewCount} revisão{reviewCount > 1 ? "ões" : ""} de anotações
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
          currentIds={
            pickerForTask !== null
              ? (tasks[pickerForTask]?.helperModeIds ?? [])
              : activeHelperModeIds
          }
          customModes={customModes}
          usedModes={usedModes}
          suggestedModeId={suggestedModeId}
          filterType="durante"
          onSelect={handleSelectHelper}
          onClose={handleCloseHelperPicker}
        />
      )}

      {ConfirmUI}

      {emotionPrompt && (
        <EmotionCheckModal
          moment={emotionPrompt.moment}
          onSelect={(id, intensity) => {
            logEmotion({ emotion: id, moment: emotionPrompt.moment, intensity, ...emotionPrompt.ctx });
            lastEmotionTsRef.current = Date.now();
            setEmotionPrompt(null);
          }}
          onSkip={() => setEmotionPrompt(null)}
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
