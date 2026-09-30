/**
 * ActiveModeContext.tsx — sessão de modo ativa, global e persistente à navegação.
 *
 * A sessão de modo (ModeSession) era renderizada dentro do ModesPanel, cujo estado
 * é destruído ao navegar para outra página (roteamento por hash desmonta a página).
 * Ao elevar a sessão para um provider montado ACIMA do roteador (em main.tsx), a
 * sessão sobrevive à navegação e pode ser:
 *   - exibida em tela cheia (overlay do ModeSession) quando `!minimized`;
 *   - minimizada num card flutuante (FloatingModeCard) que fica visível sobre
 *     qualquer página; clicar nele expande a sessão de volta.
 *
 * Persistência: um snapshot {modeId, intention, minimized, startedAt} é salvo no
 * localStorage para sobreviver a reload/crash. Os dados/handlers de tarefas e
 * rotinas vêm dos hooks já existentes (React Query, cache compartilhado com as
 * páginas — não há duplicação de dados).
 */

import { createContext, useContext, useState, useCallback, useEffect, useRef, ReactNode } from "react";
import { createPortal } from "react-dom";
import ModeSession from "../components/ModeSession";
import MultiCardSession from "../components/MultiCardSession";
import FloatingModeCard from "../components/modes/FloatingModeCard";
import { ModeConfig } from "../components/modes/types";
import { MODES } from "../data/modes";
import { getCustomModes } from "../lib/customModes";
import {
  loadActiveSession,
  saveActiveSession,
  clearActiveSession,
  updateActiveSessionMinimized,
} from "../lib/multiCardSessionLog";
import { useTasks } from "../hooks/useTasks";
import { useRoutines } from "../hooks/useRoutines";
import { modeStatsApi } from "../api/modeStats";
import { logQuickUsage } from "../lib/sessionUsageLog";
import { useToast } from "../components/shared/Toast";
import { getPinned } from "../lib/splitePinned";
import { storageGet, storageSet, storageRemove } from "../lib/storage";
import { SK } from "../lib/storageKeys";
import { MODE_SESSION_CLOSED_EVENT, MODE_STATS_UPDATED_EVENT } from "../lib/modeEvents";
import { startModeFocusTimer, stopModeFocusTimer, syncModeFocusTimer, incrementModeTaskCount } from "../lib/modeFocusTimer";
import { DAILY_FOCUS_LIVE_EVENT } from "../lib/dailyFocusLive";

// Reexporta para consumidores que importavam daqui antes.
export { MODE_SESSION_CLOSED_EVENT } from "../lib/modeEvents";

interface ModeSessionSnapshot {
  modeId: string;
  intention: string;
  minimized: boolean;
  startedAt: string;
}

interface ActiveModeContextValue {
  activeMode: ModeConfig | null;
  minimized: boolean;
  /** ISO do início da sessão (para cronômetro no card). */
  startedAt: string | null;
  /** Abre uma sessão em tela cheia (substitui qualquer sessão em andamento). */
  activate: (mode: ModeConfig, intention?: string) => void;
  /** Minimiza para o card flutuante (não encerra a sessão). */
  minimize: () => void;
  /** Expande o card flutuante de volta para tela cheia. */
  expand: () => void;
  /** Encerra a sessão (chamado pelo fluxo de fechamento do ModeSession). */
  close: () => void;

  // ── Sessão multi-card ─────────────────────────────────────────────────────
  /** true quando há uma sessão multi-card ativa (única ou multi). */
  multiActive: boolean;
  /** true quando qualquer sessão (única OU multi) está ativa. */
  hasActiveSession: boolean;
  /** Abre uma sessão multi-card em tela cheia. */
  activateMultiCard: (cards: ModeConfig[], sessionMode: 'sequential' | 'parallel', intention?: string) => void;
}

interface MultiCardState {
  cards: ModeConfig[];
  startedAt: string;
  initialIndex: number;
  sessionMode: 'sequential' | 'parallel';
  intention: string;
  minimized: boolean;
}

const ActiveModeContext = createContext<ActiveModeContextValue | null>(null);

/** Localiza um modo (nativo ou customizado) pelo id — usado na reidratação. */
function findModeById(id: string): ModeConfig | null {
  const all = [...(MODES as ModeConfig[]), ...getCustomModes()];
  return all.find((m) => m.id === id) ?? null;
}

/** Lê o snapshot persistido e resolve o modo correspondente (ou null). */
function loadSnapshot(): { mode: ModeConfig; intention: string; minimized: boolean; startedAt: string } | null {
  const snap = storageGet<ModeSessionSnapshot | null>(SK.ACTIVE_MODE_SESSION, null);
  if (!snap?.modeId) return null;
  const mode = findModeById(snap.modeId);
  if (!mode) return null;
  return { mode, intention: snap.intention || "", minimized: !!snap.minimized, startedAt: snap.startedAt };
}

/** Reidrata a sessão multi-card persistida (resolve ids em ModeConfig). */
function loadMultiCard(): MultiCardState | null {
  const active = loadActiveSession();
  if (!active) return null;
  const all = [...(MODES as ModeConfig[]), ...getCustomModes()];
  const cards = active.cards
    .map((id) => all.find((m) => m.id === id))
    .filter(Boolean) as ModeConfig[];
  if (cards.length === 0) {
    clearActiveSession();
    return null;
  }
  return {
    cards,
    startedAt: active.startedAt,
    initialIndex: active.currentCardIndex ?? 0,
    sessionMode: active.sessionMode ?? 'sequential',
    intention: active.intention ?? "",
    minimized: !!active.minimized,
  };
}

export function ActiveModeProvider({ children }: { children: ReactNode }) {
  const { showToast } = useToast();
  const initial = loadSnapshot();
  const [activeMode, setActiveMode] = useState<ModeConfig | null>(initial?.mode ?? null);
  const [intention, setIntention] = useState<string>(initial?.intention ?? "");
  const [minimized, setMinimized] = useState<boolean>(initial?.minimized ?? false);
  const [startedAt, setStartedAt] = useState<string | null>(initial?.startedAt ?? null);

  // Sessão multi-card (reidratada do localStorage no mount).
  const [multi, setMulti] = useState<MultiCardState | null>(loadMultiCard);
  // Índice do card atual (reportado pelo MultiCardSession) — usado no card flutuante.
  const [multiIndex, setMultiIndex] = useState<number>(() => multi?.initialIndex ?? 0);

  // React Query: mesmo cache das páginas, sem duplicar dados.
  const {
    tasks,
    handleCompleteTask,
    handleCreateTask,
    handleAddTaskChecklist,
    handleToggleTaskChecklist,
  } = useTasks("", "due_date_asc");
  const {
    routines,
    handleCompleteRoutine,
    handleAddRoutineChecklist,
    handleToggleRoutineChecklist,
  } = useRoutines("");

  // Persiste snapshot sempre que a sessão muda (sobrevive a reload/crash).
  useEffect(() => {
    if (activeMode && startedAt) {
      const snap: ModeSessionSnapshot = { modeId: activeMode.id, intention, minimized, startedAt };
      storageSet(SK.ACTIVE_MODE_SESSION, snap);
    } else {
      storageRemove(SK.ACTIVE_MODE_SESSION);
    }
  }, [activeMode, intention, minimized, startedAt]);

  // Mantém o acumulador de tempo de foco em sincronia com o Daily Focus mesmo com o
  // usuário em outra página: reconcilia no mount, a cada mudança do snapshot live e num
  // heartbeat periódico (mantém `lastSeenTs` fresco → descarta tempo de background).
  useEffect(() => {
    syncModeFocusTimer();
    const onLive = (): void => syncModeFocusTimer();
    window.addEventListener(DAILY_FOCUS_LIVE_EVENT, onLive);
    const hb = setInterval(() => syncModeFocusTimer(), 15000);
    const onVisible = (): void => { if (document.visibilityState === "visible") syncModeFocusTimer(); };
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      window.removeEventListener(DAILY_FOCUS_LIVE_EVENT, onLive);
      clearInterval(hb);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, []);

  // #6 — Sessão "órfã" no boot: se uma sessão reidratada começou há muito tempo
  // (provável esquecimento — app fechou sem encerrar), avisa uma vez para registrar.
  const orphanNudged = useRef<boolean>(false);
  useEffect(() => {
    if (orphanNudged.current) return;
    const STALE_MS = 6 * 60 * 60 * 1000; // 6h
    const startIso = startedAt ?? multi?.startedAt ?? null;
    const name = activeMode?.name ?? (multi ? `${multi.cards.length} modos` : null);
    if (!startIso || !name) return;
    const ageMs = Date.now() - new Date(startIso).getTime();
    if (ageMs > STALE_MS) {
      orphanNudged.current = true;
      showToast(`Você tem uma sessão de ${name} em aberto há um tempo — encerre pelo card para registrar.`, "info");
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const activate = useCallback((mode: ModeConfig, intentionText: string = "") => {
    // Garante uma única sessão ativa: encerra qualquer multi-card em andamento.
    setMulti(null);
    clearActiveSession();
    const startedAtIso = new Date().toISOString();
    setIntention(intentionText);
    setStartedAt(startedAtIso);
    setActiveMode(mode);
    // Abre já MINIMIZADO (card flutuante compacto); o usuário expande se quiser.
    setMinimized(true);
    // Inicia o acumulador de tempo de foco (sincronizado ao Daily Focus).
    startModeFocusTimer(startedAtIso);
  }, []);

  const minimize = useCallback(() => setMinimized(true), []);
  const expand = useCallback(() => setMinimized(false), []);

  // "Detalhar" pelo card: expande e abre o formulário completo.
  const [autoEnd, setAutoEnd] = useState<boolean>(false);
  const requestEndSingle = useCallback(() => {
    setMinimized(false);
    setAutoEnd(true);
  }, []);

  const close = useCallback(() => {
    setActiveMode(null);
    setIntention("");
    setMinimized(false);
    setStartedAt(null);
    storageRemove(SK.ACTIVE_MODE_SESSION);
    stopModeFocusTimer();
    getPinned(); // recarrega pinos do storage (consistente com o painel)
    window.dispatchEvent(new Event(MODE_SESSION_CLOSED_EVENT));
  }, []);

  // Registro RÁPIDO pelo card (👍/👎): salva o foco medido e encerra, sem abrir o form.
  // logQuickUsage lê o acumulador ANTES de close() (que chama stopModeFocusTimer).
  const quickEndSingle = useCallback((worked: boolean) => {
    if (activeMode) {
      logQuickUsage({ modeId: activeMode.id, worked, sessionStartedAt: startedAt ?? undefined, intention: intention || undefined });
      showToast(`Sessão de ${activeMode.name} registrada ✓`, "success");
    }
    close();
  }, [activeMode, startedAt, intention, close, showToast]);

  // Descarta a sessão SEM registrar (aberta por engano).
  const discardSingle = useCallback(() => {
    const name = activeMode?.name;
    close();
    if (name) showToast(`Sessão de ${name} descartada`, "info");
  }, [activeMode, close, showToast]);

  // ── Multi-card ──────────────────────────────────────────────────────────────
  const activateMultiCard = useCallback((cards: ModeConfig[], sessionMode: 'sequential' | 'parallel', intentionText: string = "") => {
    // Garante uma única sessão ativa: encerra qualquer sessão de modo único.
    setActiveMode(null);
    setMinimized(false);
    setStartedAt(null);
    storageRemove(SK.ACTIVE_MODE_SESSION);
    const startedAtIso = new Date().toISOString();
    saveActiveSession({
      cards: cards.map((c) => c.id),
      startedAt: startedAtIso,
      currentCardIndex: 0,
      sessionMode,
      intention: intentionText,
      minimized: true,
    });
    setMultiIndex(0);
    // Abre já MINIMIZADO (card flutuante compacto); o usuário expande se quiser.
    setMulti({ cards, startedAt: startedAtIso, initialIndex: 0, sessionMode, intention: intentionText, minimized: true });
    startModeFocusTimer(startedAtIso);
  }, []);

  const minimizeMulti = useCallback(() => {
    updateActiveSessionMinimized(true);
    setMulti((m) => (m ? { ...m, minimized: true } : m));
  }, []);

  const expandMulti = useCallback(() => {
    updateActiveSessionMinimized(false);
    setMulti((m) => (m ? { ...m, minimized: false } : m));
  }, []);

  // "Detalhar" multi-card pelo card: expande e abre o formulário completo (fase post-form).
  const [multiEndSignal, setMultiEndSignal] = useState<number>(0);
  const requestEndMulti = useCallback(() => {
    updateActiveSessionMinimized(false);
    setMulti((m) => (m ? { ...m, minimized: false } : m));
    setMultiEndSignal((s) => s + 1);
  }, []);

  const closeMulti = useCallback(() => {
    clearActiveSession();
    setMulti(null);
    stopModeFocusTimer();
    getPinned();
    window.dispatchEvent(new Event(MODE_SESSION_CLOSED_EVENT));
  }, []);

  // Registro RÁPIDO multi-card pelo card: registra cada card com o foco medido e encerra.
  const quickEndMulti = useCallback((worked: boolean) => {
    if (multi) {
      multi.cards.forEach((c) =>
        logQuickUsage({ modeId: c.id, worked, sessionStartedAt: multi.startedAt, intention: multi.intention || undefined }),
      );
      showToast(`Sessão de ${multi.cards.length} modo${multi.cards.length > 1 ? "s" : ""} registrada ✓`, "success");
    }
    closeMulti();
  }, [multi, closeMulti, showToast]);

  // Descarta a sessão multi-card SEM registrar.
  const discardMulti = useCallback(() => {
    closeMulti();
    showToast("Sessão descartada", "info");
  }, [closeMulti, showToast]);

  // Contabiliza conclusão de tarefa durante a sessão (contador local + incremento no banco).
  // Vive aqui (provider sempre montado) para funcionar mesmo com o usuário em outra página.
  // A conclusão é capturada pelo acumulador de foco (`tasksCompleted`) e persistida no
  // log de uso ao encerrar a sessão — fonte única de verdade do ranking "mais usados".
  const handleModeTaskComplete = useCallback(async (modeId: string): Promise<void> => {
    incrementModeTaskCount();
    try {
      await modeStatsApi.increment(modeId);
    } catch {
      /* offline-first: incremento sincroniza depois; silêncio proposital */
    }
    window.dispatchEvent(new Event(MODE_STATS_UPDATED_EVENT));
  }, []);

  const multiActive = !!multi;
  const hasActiveSession = !!activeMode || multiActive;

  return (
    <ActiveModeContext.Provider value={{
      activeMode, minimized, startedAt, activate, minimize, expand, close,
      multiActive, hasActiveSession, activateMultiCard,
    }}>
      {children}

      {activeMode && !minimized &&
        createPortal(
          <ModeSession
            modeId={activeMode.id}
            mode={activeMode}
            tasks={tasks}
            routines={routines}
            intention={intention || undefined}
            onCompleteTask={handleCompleteTask}
            onCompleteRoutine={handleCompleteRoutine}
            onAddTask={handleCreateTask}
            onAddChecklist={handleAddTaskChecklist}
            onToggleChecklist={handleToggleTaskChecklist}
            onAddRoutineChecklist={handleAddRoutineChecklist}
            onToggleRoutineChecklist={handleToggleRoutineChecklist}
            onTaskComplete={handleModeTaskComplete}
            onMinimize={minimize}
            onClose={close}
            autoEnd={autoEnd}
            onAutoEndConsumed={() => setAutoEnd(false)}
          />,
          document.body,
        )}

      {activeMode && minimized &&
        createPortal(
          <FloatingModeCard
            mode={activeMode}
            startedAt={startedAt}
            onExpand={expand}
            onQuickEnd={quickEndSingle}
            onDetail={requestEndSingle}
            onDiscard={discardSingle}
          />,
          document.body,
        )}

      {/* Sessão multi-card: mantida MONTADA (só ocultada quando minimizada) para
          preservar cronômetro/estado ao alternar minimizar ⇄ expandir. */}
      {multi &&
        createPortal(
          <div style={{ display: multi.minimized ? "none" : "contents" }}>
            <MultiCardSession
              cards={multi.cards}
              startedAt={multi.startedAt}
              initialIndex={multi.initialIndex}
              intention={multi.intention || undefined}
              tasks={tasks}
              routines={routines}
              onCompleteTask={handleCompleteTask}
              onCompleteRoutine={handleCompleteRoutine}
              onAddTask={handleCreateTask}
              onAddChecklist={handleAddTaskChecklist}
              onToggleChecklist={handleToggleTaskChecklist}
              onAddRoutineChecklist={handleAddRoutineChecklist}
              onToggleRoutineChecklist={handleToggleRoutineChecklist}
              onMinimize={minimizeMulti}
              minimized={multi.minimized}
              onIndexChange={setMultiIndex}
              onClose={closeMulti}
              endSignal={multiEndSignal}
            />
          </div>,
          document.body,
        )}

      {multi && multi.minimized &&
        createPortal(
          <FloatingModeCard
            mode={multi.cards[Math.min(multiIndex, multi.cards.length - 1)]}
            startedAt={multi.startedAt}
            count={multi.cards.length}
            index={multiIndex}
            onExpand={expandMulti}
            onQuickEnd={quickEndMulti}
            onDetail={requestEndMulti}
            onDiscard={discardMulti}
          />,
          document.body,
        )}
    </ActiveModeContext.Provider>
  );
}

/** Hook para consumir a sessão de modo ativa. Deve estar dentro de <ActiveModeProvider>. */
export function useActiveMode(): ActiveModeContextValue {
  const ctx = useContext(ActiveModeContext);
  if (!ctx) throw new Error("useActiveMode deve ser usado dentro de <ActiveModeProvider>");
  return ctx;
}
