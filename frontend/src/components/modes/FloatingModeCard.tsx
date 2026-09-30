import { useEffect, useRef, useState } from "react";
import styles from "./FloatingModeCard.module.css";
import { ModeConfig } from "./types";
import { storageGet, storageSet } from "../../lib/storage";
import { SK } from "../../lib/storageKeys";
import { ExpandIcon, CloseIcon } from "../shared/icons";
import { liveModeFocusMs, isModeFocusRunning, getModeFocusStats } from "../../lib/modeFocusTimer";
import { DAILY_FOCUS_LIVE_EVENT } from "../../lib/dailyFocusLive";

interface FloatingModeCardProps {
  mode: ModeConfig;
  /** ISO do início da sessão — usado para o cronômetro ao vivo. */
  startedAt: string | null;
  /** Nº de modos da sessão (>1 → rótulo "N modos", para sessões multi-card). */
  count?: number;
  /** Índice (0-based) do card atual — mostra "Card i/N" quando multi. */
  index?: number;
  /** Expande a sessão de volta para tela cheia. */
  onExpand: () => void;
  /** Registro RÁPIDO inline: encerra salvando o foco medido + a resposta "funcionou?". */
  onQuickEnd: (worked: boolean) => void;
  /** "Detalhar": expande a sessão já no formulário completo de registro. */
  onDetail: () => void;
  /** Descarta a sessão SEM registrar (ex.: aberta por engano). */
  onDiscard: () => void;
}

interface CardPos { left: number; top: number; }

const DRAG_THRESHOLD = 5; // px — abaixo disso é clique, não arraste

/** Formata milissegundos decorridos como "m min" ou "h:mm". */
function formatElapsed(ms: number): string {
  const totalMin = Math.floor(ms / 60000);
  if (totalMin < 60) return `${totalMin} min`;
  const h = Math.floor(totalMin / 60);
  const m = totalMin % 60;
  return `${h}h${m.toString().padStart(2, "0")}`;
}

/** Garante que a posição salva ainda cabe na viewport atual. */
function clampPos(pos: CardPos): CardPos {
  const maxLeft = Math.max(0, window.innerWidth - 220);
  const maxTop = Math.max(0, window.innerHeight - 80);
  return { left: Math.min(Math.max(0, pos.left), maxLeft), top: Math.min(Math.max(0, pos.top), maxTop) };
}

/**
 * Card flutuante persistente exibido quando uma sessão de modo é minimizada.
 * Fica fixo sobre qualquer página, mostra o modo ativo e o tempo decorrido.
 * Clicar no corpo expande a sessão; arrastar reposiciona (posição memorizada).
 */
export default function FloatingModeCard({ mode, startedAt, count, index, onExpand, onQuickEnd, onDetail, onDiscard }: FloatingModeCardProps): JSX.Element {
  const total = count ?? 1;
  const isMulti = total > 1;
  const [pos, setPos] = useState<CardPos | null>(() => {
    const saved = storageGet<CardPos | null>(SK.FLOATING_CARD_POS, null);
    return saved ? clampPos(saved) : null;
  });
  const [elapsed, setElapsed] = useState<string>("");
  const [paused, setPaused] = useState<boolean>(false);
  const [confirmingClose, setConfirmingClose] = useState<boolean>(false);
  // Snapshot das métricas de foco no momento de abrir a confirmação (preview #7).
  const [confirmPreview, setConfirmPreview] = useState<string>("");
  const dragState = useRef<{ dx: number; dy: number; moved: boolean } | null>(null);

  /** Abre o painel de encerramento capturando o foco medido para o preview. */
  const openConfirm = (): void => {
    const s = getModeFocusStats();
    const parts: string[] = [`⚡ ${s.focusMinutes} min focado`];
    if (s.tasksCompleted > 0) parts.push(`${s.tasksCompleted} tarefa${s.tasksCompleted > 1 ? "s" : ""}`);
    if (s.pauseCount > 0) parts.push(`${s.pauseCount} pausa${s.pauseCount > 1 ? "s" : ""}`);
    setConfirmPreview(parts.join(" · "));
    setConfirmingClose(true);
  };

  // Cronômetro ao vivo — mostra o TEMPO DE FOCO (só conta com o Daily Focus rodando).
  // Congela quando o Daily Focus está pausado. Atualiza em tick + eventos do snapshot live.
  useEffect(() => {
    if (!startedAt) { setElapsed(""); return; }
    const tick = (): void => {
      setElapsed(formatElapsed(liveModeFocusMs()));
      setPaused(!isModeFocusRunning());
    };
    tick();
    const id = setInterval(tick, 5000);
    window.addEventListener(DAILY_FOCUS_LIVE_EVENT, tick);
    return () => {
      clearInterval(id);
      window.removeEventListener(DAILY_FOCUS_LIVE_EVENT, tick);
    };
  }, [startedAt]);

  const onPointerDown = (e: React.PointerEvent<HTMLDivElement>): void => {
    // Não inicia drag a partir do botão de fechar
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
    if (Math.abs(nextLeft - rect.left) > DRAG_THRESHOLD || Math.abs(nextTop - rect.top) > DRAG_THRESHOLD) {
      d.moved = true;
    }
    setPos(clampPos({ left: nextLeft, top: nextTop }));
  };

  const onPointerUp = (e: React.PointerEvent<HTMLDivElement>): void => {
    const d = dragState.current;
    dragState.current = null;
    try { (e.currentTarget as HTMLElement).releasePointerCapture(e.pointerId); } catch { /* noop */ }
    if (!d) return;
    if (d.moved) {
      setPos((p) => { if (p) storageSet(SK.FLOATING_CARD_POS, p); return p; });
    } else {
      onExpand(); // clique sem arraste → expande
    }
  };

  const style: React.CSSProperties = pos
    ? { left: pos.left, top: pos.top, right: "auto", bottom: "auto" }
    : {};

  return (
    <div
      className={styles.card}
      style={style}
      role="button"
      tabIndex={0}
      aria-label={`Sessão ativa: ${mode.name}. Clique para expandir.`}
      title="Clique para expandir · arraste para reposicionar"
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") { e.preventDefault(); onExpand(); }
      }}
    >
      <span className={styles.pulse} aria-hidden="true" />
      <span className={styles.emoji} aria-hidden="true">{mode.emoji ?? "🎮"}</span>
      <span className={styles.info}>
        <span className={styles.label}>
          {isMulti ? `Card ${(index ?? 0) + 1}/${total}` : "Modo ativo"}
          {elapsed && (
            <span
              className={styles.timer}
              title={paused ? "Foco pausado — Daily Focus parado" : "Tempo de foco (conta com o Daily Focus rodando)"}
            >
              {" · "}{paused ? "⏸" : "⏱"} {elapsed}{paused ? " · Daily Focus pausado" : ""}
            </span>
          )}
        </span>
        <span className={styles.name}>{mode.name}</span>
      </span>

      {confirmingClose ? (
        <div className={styles.confirmPanel} role="group" aria-label="Encerrar sessão" aria-live="polite">
          <span className={styles.confirmTitle}>Funcionou?</span>
          {confirmPreview && <span className={styles.confirmPreview}>{confirmPreview}</span>}
          <div className={styles.confirmQuickRow}>
            <button
              type="button"
              className={styles.confirmWorked}
              aria-label="Funcionou — registrar e sair"
              title="Registrar como '👍 Funcionou'"
              onClick={(e) => { e.stopPropagation(); onQuickEnd(true); }}
            >
              👍 Sim
            </button>
            <button
              type="button"
              className={styles.confirmNotWorked}
              aria-label="Não funcionou — registrar e sair"
              title="Registrar como '👎 Não funcionou'"
              onClick={(e) => { e.stopPropagation(); onQuickEnd(false); }}
            >
              👎 Não
            </button>
          </div>
          <div className={styles.confirmSecondaryRow}>
            <button
              type="button"
              className={styles.confirmLink}
              aria-label="Detalhar registro na tela cheia"
              title="Abrir o formulário completo"
              onClick={(e) => { e.stopPropagation(); onDetail(); }}
            >
              Detalhar
            </button>
            <button
              type="button"
              className={styles.confirmLink}
              aria-label="Descartar sem registrar"
              title="Descartar sem salvar"
              onClick={(e) => { e.stopPropagation(); onDiscard(); }}
            >
              Descartar
            </button>
            <button
              type="button"
              className={styles.confirmLink}
              aria-label="Cancelar"
              title="Cancelar"
              onClick={(e) => { e.stopPropagation(); setConfirmingClose(false); }}
            >
              Cancelar
            </button>
          </div>
        </div>
      ) : (
        <span className={styles.actions}>
          <button
            type="button"
            className={styles.actionBtn}
            aria-label="Expandir sessão"
            title="Expandir"
            onClick={(e) => { e.stopPropagation(); onExpand(); }}
          >
            <ExpandIcon />
          </button>
          <button
            type="button"
            className={styles.closeBtn}
            aria-label="Encerrar sessão"
            title="Encerrar sessão"
            onClick={(e) => { e.stopPropagation(); openConfirm(); }}
          >
            <CloseIcon />
          </button>
        </span>
      )}
    </div>
  );
}
