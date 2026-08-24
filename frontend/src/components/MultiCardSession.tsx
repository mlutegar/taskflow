import { useState, useEffect, useRef, useCallback } from "react";
import { SESSION_MAP } from "./ModeSession";
import SpliteSession from "./sessions/SpliteSession";
import {
  clearActiveSession,
  updateActiveSessionIndex,
  logMultiCardSession,
} from "../lib/multiCardSessionLog";
import { logActivation } from "../lib/modeActivations";
import { logCompletion } from "../lib/modeLog";
import { logUsage } from "../lib/sessionUsageLog";
import styles from "./MultiCardSession.module.css";

interface ModeConfig {
  id: string;
  emoji: string;
  name: string;
  tagline: string;
  color: string;
  colorBg: string;
  session?: string;
  preset?: Record<string, unknown>;
  isCustom?: boolean;
  [key: string]: unknown;
}

interface MultiCardSessionProps {
  cards: ModeConfig[];
  startedAt: string;
  initialIndex?: number;
  intention?: string;
  tasks: any[];
  routines?: any[];
  onCompleteTask: (id: string) => Promise<void>;
  onCompleteRoutine?: (id: string) => Promise<void>;
  onAddTask: (task: { title: string; priority: number }) => Promise<void>;
  onAddChecklist?: (parentId: string, description: string) => Promise<void>;
  onToggleChecklist?: (parentId: string, itemId: string) => Promise<void>;
  onAddRoutineChecklist?: (parentId: string, description: string) => Promise<void>;
  onToggleRoutineChecklist?: (parentId: string, itemId: string) => Promise<void>;
  onClose: () => void;
}

type Phase = "session" | "between" | "end-confirm" | "post-form";

const AUTO_ADVANCE_KEY = "taskflow.autoAdvanceMinutes";
const AUTO_ADVANCE_OPTIONS = [
  { label: "Off", value: 0 },
  { label: "10min", value: 10 },
  { label: "25min", value: 25 },
  { label: "45min", value: 45 },
  { label: "60min", value: 60 },
];

function loadAutoAdvance(): number {
  try {
    return parseInt(localStorage.getItem(AUTO_ADVANCE_KEY) ?? "0", 10) || 0;
  } catch {
    return 0;
  }
}

function saveAutoAdvance(val: number): void {
  try {
    localStorage.setItem(AUTO_ADVANCE_KEY, String(val));
  } catch {}
}

function formatElapsed(totalSeconds: number): string {
  const h = Math.floor(totalSeconds / 3600);
  const m = Math.floor((totalSeconds % 3600) / 60);
  if (h > 0) return `${h}h ${m}min`;
  return `${m}min`;
}

export default function MultiCardSession({
  cards: initialCards,
  startedAt,
  initialIndex = 0,
  intention,
  tasks,
  routines = [],
  onCompleteTask,
  onCompleteRoutine,
  onAddTask,
  onAddChecklist,
  onToggleChecklist,
  onAddRoutineChecklist,
  onToggleRoutineChecklist,
  onClose,
}: MultiCardSessionProps): JSX.Element {
  const [cards, setCards] = useState<ModeConfig[]>(initialCards);
  const [currentIndex, setCurrentIndex] = useState<number>(initialIndex);
  const [phase, setPhase] = useState<Phase>("session");
  const [focusedMinutes, setFocusedMinutes] = useState<number>(0);
  const sessionStartRef = useRef<number>(performance.now());
  const globalStartRef = useRef<number>(Date.now());

  // #4 - Global elapsed timer
  const [elapsedSeconds, setElapsedSeconds] = useState<number>(0);
  useEffect(() => {
    const iv = setInterval(() => {
      setElapsedSeconds(Math.floor((Date.now() - globalStartRef.current) / 1000));
    }, 1000);
    return () => clearInterval(iv);
  }, []);

  // #6 - Auto-advance setting
  const [autoAdvanceMinutes, setAutoAdvanceMinutes] = useState<number>(loadAutoAdvance);
  const [showAutoSettings, setShowAutoSettings] = useState<boolean>(false);
  const [autoCountdownSeconds, setAutoCountdownSeconds] = useState<number>(0);
  const [autoWarning, setAutoWarning] = useState<boolean>(false);
  const autoIvRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // #13 - Over-3h banner
  const [longSessionBannerDismissed, setLongSessionBannerDismissed] = useState<boolean>(false);
  const showLongBanner =
    !longSessionBannerDismissed &&
    elapsedSeconds >= 180 * 60 &&
    phase === "session";

  const clearAutoInterval = () => {
    if (autoIvRef.current) {
      clearInterval(autoIvRef.current);
      autoIvRef.current = null;
    }
  };

  const startAutoAdvanceCountdown = useCallback((minutes: number) => {
    clearAutoInterval();
    if (minutes <= 0) return;
    let remaining = minutes * 60;
    setAutoCountdownSeconds(remaining);
    setAutoWarning(false);
    autoIvRef.current = setInterval(() => {
      remaining -= 1;
      setAutoCountdownSeconds(remaining);
      if (remaining <= 3 && remaining > 0) {
        setAutoWarning(true);
      }
      if (remaining <= 0) {
        clearAutoInterval();
        setAutoWarning(false);
      }
    }, 1000);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // handleCardClose declared early so it can be referenced in effects
  const handleCardClose = useCallback(() => {
    const elapsed = Math.max(1, Math.round((performance.now() - sessionStartRef.current) / 60000));
    setFocusedMinutes((prev) => prev + elapsed);
    sessionStartRef.current = performance.now();
    clearAutoInterval();
    setCards((currentCards) => {
      setCurrentIndex((idx) => {
        if (idx < currentCards.length - 1) {
          setPhase("between");
        } else {
          setPhase("post-form");
        }
        return idx;
      });
      return currentCards;
    });
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Auto-advance: trigger next card when countdown hits 0
  useEffect(() => {
    if (autoCountdownSeconds === 0 && autoAdvanceMinutes > 0 && phase === "session") {
      handleCardClose();
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autoCountdownSeconds]);

  // Start countdown when phase becomes "session" and autoAdvanceMinutes is set
  useEffect(() => {
    if (phase === "session" && autoAdvanceMinutes > 0) {
      startAutoAdvanceCountdown(autoAdvanceMinutes);
    } else {
      clearAutoInterval();
      setAutoCountdownSeconds(0);
      setAutoWarning(false);
    }
    return () => clearAutoInterval();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase, autoAdvanceMinutes]);

  // Log activation on card change
  useEffect(() => {
    const mode = cards[currentIndex];
    if (mode) logActivation(mode.id);
  }, [currentIndex]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    updateActiveSessionIndex(currentIndex);
  }, [currentIndex]);

  // #8 - Keyboard shortcuts
  useEffect(() => {
    if (phase !== "session") return;
    const handler = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement)?.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA") return;
      if (e.key === "ArrowRight" || e.key === "n" || e.key === "N") {
        if (currentIndex < cards.length - 1) handleCardClose();
      } else if (e.key === "ArrowLeft" || e.key === "p" || e.key === "P") {
        if (currentIndex > 0) {
          setCurrentIndex((prev) => prev - 1);
          setPhase("session");
          sessionStartRef.current = performance.now();
        }
      } else if (e.key === "Escape") {
        setPhase("end-confirm");
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase, currentIndex, cards.length]);

  const handleNextCard = (): void => {
    setCurrentIndex((prev) => prev + 1);
    setPhase("session");
    sessionStartRef.current = performance.now();
  };

  const handleEndSession = (): void => {
    setPhase("end-confirm");
  };

  const handleConfirmEnd = (): void => {
    const elapsed = Math.max(0, Math.round((performance.now() - sessionStartRef.current) / 60000));
    setFocusedMinutes((prev) => prev + elapsed);
    setPhase("post-form");
  };

  const handlePostDone = (): void => {
    clearActiveSession();
    cards.forEach((c) => logCompletion(c.id));
    onClose();
  };

  // #14 - Reorder cards callback
  const handleReorderCards = (newCards: ModeConfig[]): void => {
    setCards(newCards);
  };

  const currentMode = cards[currentIndex];
  const sessionKey = currentMode?.session || currentMode?.id || "";
  const SessionComponent: React.ComponentType<any> =
    SESSION_MAP[sessionKey] ?? SpliteSession;
  const preset = currentMode?.preset;

  // ── Between cards ─────────────────────────────────────────────────────────
  if (phase === "between") {
    const nextMode = cards[currentIndex + 1];
    const remainingCards = cards.slice(currentIndex + 1);
    return (
      <div className={styles.overlay}>
        <div className={styles.nextCardPrompt}>
          <span className={styles.nextCardEmoji}>{nextMode?.emoji}</span>
          <span className={styles.nextCardTitle}>Próximo: {nextMode?.name}</span>
          <span className={styles.nextCardSub}>{nextMode?.tagline}</span>
          <button className={styles.nextCardBtn} onClick={handleNextCard}>
            Começar
          </button>
          <button className={styles.skipBtn} onClick={() => setPhase("post-form")}>
            Encerrar sessão
          </button>

          {/* #14 - Draggable reorder list */}
          {remainingCards.length > 1 && (
            <div className={styles.reorderSection}>
              <span className={styles.reorderTitle}>Reordenar próximos cards</span>
              <DraggableCardList
                cards={remainingCards}
                onReorder={(reordered) => {
                  const newCards = [
                    ...cards.slice(0, currentIndex + 1),
                    ...reordered,
                  ];
                  handleReorderCards(newCards);
                }}
              />
            </div>
          )}
        </div>
      </div>
    );
  }

  // ── End confirm ───────────────────────────────────────────────────────────
  if (phase === "end-confirm") {
    return (
      <div className={styles.overlay}>
        <div className={styles.endConfirm}>
          <span className={styles.nextCardEmoji}>⏸</span>
          <span className={styles.endConfirmTitle}>Encerrar sessão?</span>
          <span className={styles.endConfirmSub}>
            Você está no card {currentIndex + 1} de {cards.length}.
            Os dados serão registrados.
          </span>
          <div className={styles.endConfirmBtns}>
            <button className={styles.endConfirmFinish} onClick={handleConfirmEnd}>
              📝 Registrar e sair
            </button>
            <button
              className={styles.endConfirmContinue}
              onClick={() => {
                setPhase("session");
                sessionStartRef.current = performance.now();
              }}
            >
              Continuar sessão
            </button>
          </div>
        </div>
      </div>
    );
  }

  // ── Post-session form ─────────────────────────────────────────────────────
  if (phase === "post-form") {
    const endedAt = new Date().toISOString();
    const started = new Date(startedAt);
    const durationMinutes = Math.max(1, Math.round((new Date().getTime() - started.getTime()) / 60000));
    const suggested = Math.min(focusedMinutes || durationMinutes, durationMinutes);
    return (
      <div className={styles.overlay}>
        <div className={styles.sessionContainer}>
          <MultiCardPostForm
            cards={cards}
            startedAt={startedAt}
            endedAt={endedAt}
            durationMinutes={durationMinutes}
            suggestedFocusedMinutes={suggested}
            intention={intention}
            onDone={handlePostDone}
          />
        </div>
      </div>
    );
  }

  // ── Active session ────────────────────────────────────────────────────────
  return (
    <div className={styles.overlay}>
      {/* Progress bar */}
      <div className={styles.progressBar}>
        <div className={styles.progressRow}>
          <span className={styles.progressLabel}>
            {currentIndex + 1} / {cards.length}
          </span>

          {/* #4 - Global elapsed timer */}
          <span className={styles.elapsedTimer}>
            {formatElapsed(elapsedSeconds)}
          </span>

          <div className={styles.progressDots}>
            {cards.map((_, i) => (
              <div
                key={i}
                className={`${styles.dot} ${i < currentIndex ? styles.done : ""} ${i === currentIndex ? styles.active : ""}`}
              />
            ))}
          </div>

          {/* #6 - Auto-advance chip + settings */}
          <div className={styles.autoAdvanceWrap}>
            {autoAdvanceMinutes > 0 && autoCountdownSeconds > 0 && (
              <span className={`${styles.autoChip} ${autoWarning ? styles.autoChipWarn : ""}`}>
                ⏱ {autoCountdownSeconds < 60
                  ? `${autoCountdownSeconds}s`
                  : `${Math.ceil(autoCountdownSeconds / 60)}min`}
              </span>
            )}
            <div className={styles.autoSettingsWrap}>
              <button
                className={styles.autoSettingsBtn}
                onClick={() => setShowAutoSettings((v) => !v)}
                title="Avanço automático"
              >
                ⚙️
              </button>
              {showAutoSettings && (
                <div className={styles.autoDropdown}>
                  <span className={styles.autoDropdownTitle}>Avanço automático</span>
                  {AUTO_ADVANCE_OPTIONS.map((opt) => (
                    <button
                      key={opt.value}
                      className={`${styles.autoDropdownItem} ${autoAdvanceMinutes === opt.value ? styles.autoDropdownItemActive : ""}`}
                      onClick={() => {
                        setAutoAdvanceMinutes(opt.value);
                        saveAutoAdvance(opt.value);
                        setShowAutoSettings(false);
                      }}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>

          <button className={styles.endBtn} onClick={handleEndSession}>
            Encerrar
          </button>
        </div>

        {/* #8 - Keyboard hints */}
        <div className={styles.keyboardHint}>
          → próximo · ← anterior · Esc sair
        </div>
      </div>

      {/* #13 - Long session banner */}
      {showLongBanner && (
        <div className={styles.longSessionBanner}>
          <span>⏰ Você está em sessão há 3h+ — considere uma pausa</span>
          <div className={styles.longSessionBannerActions}>
            <button
              className={styles.longSessionPauseBtn}
              onClick={() => {
                setLongSessionBannerDismissed(true);
                const napCard: ModeConfig = {
                  id: "nap",
                  emoji: "😴",
                  name: "Pausa rápida",
                  tagline: "Descanse um pouco",
                  color: "#4ecca3",
                  colorBg: "rgba(78,204,163,0.1)",
                  session: "NapSession",
                };
                setCards((prev) => {
                  const inserted = [
                    ...prev.slice(0, currentIndex + 1),
                    napCard,
                    ...prev.slice(currentIndex + 1),
                  ];
                  return inserted;
                });
                handleCardClose();
              }}
            >
              Pausar agora
            </button>
            <button
              className={styles.longSessionDismiss}
              onClick={() => setLongSessionBannerDismissed(true)}
            >
              ×
            </button>
          </div>
        </div>
      )}

      {/* Current card info */}
      <div className={styles.cardInfo}>
        <span className={styles.cardEmoji}>{currentMode?.emoji}</span>
        <span className={styles.cardName}>{currentMode?.name}</span>
        <span className={styles.cardIndex}>
          Card {currentIndex + 1} de {cards.length}
        </span>
      </div>

      {/* Intention reminder */}
      {intention && (
        <div style={{
          fontSize: 12, color: "var(--text-muted)", fontStyle: "italic",
          padding: "6px 16px", background: "var(--surface-2)",
          borderBottom: "1px solid var(--border)",
          display: "flex", alignItems: "center", gap: 6,
        }}>
          <span>🎯</span><span>{intention}</span>
        </div>
      )}

      {/* #6 - Auto-advance warning */}
      {autoWarning && (
        <div className={styles.autoWarningBanner}>
          ⚡ Avançando para o próximo card em {autoCountdownSeconds}s…
        </div>
      )}

      {/* Session component */}
      <div className={styles.sessionContainer}>
        <SessionComponent
          key={`card-${currentIndex}`}
          mode={currentMode}
          preset={preset}
          tasks={tasks}
          routines={routines}
          onCompleteTask={onCompleteTask}
          onCompleteRoutine={onCompleteRoutine}
          onAddTask={onAddTask}
          onAddChecklist={onAddChecklist}
          onToggleChecklist={onToggleChecklist}
          onAddRoutineChecklist={onAddRoutineChecklist}
          onToggleRoutineChecklist={onToggleRoutineChecklist}
          onClose={handleCardClose}
          onDone={handleCardClose}
          onComplete={handleCardClose}
        />
      </div>
    </div>
  );
}

// ── DraggableCardList (#14) ────────────────────────────────────────────────

interface DraggableCardListProps {
  cards: ModeConfig[];
  onReorder: (newOrder: ModeConfig[]) => void;
}

function DraggableCardList({ cards, onReorder }: DraggableCardListProps): JSX.Element {
  const [items, setItems] = useState<ModeConfig[]>(cards);
  const dragIndex = useRef<number | null>(null);

  useEffect(() => {
    setItems(cards);
  }, [cards]);

  const handleDragStart = (i: number) => {
    dragIndex.current = i;
  };

  const handleDragOver = (e: React.DragEvent, i: number) => {
    e.preventDefault();
    if (dragIndex.current === null || dragIndex.current === i) return;
    const newItems = [...items];
    const [moved] = newItems.splice(dragIndex.current, 1);
    newItems.splice(i, 0, moved);
    dragIndex.current = i;
    setItems(newItems);
  };

  const handleDrop = () => {
    onReorder(items);
    dragIndex.current = null;
  };

  return (
    <div className={styles.draggableList}>
      {items.map((card, i) => (
        <div
          key={card.id + i}
          className={styles.draggableItem}
          draggable
          onDragStart={() => handleDragStart(i)}
          onDragOver={(e) => handleDragOver(e, i)}
          onDrop={handleDrop}
        >
          <span className={styles.draggableHandle}>⠿</span>
          <span>{card.emoji}</span>
          <span className={styles.draggableLabel}>{card.name}</span>
        </div>
      ))}
    </div>
  );
}

// ── MultiCardPostForm ─────────────────────────────────────────────────────

const IDLE_REASONS: { id: string; label: string }[] = [
  { id: "distraction",  label: "📱 Distração" },
  { id: "another_task", label: "📋 Outra tarefa" },
  { id: "planned",      label: "☕ Pausa planejada" },
  { id: "tiredness",    label: "😴 Cansaço" },
  { id: "none",         label: "✅ Não fiquei ocioso" },
];

const FEELINGS: { id: string; label: string }[] = [
  { id: "flow",       label: "⚡ No flow" },
  { id: "thinking",   label: "💭 Pensando" },
  { id: "tired",      label: "😓 Cansado" },
  { id: "sleepy",     label: "😴 Com sono" },
  { id: "anxious",    label: "😬 Ansioso" },
  { id: "good",       label: "😊 Bem" },
  { id: "distracted", label: "🌀 Distraído" },
];

interface MultiCardPostFormProps {
  cards: ModeConfig[];
  startedAt: string;
  endedAt: string;
  durationMinutes: number;
  suggestedFocusedMinutes: number;
  intention?: string;
  onDone: () => void;
}

function Chip({ label, selected, onClick }: { label: string; selected: boolean; onClick: () => void }): JSX.Element {
  return (
    <button
      type="button"
      style={{
        padding: "6px 11px",
        borderRadius: "20px",
        border: `1.5px solid ${selected ? "var(--accent, #7c6ef5)" : "var(--border, rgba(255,255,255,0.08))"}`,
        background: selected ? "rgba(124,110,245,0.12)" : "var(--surface-2, rgba(255,255,255,0.04))",
        color: selected ? "var(--accent, #7c6ef5)" : "var(--text-muted, #9aa0b2)",
        fontSize: "12px",
        fontWeight: selected ? "600" : "500",
        cursor: "pointer",
        fontFamily: "inherit",
        transition: "all 0.14s",
        lineHeight: "1",
        whiteSpace: "nowrap",
      }}
      onClick={onClick}
    >
      {label}
    </button>
  );
}

function MultiCardPostForm({
  cards,
  startedAt,
  endedAt,
  durationMinutes,
  suggestedFocusedMinutes,
  intention,
  onDone,
}: MultiCardPostFormProps): JSX.Element {
  const [worked, setWorked] = useState<boolean | null>(null);
  const [focusedMinutes, setFocusedMinutes] = useState<number>(suggestedFocusedMinutes);
  const idleMinutes = 0;
  const [idleReason, setIdleReason] = useState<string[]>([]);
  const [feelings, setFeelings] = useState<string[]>([]);
  // #11 - Per-card ratings
  const [cardRatings, setCardRatings] = useState<Record<string, boolean>>({});
  const [note, setNote] = useState<string>("");
  const [phase, setPhase] = useState<"form" | "saved">("form");
  const [efficiencyResult, setEfficiencyResult] = useState<{ efficiencyPct: number | null; focusedMinutes: number; worked: boolean } | null>(null);
  const ivRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const toggleArr = (setArr: React.Dispatch<React.SetStateAction<string[]>>, id: string): void => {
    setArr((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  };

  const handleSubmit = (): void => {
    logMultiCardSession({
      cards: cards.map((c) => c.id),
      startedAt,
      endedAt,
      durationMinutes,
      focusedMinutes,
      idleMinutes,
      idleReason,
      feelings,
      worked: worked ?? false,
      cardRatings,
    });
    // Registra logUsage para cada card com os dados de eficiência da sessão combo
    cards.forEach((card, idx) => {
      const partner = cards.find((_, i) => i !== idx);
      logUsage({
        modeId:           card.id,
        worked:           worked ?? false,
        focusedMinutes,
        idleMinutes:      idleMinutes ?? 0,
        idleReason,
        feeling:          feelings,
        comboWith:        partner?.id,
        sessionStartedAt: startedAt,
        sessionEndedAt:   endedAt,
        note:             note.trim() || undefined,
        intention:        intention || undefined,
      });
    });

    // Eficiência para exibir no card
    const efficiencyPct = durationMinutes > 0 && focusedMinutes > 0
      ? Math.min(100, Math.round((focusedMinutes / durationMinutes) * 100))
      : null;
    setEfficiencyResult({ efficiencyPct, focusedMinutes, worked: worked ?? false });
    setPhase("saved");
    setTimeout(onDone, 3200);
  };

  useEffect(() => () => clearInterval(ivRef.current!), []);

  const fieldLabelStyle: React.CSSProperties = {
    fontSize: "12px",
    fontWeight: "600",
    color: "var(--text, #e8eaf0)",
    textTransform: "uppercase",
    letterSpacing: "0.04em",
  };

  const sectionStyle: React.CSSProperties = {
    display: "flex",
    flexDirection: "column",
    gap: "8px",
  };

  const chipsStyle: React.CSSProperties = {
    display: "flex",
    flexWrap: "wrap",
    gap: "6px",
  };

  if (phase === "saved") {
    const eff = efficiencyResult;
    const effLevel = eff?.efficiencyPct != null
      ? eff.efficiencyPct >= 70 ? "high" : eff.efficiencyPct >= 40 ? "mid" : "low"
      : null;
    const effColor  = effLevel === "high" ? "#4caf82" : effLevel === "mid" ? "#f5c542" : "#e05c5c";
    const badgeBg   = effLevel === "high" ? "rgba(76,175,130,0.15)" : effLevel === "mid" ? "rgba(245,197,66,0.13)" : "rgba(224,92,92,0.12)";
    const badgeBdr  = effLevel === "high" ? "rgba(76,175,130,0.35)" : effLevel === "mid" ? "rgba(245,197,66,0.32)" : "rgba(224,92,92,0.28)";
    const badgeText = effLevel === "high" ? "🔥 Sessão muito eficiente!" : effLevel === "mid" ? "👍 Sessão razoável" : "💡 Pode melhorar";

    const metricStyle: React.CSSProperties = {
      display: "flex", flexDirection: "column", alignItems: "center", gap: "5px",
      background: "var(--surface-2)", border: "1px solid var(--border)",
      borderRadius: "8px", padding: "12px 6px", flex: 1,
    };
    const valueStyle: React.CSSProperties = {
      fontSize: "24px", fontWeight: 800, color: "var(--text)", lineHeight: 1,
    };
    const labelStyle: React.CSSProperties = {
      fontSize: "10px", color: "var(--text-muted)", fontWeight: 500, whiteSpace: "nowrap",
    };

    return (
      <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: "18px", padding: "32px 20px 28px", textAlign: "center" }}>
        <span style={{ fontSize: "38px", lineHeight: 1, animation: "popIn 0.35s cubic-bezier(0.34,1.56,0.64,1) both" }}>
          {eff?.worked ? "✅" : "📝"}
        </span>
        <div style={{ fontSize: "14px", fontWeight: 700, color: "var(--text)", opacity: 0.85 }}>
          {cards.map((c) => c.emoji).join(" + ")} — registrado!
        </div>

        <div style={{ display: "flex", gap: "10px", width: "100%" }}>
          <div style={metricStyle}>
            <span style={valueStyle}>{durationMinutes}</span>
            <span style={labelStyle}>🕐 min total</span>
          </div>
          <div style={metricStyle}>
            <span style={valueStyle}>{eff?.focusedMinutes ?? 0}</span>
            <span style={labelStyle}>⚡ min focado</span>
          </div>
          <div style={metricStyle}>
            {effLevel ? (
              <>
                <span style={{ ...valueStyle, color: effColor }}>{eff?.efficiencyPct}%</span>
                <span style={labelStyle}>🎯 eficiência</span>
              </>
            ) : (
              <>
                <span style={{ ...valueStyle, color: "var(--text-muted)" }}>—</span>
                <span style={labelStyle}>🎯 eficiência</span>
              </>
            )}
          </div>
        </div>

        {effLevel && (
          <div style={{ fontSize: "13px", fontWeight: 700, padding: "7px 18px", borderRadius: "20px", background: badgeBg, border: `1px solid ${badgeBdr}`, color: effColor }}>
            {badgeText}
          </div>
        )}
      </div>
    );
  }

  const h = Math.floor(durationMinutes / 60);
  const m = durationMinutes % 60;
  const durationStr = h > 0 ? `${h}h ${m}min` : `${m}min`;

  return (
    <div style={{ display: "flex", flexDirection: "column" }}>
      {/* Header */}
      <div style={{
        display: "flex", alignItems: "center", gap: "10px",
        padding: "12px 16px", borderBottom: "1px solid var(--border)",
        background: "var(--surface)", position: "sticky", top: 0, zIndex: 1,
      }}>
        <span style={{ fontSize: "18px" }}>📝</span>
        <div style={{ flex: 1, minWidth: 0 }}>
          <span style={{ fontSize: "13px", fontWeight: "700", color: "var(--text)", display: "block" }}>
            Registrar sessão
          </span>
          <span style={{ fontSize: "11px", color: "var(--text-muted)", display: "block" }}>
            {cards.length} modo{cards.length !== 1 ? "s" : ""} · {durationStr} total
          </span>
        </div>
        <button
          onClick={onDone}
          style={{ background: "none", border: "none", color: "var(--text-muted)", fontSize: "12px", cursor: "pointer", padding: "5px 9px", borderRadius: "6px", fontFamily: "inherit" }}
        >
          Pular
        </button>
      </div>

      {/* Body */}
      <div style={{ padding: "14px 16px", display: "flex", flexDirection: "column", gap: "16px" }}>

        {/* #11 - Per-card ratings */}
        <div style={sectionStyle}>
          <span style={fieldLabelStyle}>Avaliação por card</span>
          <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
            {cards.map((c) => (
              <div key={c.id} style={{
                display: "flex", alignItems: "center", gap: "8px",
                padding: "8px 10px", borderRadius: "8px",
                background: "var(--surface-2, rgba(255,255,255,0.04))",
                border: "1px solid var(--border, rgba(255,255,255,0.07))",
              }}>
                <span style={{ fontSize: "16px" }}>{c.emoji}</span>
                <span style={{ flex: 1, fontSize: "12px", fontWeight: "600", color: "var(--text, #e8eaf0)" }}>{c.name}</span>
                {[
                  { val: true, label: "✅" },
                  { val: false, label: "❌" },
                ].map(({ val, label }) => (
                  <button
                    key={String(val)}
                    type="button"
                    onClick={() => setCardRatings((prev) => ({ ...prev, [c.id]: val }))}
                    style={{
                      padding: "4px 10px",
                      borderRadius: "6px",
                      border: `1.5px solid ${cardRatings[c.id] === val
                        ? (val ? "var(--success, #4ecca3)" : "#e05252")
                        : "var(--border, rgba(255,255,255,0.08))"}`,
                      background: cardRatings[c.id] === val
                        ? (val ? "rgba(78,204,163,0.12)" : "rgba(224,82,82,0.12)")
                        : "transparent",
                      color: cardRatings[c.id] === val
                        ? (val ? "var(--success, #4ecca3)" : "#e05252")
                        : "var(--text-muted, #9aa0b2)",
                      fontSize: "14px",
                      cursor: "pointer",
                      fontFamily: "inherit",
                      transition: "all 0.13s",
                    }}
                  >
                    {label}
                  </button>
                ))}
              </div>
            ))}
          </div>
        </div>

        {/* Cards usados */}
        <div style={sectionStyle}>
          <span style={fieldLabelStyle}>Modos usados</span>
          <div style={{ display: "flex", flexWrap: "wrap", gap: "6px" }}>
            {cards.map((c) => (
              <span key={c.id} style={{
                padding: "5px 10px", borderRadius: "10px",
                background: c.colorBg || "rgba(255,255,255,0.06)",
                fontSize: "12px", fontWeight: "600",
                color: c.color || "var(--text-muted)",
                border: `1px solid ${c.color ? c.color + "40" : "transparent"}`,
              }}>
                {c.emoji} {c.name}
              </span>
            ))}
          </div>
        </div>

        {/* Duração */}
        <div style={sectionStyle}>
          <span style={fieldLabelStyle}>Duração</span>
          <div style={{ display: "flex", gap: "12px", flexWrap: "wrap" }}>
            <div style={{ fontSize: "13px", color: "var(--text-muted)" }}>
              🕐 Início: <strong style={{ color: "var(--text)" }}>{new Date(startedAt).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}</strong>
            </div>
            <div style={{ fontSize: "13px", color: "var(--text-muted)" }}>
              🏁 Fim: <strong style={{ color: "var(--text)" }}>{new Date().toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}</strong>
            </div>
            <div style={{ fontSize: "13px", color: "var(--text-muted)" }}>
              ⏱ Total: <strong style={{ color: "var(--text)" }}>{durationStr}</strong>
            </div>
          </div>
        </div>

        {/* Funcionou? */}
        <div style={sectionStyle}>
          <span style={fieldLabelStyle}>Funcionou?</span>
          <div style={{ display: "flex", gap: "8px" }}>
            {[
              { val: true,  label: "✅ Sim", activeColor: "var(--success, #4ecca3)" },
              { val: false, label: "❌ Não", activeColor: "#e05252" },
            ].map(({ val, label, activeColor }) => (
              <button
                key={String(val)}
                type="button"
                onClick={() => setWorked(val)}
                style={{
                  flex: 1, padding: "11px 12px",
                  borderRadius: "var(--radius-sm, 8px)",
                  border: `2px solid ${worked === val ? activeColor : "var(--border)"}`,
                  background: worked === val ? `${activeColor}1a` : "var(--surface-2)",
                  color: worked === val ? activeColor : "var(--text-muted)",
                  fontSize: "14px", fontWeight: "600", cursor: "pointer", fontFamily: "inherit",
                  transition: "all 0.15s",
                }}
              >
                {label}
              </button>
            ))}
          </div>
        </div>

        {/* Tempo focado */}
        <div style={sectionStyle}>
          <span style={fieldLabelStyle}>Tempo concentrado</span>
          <div style={{ display: "flex", alignItems: "baseline", gap: "6px" }}>
            <input
              type="text"
              inputMode="numeric"
              value={focusedMinutes || ""}
              onChange={(e) => {
                const v = e.target.value.replace(/\D/g, "").slice(0, 3);
                setFocusedMinutes(v === "" ? 0 : Math.min(999, parseInt(v, 10)));
              }}
              placeholder="ex: 30"
              maxLength={3}
              style={{
                width: "60px", background: "var(--surface)", border: "1.5px solid var(--border)",
                color: "var(--text)", fontSize: "20px", fontWeight: "700", fontFamily: "inherit",
                padding: "4px 7px", borderRadius: "6px", outline: "none", textAlign: "center",
              }}
            />
            <span style={{ fontSize: "12px", color: "var(--text-muted)" }}>min</span>
          </div>
        </div>

        {/* Emoções */}
        <div style={sectionStyle}>
          <span style={fieldLabelStyle}>Como você estava?</span>
          <div style={chipsStyle}>
            {FEELINGS.map((f) => (
              <Chip
                key={f.id}
                label={f.label}
                selected={feelings.includes(f.id)}
                onClick={() => toggleArr(setFeelings, f.id)}
              />
            ))}
          </div>
        </div>

        {/* Ociosidade */}
        <div style={sectionStyle}>
          <span style={fieldLabelStyle}>Por que ficou ocioso?</span>
          <div style={chipsStyle}>
            {IDLE_REASONS.map((r) => (
              <Chip
                key={r.id}
                label={r.label}
                selected={idleReason.includes(r.id)}
                onClick={() => toggleArr(setIdleReason, r.id)}
              />
            ))}
          </div>
        </div>

        {/* Nota rápida */}
        <div style={sectionStyle}>
          <span style={fieldLabelStyle}>
            📝 O que você aprendeu ou quer lembrar?{" "}
            <span style={{ fontWeight: 400, opacity: 0.6, textTransform: "none" }}>(opcional)</span>
          </span>
          <textarea
            placeholder="Ex: Sessão combo muito produtiva, tente de manhã..."
            value={note}
            onChange={(e) => setNote(e.target.value)}
            maxLength={500}
            rows={3}
            style={{
              width: "100%", padding: "8px 10px",
              background: "var(--surface-2, rgba(255,255,255,0.04))",
              border: "1px solid var(--border, rgba(255,255,255,0.07))",
              borderRadius: "8px", color: "var(--text, #e8eaf0)",
              fontSize: "13px", fontFamily: "inherit",
              resize: "vertical", lineHeight: 1.5,
              boxSizing: "border-box",
            }}
          />
        </div>

        <button
          type="button"
          onClick={handleSubmit}
          disabled={worked === null}
          style={{
            width: "100%", padding: "12px 16px",
            borderRadius: "var(--radius-sm, 8px)",
            border: "none", background: "var(--accent, #7c6ef5)",
            color: "#fff", fontSize: "14px", fontWeight: "700",
            cursor: worked === null ? "not-allowed" : "pointer",
            fontFamily: "inherit", transition: "background 0.14s",
            opacity: worked === null ? 0.4 : 1,
            marginTop: "2px",
          }}
        >
          📝 Registrar sessão
        </button>
        {worked === null && (
          <p style={{ fontSize: "11px", color: "var(--text-muted)", textAlign: "center", marginTop: "-8px" }}>
            Responda "Funcionou?" para continuar
          </p>
        )}
      </div>
    </div>
  );
}
