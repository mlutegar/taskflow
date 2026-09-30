import { useEffect, useRef, useState } from "react";
import styles from "./DailyFocusFloatingCard.module.css";
import { storageGet, storageSet, storageRemove } from "../../lib/storage";
import { ExpandIcon, CloseIcon } from "../shared/icons";
import { playTimerDone } from "../../lib/sounds";
import { showNotification } from "../../lib/notifications";
import {
  DailyFocusLive,
  loadDailyFocusLive,
  saveDailyFocusLive,
  clearDailyFocusLive,
  endDailyFocusSession,
  liveRemaining,
  DAILY_FOCUS_LIVE_EVENT,
} from "../../lib/dailyFocusLive";

interface CardPos { left: number; top: number; }

const DRAG_THRESHOLD = 5;          // px — abaixo disso é clique, não arraste
const LONG_PAUSE_MS = 10 * 60_000; // 10 min pausado → alerta visual

/** Formata segundos como "mm:ss" (ou "h:mm:ss" acima de 1h). */
function fmt(totalSecs: number): string {
  const s = Math.max(0, Math.floor(totalSecs));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  const pad = (n: number) => n.toString().padStart(2, "0");
  return h > 0 ? `${h}:${pad(m)}:${pad(sec)}` : `${pad(m)}:${pad(sec)}`;
}

function clampPos(pos: CardPos): CardPos {
  const maxLeft = Math.max(0, window.innerWidth - 260);
  const maxTop = Math.max(0, window.innerHeight - 120);
  return { left: Math.min(Math.max(0, pos.left), maxLeft), top: Math.min(Math.max(0, pos.top), maxTop) };
}

/** Chave própria de posição (não colide com a do card de Modo). */
const POS_KEY = "dailyFocus.floatingCardPos";

/**
 * Card flutuante persistente do Daily Focus. Visível sobre qualquer página enquanto há
 * sessão ativa (fora da tela cheia). Mostra tarefa, tempo, estado e progresso; permite
 * pausar/continuar, expandir detalhes, voltar à tela cheia e encerrar. Ao continuar, o
 * timer segue contando em background (ancorado no snapshot — ver dailyFocusLive.ts).
 */
export default function DailyFocusFloatingCard(): JSX.Element | null {
  const [snap, setSnap] = useState<DailyFocusLive | null>(() => loadDailyFocusLive());
  const [displaySecs, setDisplaySecs] = useState<number | null>(null);
  const [now, setNow] = useState<number>(() => Date.now());
  const [expanded, setExpanded] = useState<boolean>(false);
  const [confirmingClose, setConfirmingClose] = useState<boolean>(false);
  const [pos, setPos] = useState<CardPos | null>(() => {
    const saved = storageGet<CardPos | null>(POS_KEY, null);
    return saved ? clampPos(saved) : null;
  });
  const dragState = useRef<{ dx: number; dy: number; moved: boolean } | null>(null);
  // Evita disparar a notificação de conclusão mais de uma vez por âncora.
  const completedFiredRef = useRef<number | null>(null);

  // Re-lê o snapshot quando a página grava/limpa (ou em outra aba via storage event).
  useEffect(() => {
    const reload = () => { setSnap(loadDailyFocusLive()); setConfirmingClose(false); };
    window.addEventListener(DAILY_FOCUS_LIVE_EVENT, reload);
    window.addEventListener("storage", reload);
    return () => {
      window.removeEventListener(DAILY_FOCUS_LIVE_EVENT, reload);
      window.removeEventListener("storage", reload);
    };
  }, []);

  // Cronômetro ao vivo — tica de 1 em 1s enquanto rodando (também alimenta "pausado há…").
  useEffect(() => {
    if (!snap) { setDisplaySecs(null); return; }
    const compute = () => {
      setNow(Date.now());
      if (snap.rushMode || snap.remainingSecs == null) {
        setDisplaySecs(Math.floor((Date.now() - snap.anchorTs) / 1000));
      } else {
        setDisplaySecs(liveRemaining(snap) ?? 0);
      }
    };
    compute();
    const id = setInterval(compute, 1000);
    return () => clearInterval(id);
  }, [snap]);

  // Conclusão em background: quando o countdown zera estando rodando, avisa uma vez.
  useEffect(() => {
    if (!snap || snap.rushMode || snap.remainingSecs == null || !snap.running) return;
    if ((displaySecs ?? 1) > 0) return;
    if (completedFiredRef.current === snap.anchorTs) return;
    completedFiredRef.current = snap.anchorTs;
    try { playTimerDone(); } catch { /* noop */ }
    showNotification("⏱ Tempo concluído — Daily Focus", {
      body: snap.taskTitle ? `Tarefa: ${snap.taskTitle}. Volte para avançar.` : "Volte para avançar a sessão.",
      tag: "daily-focus-timer",
      data: { url: "/taskflow/#/daily-focus" },
    });
  }, [displaySecs, snap]);

  const togglePause = (e: React.MouseEvent): void => {
    e.stopPropagation();
    if (!snap) return;
    if (snap.running) {
      const frozen = snap.remainingSecs == null ? null : (liveRemaining(snap) ?? 0);
      const next: DailyFocusLive = { ...snap, running: false, remainingSecs: frozen, anchorTs: Date.now() };
      saveDailyFocusLive(next); setSnap(next);
    } else {
      const next: DailyFocusLive = { ...snap, running: true, anchorTs: Date.now() };
      saveDailyFocusLive(next); setSnap(next);
    }
  };

  const goToFull = (): void => { window.location.hash = "/daily-focus"; };
  const resetPos = (e: React.MouseEvent): void => {
    e.stopPropagation();
    storageRemove(POS_KEY);
    setPos(null);
  };
  const endSession = (e: React.MouseEvent): void => {
    e.stopPropagation();
    endDailyFocusSession();
    setSnap(null);
  };

  const onPointerDown = (e: React.PointerEvent<HTMLDivElement>): void => {
    if ((e.target as HTMLElement).closest("button")) return;
    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
    dragState.current = { dx: e.clientX - rect.left, dy: e.clientY - rect.top, moved: false };
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
  };
  const onPointerMove = (e: React.PointerEvent<HTMLDivElement>): void => {
    const d = dragState.current;
    if (!d) return;
    const nextLeft = e.clientX - d.dx;
    const nextTop = e.clientY - d.dy;
    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
    if (Math.abs(nextLeft - rect.left) > DRAG_THRESHOLD || Math.abs(nextTop - rect.top) > DRAG_THRESHOLD) d.moved = true;
    setPos(clampPos({ left: nextLeft, top: nextTop }));
  };
  const onPointerUp = (e: React.PointerEvent<HTMLDivElement>): void => {
    const d = dragState.current;
    dragState.current = null;
    try { (e.currentTarget as HTMLElement).releasePointerCapture(e.pointerId); } catch { /* noop */ }
    if (!d) return;
    if (d.moved) setPos((p) => { if (p) storageSet(POS_KEY, p); return p; });
    else setExpanded((v) => !v); // clique sem arraste → alterna painel expandido
  };

  if (!snap) return null;

  const isCountdown = !snap.rushMode && snap.remainingSecs != null;
  const done = isCountdown && (displaySecs ?? 0) <= 0;
  const secs = displaySecs ?? snap.remainingSecs ?? 0;

  // Progresso 0..1 (só faz sentido no countdown).
  const progress = isCountdown && snap.totalSecs > 0
    ? Math.min(1, Math.max(0, 1 - secs / snap.totalSecs))
    : 0;

  // Pausa longa: quando pausado, anchorTs marca o instante da pausa.
  const pausedForMs = !snap.running ? now - snap.anchorTs : 0;
  const longPaused = !snap.running && pausedForMs >= LONG_PAUSE_MS;
  const pausedMin = Math.floor(pausedForMs / 60_000);

  // Rótulo do modo/tempo.
  let timeLabel: string;
  if (snap.tabMode) timeLabel = `${snap.cycleCount} ciclo${snap.cycleCount === 1 ? "" : "s"}`;
  else if (snap.rushMode) timeLabel = `⚡ ${fmt(secs)}`;
  else timeLabel = `⏱ ${fmt(secs)}`;

  const style: React.CSSProperties = pos
    ? { left: pos.left, top: pos.top, right: "auto", bottom: "auto" }
    : {};

  return (
    <div
      className={`${styles.card} ${longPaused ? styles.longPaused : ""} ${done ? styles.done : ""}`}
      style={style}
      role="group"
      aria-label={`Daily Focus: ${snap.taskTitle}`}
      title="Clique para expandir · arraste para reposicionar"
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
    >
      <div className={styles.row}>
        {isCountdown ? (
          <span
            className={styles.ring}
            style={{ ["--p" as any]: progress }}
            aria-hidden="true"
          >
            <span className={styles.ringInner}>{snap.running ? "▶" : "⏸"}</span>
          </span>
        ) : (
          <span className={`${styles.pulse} ${snap.running ? styles.pulseOn : ""}`} aria-hidden="true" />
        )}

        <span className={styles.info}>
          <span className={styles.label}>
            Daily Focus
            {snap.taskCount > 1 && <span className={styles.taskCount}> · {snap.taskIndex + 1}/{snap.taskCount}</span>}
          </span>
          <span className={styles.name}>{snap.taskTitle || "Sessão ativa"}</span>
          <span className={styles.meta} aria-live="polite">
            <span className={done ? styles.timerDone : styles.timer}>
              {done ? "Tempo concluído" : timeLabel}
            </span>
            <span className={snap.running ? styles.stateOn : styles.stateOff}>
              {snap.running ? "Em foco" : "Pausado"}
            </span>
          </span>
        </span>

        <span className={styles.actions}>
          {isCountdown && (
            <button
              type="button"
              className={styles.actionBtn}
              aria-label={snap.running ? "Pausar" : "Continuar"}
              title={snap.running ? "Pausar" : "Continuar"}
              onClick={togglePause}
            >
              {snap.running ? "⏸" : "▶"}
            </button>
          )}
          <button
            type="button"
            className={styles.actionBtn}
            aria-label="Abrir tela cheia do Daily Focus"
            title="Tela cheia"
            onClick={(e) => { e.stopPropagation(); goToFull(); }}
          >
            <ExpandIcon />
          </button>
        </span>
      </div>

      {longPaused && (
        <div className={styles.pauseWarn} role="status">
          ⚠ Pausado há {pausedMin} min
        </div>
      )}

      {expanded && (
        <div className={styles.panel} onPointerDown={(e) => e.stopPropagation()}>
          {snap.nextTaskTitle && (
            <div className={styles.panelRow}>
              <span className={styles.panelLabel}>Próxima</span>
              <span className={styles.panelValue}>{snap.nextTaskTitle}</span>
            </div>
          )}
          <div className={styles.panelActions}>
            <button type="button" className={styles.panelBtn} onClick={(e) => { e.stopPropagation(); goToFull(); }}>
              Abrir tela cheia
            </button>
            {pos && (
              <button type="button" className={styles.panelBtn} onClick={resetPos}>
                Resetar posição
              </button>
            )}
            {confirmingClose ? (
              <span className={styles.confirmWrap}>
                <span className={styles.confirmLabel}>Encerrar?</span>
                <button type="button" className={styles.confirmYes} onClick={endSession} title="Confirmar">✓</button>
                <button type="button" className={styles.confirmNo} onClick={(e) => { e.stopPropagation(); setConfirmingClose(false); }} title="Cancelar">✕</button>
              </span>
            ) : (
              <button
                type="button"
                className={`${styles.panelBtn} ${styles.panelBtnDanger}`}
                onClick={(e) => { e.stopPropagation(); setConfirmingClose(true); }}
              >
                <CloseIcon /> Encerrar
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
