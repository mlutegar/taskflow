import { useState, useEffect, useRef, useCallback, forwardRef, useImperativeHandle } from "react";
import styles from "./ModeSession.module.css";
import ModalOverlay from "./shared/ModalOverlay";
import { useDialog } from "../lib/useDialog";
import { logActivation } from "../lib/modeActivations";
import PostSessionForm from "./sessions/PostSessionForm";
import SessionSummary from "./shared/SessionSummary";
import MusicSession from "./sessions/MusicSession";
import TikTokSession from "./sessions/TikTokSession";
import SpliteSession from "./sessions/SpliteSession";
import MomentumSession from "./sessions/MomentumSession";
import EspressoSession from "./sessions/EspressoSession";
import RPGSession from "./sessions/RPGSession";
import LazyFalconSession from "./sessions/LazyFalconSession";
import CafeRitualSession from "./sessions/CafeRitualSession";
import TabHopSession from "./sessions/TabHopSession";
import CustomModeSession from "./sessions/CustomModeSession";
import SingSession from "./sessions/SingSession";
import PomodoroSession from "./sessions/PomodoroSession";
import DiarioFaladoSession from "./sessions/DiarioFaladoSession";
import NapSession from "./sessions/NapSession";
import BreathingSession from "./sessions/BreathingSession";
import SprintPendenciasSession from "./sessions/SprintPendenciasSession";
import PapelCanetaSession from "./sessions/PapelCanetaSession";
import SavedQueueSession from "./sessions/SavedQueueSession";

// Plataformas que compartilham a lógica do TikTokSession.
// Adicionar nova plataforma aqui é suficiente — sem precisar listar cada variante manualmente.
const TIKTOK_LIKE_PLATFORMS: Record<string, string[]> = {
  tiktok:   ["fixed", "prog_videos", "prog_both", "detox"],
  reels:    ["fixed", "prog_videos", "prog_both", "detox"],
  youtube:  ["fixed", "prog_videos", "prog_both", "detox"],
  twitter:  ["fixed", "prog_videos", "prog_both", "detox"],
  reddit:   ["fixed", "prog_videos", "prog_both", "detox"],
  whatsapp: ["fixed", "prog_tasks",  "prog_both", "detox"],
  gamer:    ["fixed", "prog"],
  netflix:  ["episode", "detox"],
  playlist: ["fixed", "prog"],
};

const SESSION_MAP: Record<string, React.ComponentType<any>> = {
  music:    MusicSession,
  tiktok:   TikTokSession,  // entrada raiz sem variante
  splite:   SpliteSession,
  momentum: MomentumSession,
  espresso: EspressoSession,
  rpg:      RPGSession,
  lazyfal:  LazyFalconSession,
  caferitual: CafeRitualSession,
  tabhop:   TabHopSession,
  sing:     SingSession,
  pomodoro: PomodoroSession,
  // Modos de atividade independentes — reutilizam SpliteSession com preset
  agua:        SpliteSession,
  meditar:     SpliteSession,
  ler_diario:  SpliteSession,
  esticar:     SpliteSession,
  livro:       SpliteSession,
  exercicio:   SpliteSession,
  diario_falado: DiarioFaladoSession,
  nap:       NapSession,
  soneca_5:  NapSession,
  soneca_15: NapSession,
  respiracao: BreathingSession,
  sprint_pendencias: SprintPendenciasSession,
  papel_caneta:            PapelCanetaSession,
  papel_caneta_frase:      PapelCanetaSession,
  papel_caneta_estimativa: PapelCanetaSession,
  tiktok_salvos:    SavedQueueSession,
  instagram_salvos: SavedQueueSession,
};

// Registra dinamicamente todas as combinações plataforma_variante
Object.entries(TIKTOK_LIKE_PLATFORMS).forEach(([platform, variants]) => {
  variants.forEach((variant) => {
    SESSION_MAP[`${platform}_${variant}`] = TikTokSession;
  });
});

interface SummaryData {
  durationMinutes: number;
  tasksCompleted: number;
}

interface ModeSessionProps {
  modeId: string;
  mode: Record<string, any> | null | undefined;
  tasks: any[];
  routines?: any[];
  onCompleteTask: (id: string) => Promise<void>;
  onCompleteRoutine?: (id: string) => Promise<void>;
  onAddTask: (task: { title: string; priority: number }) => Promise<void>;
  onAddChecklist?: (parentId: string, description: string) => Promise<void>;
  onToggleChecklist?: (parentId: string, itemId: string) => Promise<void>;
  onAddRoutineChecklist?: (parentId: string, description: string) => Promise<void>;
  onToggleRoutineChecklist?: (parentId: string, itemId: string) => Promise<void>;
  onTaskComplete?: (modeId: string) => void;
  onClose: () => void;
}

export interface ModeSessionHandle {
  triggerClose: () => void;
}

const ModeSession = forwardRef<ModeSessionHandle, ModeSessionProps>(function ModeSession({ modeId, mode, tasks, routines = [], onCompleteTask, onCompleteRoutine, onAddTask, onAddChecklist, onToggleChecklist, onAddRoutineChecklist, onToggleRoutineChecklist, onTaskComplete, onClose }, ref) {
  const [quickAdd, setQuickAdd] = useState<boolean>(false);
  const [confirmingClose, setConfirmingClose] = useState<boolean>(false);
  const [showPostForm, setShowPostForm] = useState<boolean>(false);
  const [showSummary, setShowSummary] = useState<boolean>(false);
  const [summaryData, setSummaryData] = useState<SummaryData | null>(null);
  const startTimeRef = useRef<number>(performance.now());

  // Swipe para fechar (mobile bottom-sheet)
  const swipeTouchY = useRef<number | null>(null);
  const swipeDelta = useRef<number>(0);
  const modalRef = useRef<HTMLDivElement | null>(null);

  const onTouchStart = (e: React.TouchEvent<HTMLDivElement>): void => {
    const tag = (e.target as HTMLElement).tagName.toLowerCase();
    if (['input', 'textarea', 'select', 'button'].includes(tag)) return;
    swipeTouchY.current = e.touches[0].clientY;
    swipeDelta.current = 0;
  };
  const onTouchMove = (e: React.TouchEvent<HTMLDivElement>): void => {
    if (swipeTouchY.current === null) return;
    const delta = e.touches[0].clientY - swipeTouchY.current;
    if (delta < 0) return; // só aceita arrastar para baixo
    swipeDelta.current = delta;
    if (modalRef.current) {
      modalRef.current.style.transform = `translateY(${delta}px)`;
      modalRef.current.style.transition = "none";
    }
  };
  const onTouchEnd = (): void => {
    if (modalRef.current) {
      modalRef.current.style.transform = "";
      modalRef.current.style.transition = "";
    }
    if (swipeDelta.current > 100) handleClose();
    swipeTouchY.current = null;
    swipeDelta.current = 0;
  };

  // Expõe triggerClose() para o componente pai via ref
  useImperativeHandle(ref, () => ({
    triggerClose: () => handleClose(),
  }));

  // Ao fechar a sessão (seja pelo botão X ou ao concluir): mostra resumo antes do formulário pós-sessão
  const handleSessionDone = (tasksCompleted: number = 0): void => {
    setConfirmingClose(false);
    const durationMinutes = Math.max(1, Math.round((performance.now() - startTimeRef.current) / 60000));
    setSummaryData({ durationMinutes, tasksCompleted });
    setShowSummary(true);
  };

  // Intercepta o fechamento para mostrar confirmação (quando o usuário clica X no meio)
  const handleClose = useCallback(() => setConfirmingClose(true), []);

  // Registra ativação do modo ao abrir a sessão
  useEffect(() => {
    if (modeId) logActivation(modeId);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps
  const [qaMode, setQaMode] = useState<string>("task"); // "task" | "subtask"
  const [qaTitle, setQaTitle] = useState<string>("");
  const [qaParent, setQaParent] = useState<string>("");
  const [qaSaving, setQaSaving] = useState<boolean>(false);
  const [qaSuccess, setQaSuccess] = useState<string | null>(null); // "task" | "subtask" | null

  const dialogRef = useDialog(handleClose);

  // Mescla tarefas + rotinas pendentes num array unificado
  const items: any[] = [
    ...tasks,
    ...routines
      .filter((r) => !r.is_completed_today)
      .map((r) => ({ ...r, _isRoutine: true, completed: false })),
  ];

  const activeTasks: any[] = items.filter((t) => !t.completed);

  const openQuickAdd = (mode: string): void => {
    setQaMode(mode);
    setQaTitle("");
    setQaParent("");
    setQaSuccess(null);
    setQuickAdd(true);
  };

  const handleQaSubmit = async (e: React.FormEvent<HTMLFormElement>): Promise<void> => {
    e.preventDefault();
    if (!qaTitle.trim()) return;
    if (qaMode === "subtask" && !qaParent) return;
    setQaSaving(true);
    try {
      if (qaMode === "task") {
        await onAddTask({ title: qaTitle.trim(), priority: 4 });
        setQaSuccess("task");
      } else {
        await wrappedAddChecklist(qaParent, qaTitle.trim());
        setQaSuccess("subtask");
      }
      setQaTitle("");
      setQaParent("");
      setTimeout(() => {
        setQaSuccess(null);
        setQuickAdd(false);
      }, 1200);
    } finally {
      setQaSaving(false);
    }
  };

  // Handlers unificados: despacham para tarefa ou rotina conforme o tipo do item
  const wrappedCompleteTask = async (id: string): Promise<void> => {
    const item = items.find((i) => i.id === id);
    if (item?._isRoutine) {
      await onCompleteRoutine?.(id);
    } else {
      await onCompleteTask(id);
    }
    onTaskComplete?.(modeId);
  };

  const wrappedToggleChecklist = async (parentId: string, itemId: string): Promise<void> => {
    const parent = items.find((i) => i.id === parentId);
    if (parent?._isRoutine) {
      await onToggleRoutineChecklist?.(parentId, itemId);
    } else {
      await onToggleChecklist?.(parentId, itemId);
    }
  };

  const wrappedAddChecklist = async (parentId: string, description: string): Promise<void> => {
    const parent = items.find((i) => i.id === parentId);
    if (parent?._isRoutine) {
      await onAddRoutineChecklist?.(parentId, description);
    } else {
      await onAddChecklist?.(parentId, description);
    }
  };

  const sessionKey: string = mode?.session || modeId;
  const isCustom: boolean = !SESSION_MAP[sessionKey] && mode?.isCustom;
  if (!SESSION_MAP[sessionKey] && !isCustom) {
    console.warn(`[ModeSession] Sessão não encontrada para "${sessionKey}" — usando fallback SpliteSession.`);
  }
  const Session: React.ComponentType<any> | null = SESSION_MAP[sessionKey] ?? (isCustom ? null : SpliteSession);
  const preset: unknown = mode?.preset;

  return (
    <ModalOverlay onClose={handleClose}>
      <div
        className={styles.modal}
        ref={(el) => { dialogRef.current = el; modalRef.current = el; }}
        role="dialog"
        aria-modal="true"
        aria-label={mode?.name ? `Sessão: ${mode.name}` : "Sessão de modo"}
        tabIndex={-1}
        onTouchStart={onTouchStart}
        onTouchMove={onTouchMove}
        onTouchEnd={onTouchEnd}
      >
        {/* ── Resumo pós-sessão ────────────────────────────── */}
        {showSummary && summaryData && (
          <SessionSummary
            mode={mode}
            durationMinutes={summaryData.durationMinutes}
            tasksCompleted={summaryData.tasksCompleted}
            onClose={() => { setShowSummary(false); setShowPostForm(true); }}
            onContinue={() => { setShowSummary(false); startTimeRef.current = performance.now(); }}
          />
        )}

        {/* ── Formulário pós-sessão ─────────────────────────── */}
        {showPostForm ? (
          <PostSessionForm
            modeId={modeId}
            modeName={mode?.name}
            suggestedMinutes={summaryData?.durationMinutes ?? 0}
            onDone={onClose}
          />
        ) : (
          <>
            {/* ── Confirmação de encerramento ─── */}
            {confirmingClose && (
              <div style={{
                position: "sticky", top: 0, zIndex: 10,
                background: "var(--surface)",
                borderBottom: "1px solid var(--border)",
                padding: "14px 18px",
                display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap",
              }}>
                <span style={{ flex: 1, minWidth: 160, fontSize: 13, fontWeight: 600, color: "var(--text)" }}>
                  ⚠️ Encerrar a sessão?
                </span>
                <button
                  onClick={() => handleSessionDone(0)}
                  style={{
                    padding: "7px 12px", borderRadius: "var(--radius-sm)", border: "none",
                    background: "#e05252", color: "#fff", fontWeight: 700, fontSize: 12, cursor: "pointer",
                  }}
                >
                  📝 Registrar e sair
                </button>
                <button
                  onClick={onClose}
                  style={{
                    padding: "7px 12px", borderRadius: "var(--radius-sm)",
                    border: "1px solid var(--border)", background: "var(--surface-2)",
                    color: "var(--text-muted)", fontWeight: 600, fontSize: 12, cursor: "pointer",
                  }}
                >
                  Sair sem registrar
                </button>
                <button
                  onClick={() => setConfirmingClose(false)}
                  style={{
                    padding: "7px 10px", borderRadius: "var(--radius-sm)",
                    border: "1px solid var(--border)", background: "none",
                    color: "var(--text-muted)", fontWeight: 600, fontSize: 12, cursor: "pointer",
                  }}
                >
                  Cancelar
                </button>
              </div>
            )}
            {isCustom ? (
              <CustomModeSession
                mode={mode}
                tasks={items}
                onCompleteTask={wrappedCompleteTask}
                onToggleChecklist={wrappedToggleChecklist}
                onAddChecklist={wrappedAddChecklist}
                onClose={handleClose}
                onComplete={handleSessionDone}
              />
            ) : (
              <Session preset={preset} tasks={items} onCompleteTask={wrappedCompleteTask} onToggleChecklist={wrappedToggleChecklist} onAddChecklist={wrappedAddChecklist} onClose={handleClose} onComplete={handleSessionDone} />
            )}
          </>
        )}

        {/* ── Quick-Add bar ─────────────────────────────────── */}
        <div className={styles.quickAddBar} style={showPostForm ? { display: "none" } : {}}>
          {!quickAdd ? (
            <div className={styles.quickAddBtns}>
              <button className={styles.qaShortcut} onClick={() => openQuickAdd("task")}>
                <span>＋</span> Nova tarefa
              </button>
              <button className={styles.qaShortcut} onClick={() => openQuickAdd("subtask")}>
                <span>＋</span> Subtarefa
              </button>
            </div>
          ) : (
            <div className={styles.quickAddForm}>
              <div className={styles.qaTabs}>
                <button
                  className={`${styles.qaTab} ${qaMode === "task" ? styles.qaTabActive : ""}`}
                  onClick={() => { setQaMode("task"); setQaTitle(""); setQaParent(""); }}
                  type="button"
                >
                  📋 Tarefa
                </button>
                <button
                  className={`${styles.qaTab} ${qaMode === "subtask" ? styles.qaTabActive : ""}`}
                  onClick={() => { setQaMode("subtask"); setQaTitle(""); setQaParent(""); }}
                  type="button"
                >
                  📌 Subtarefa
                </button>
                <button className={styles.qaClose} onClick={() => setQuickAdd(false)} type="button">✕</button>
              </div>

              {qaSuccess ? (
                <div className={styles.qaSuccessMsg}>
                  {qaSuccess === "task" ? "✅ Tarefa criada!" : "✅ Subtarefa adicionada!"}
                </div>
              ) : (
                <form onSubmit={handleQaSubmit} className={styles.qaInputRow}>
                  {qaMode === "subtask" && (
                    <select
                      className={styles.qaSelect}
                      value={qaParent}
                      onChange={(e) => setQaParent(e.target.value)}
                      required
                    >
                      <option value="">Tarefa pai...</option>
                      {activeTasks.map((t) => (
                        <option key={t.id} value={t.id}>{t.title}</option>
                      ))}
                    </select>
                  )}
                  <div className={styles.qaRow}>
                    <input
                      className={styles.qaInput}
                      value={qaTitle}
                      onChange={(e) => setQaTitle(e.target.value)}
                      placeholder={qaMode === "task" ? "Título da nova tarefa..." : "Descrição da subtarefa..."}
                      autoFocus
                      required
                    />
                    <button
                      type="submit"
                      className={styles.qaSubmit}
                      disabled={qaSaving || !qaTitle.trim() || (qaMode === "subtask" && !qaParent)}
                    >
                      {qaSaving ? "…" : "✓"}
                    </button>
                  </div>
                </form>
              )}
            </div>
          )}
        </div>
      </div>
    </ModalOverlay>
  );
});

export default ModeSession;
