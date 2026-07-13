import { useState, useEffect } from "react";
import TaskSelector from "../TaskSelector";
import SubtaskInline from "./SubtaskInline";
import SubtaskFlow from "./SubtaskFlow";
import styles from "./session.module.css";
import { useSessionPersist } from "../../lib/useSessionPersist";

/**
 * Modos de cantar (espelham o padrão do MusicSession):
 *  - preset.variant === "one": Cantar 1 música → concluir 1 tarefa; repetir.
 *  - preset.variant === "ten": Montar uma fila de 10 músicas cantáveis, concluindo
 *    uma tarefa a cada música adicionada.
 */
const QUEUE_SIZE = 10;

export default function SingSession({ preset, tasks, onCompleteTask, onToggleChecklist, onAddChecklist, onClose }) {
  const variant = preset?.variant === "ten" ? "ten" : "one";
  const { saved, persist, clearSaved } = useSessionPersist(`sing:${variant}`);

  const [step,        setStep]        = useState(saved?.step        ?? (variant === "ten" ? "hunt" : "sing"));
  const [completed,   setCompleted]   = useState(saved?.completed   ?? 0);
  const [doneIds,     setDoneIds]     = useState(() => new Set(saved?.doneIds ?? []));
  const [queue,       setQueue]       = useState(saved?.queue       ?? []);
  const [songInput,   setSongInput]   = useState("");
  const [selectedTask, setSelectedTask] = useState(() => {
    if (!saved?.selectedTaskId) return null;
    return tasks.find((t) => t.id === saved.selectedTaskId) || null;
  });
  const [wasRestored, setWasRestored] = useState(!!saved);

  const available = tasks.filter((t) => !t.completed && !doneIds.has(t.id));

  useEffect(() => {
    if (step === "summary" || step === "done") return;
    persist({ step, completed, doneIds: [...doneIds], queue, selectedTaskId: selectedTask?.id ?? null });
  }, [step, completed, doneIds, queue, selectedTask]); // eslint-disable-line

  const handleClose = () => { clearSaved(); onClose(); };

  // Passo "cantar" de retorno conforme a variante
  const singStep = variant === "ten" ? "hunt" : "sing";

  const finishTask = async () => {
    await onCompleteTask(selectedTask.id);
    setDoneIds((p) => new Set([...p, selectedTask.id]));
    setCompleted((c) => c + 1);
    setSelectedTask(null);
    if (variant === "ten" && queue.length >= QUEUE_SIZE) setStep("done");
    else if (available.length - 1 === 0) setStep("summary");
    else setStep(singStep);
  };

  const renderChecklist = (live) =>
    live.checklist?.length > 0 && (
      <SubtaskFlow
        checklist={live.checklist}
        onToggle={(itemId) => onToggleChecklist?.(live.id, itemId)}
        onAllDone={finishTask}
        onSkip={finishTask}
      />
    );

  const emoji = variant === "ten" ? "🎤" : "🎙️";
  const title = variant === "ten" ? "10 Músicas Cantáveis" : "Cantar 1 Música";

  return (
    <div className={styles.root}>
      <div className={styles.header}>
        <span className={styles.headerEmoji}>{emoji}</span>
        <div className={styles.headerMeta}>
          <span className={styles.headerTitle}>{title}</span>
          <span className={styles.headerSub}>
            {variant === "ten" ? `${queue.length}/${QUEUE_SIZE} músicas • ` : ""}{completed} concluída(s)
          </span>
        </div>
        <button className={styles.closeBtn} onClick={handleClose}>✕</button>
      </div>

      <div className={styles.body}>

        {wasRestored && step !== "summary" && step !== "done" && (
          <div className={styles.resumeBanner}>
            ↩ Sessão restaurada — {completed} tarefa(s) concluída(s)
            <button className={styles.resumeDismiss} onClick={() => setWasRestored(false)}>✕</button>
          </div>
        )}

        {/* ── Variante "one": cantar uma música ── */}
        {step === "sing" && (
          <>
            <div className={styles.infoPill}>🎙️ Música {completed + 1}</div>
            <div className={styles.promptBox}>
              <div className={styles.promptTitle}>🎙️ Cante uma música!</div>
              <div className={styles.promptText}>
                Escolha uma música que você ama e cante junto do começo ao fim. Quando terminar, volte para fazer uma tarefa.
              </div>
            </div>
            <button className={`${styles.btn} ${styles.btnPrimary}`} onClick={() => available.length === 0 ? setStep("summary") : setStep("select")}>
              🎵 Cantei! Fazer uma tarefa
            </button>
            <button className={`${styles.btn} ${styles.btnDanger}`} onClick={() => setStep("summary")}>Encerrar sessão</button>
          </>
        )}

        {/* ── Variante "ten": caçar música cantável ── */}
        {step === "hunt" && (
          <>
            <div className={styles.infoPill}>🎤 Fila — {queue.length}/{QUEUE_SIZE} músicas</div>
            <div className={styles.promptBox}>
              <div className={styles.promptTitle}>🎤 Encontre a música cantável #{queue.length + 1}</div>
              <div className={styles.promptText}>Escolha uma música que dá vontade de cantar junto. Quando tiver, registre abaixo.</div>
            </div>
            {queue.length > 0 && (
              <div className={styles.savedTaskList}>
                <span className={styles.sectionLabel}>Na fila até agora</span>
                {queue.map((s, i) => (
                  <div key={i} className={styles.savedTask}><span className={styles.savedTaskTitle}>🎵 {i + 1}. {s}</span></div>
                ))}
              </div>
            )}
            <button className={`${styles.btn} ${styles.btnPrimary}`} onClick={() => setStep("enter")}>🎵 Registrar música</button>
            {queue.length > 0 && (
              <button className={`${styles.btn} ${styles.btnSecondary}`} onClick={() => setStep("summary")}>
                Encerrar com {queue.length} música{queue.length !== 1 ? "s" : ""}
              </button>
            )}
          </>
        )}

        {step === "enter" && (
          <>
            <div className={styles.infoPill}>🎤 Música {queue.length + 1}/{QUEUE_SIZE}</div>
            <div className={styles.promptBox}>
              <div className={styles.promptTitle}>📝 Qual é a música?</div>
              <div className={styles.promptText}>Digite o nome da música (e artista, se quiser).</div>
            </div>
            <div className={styles.actions}>
              <input
                className={styles.input}
                value={songInput}
                onChange={(e) => setSongInput(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter" && songInput.trim()) { setQueue((q) => [...q, songInput.trim()]); setSongInput(""); setStep(available.length === 0 ? "summary" : "select"); } }}
                placeholder="Música — Artista..."
                autoFocus
              />
              <button className={`${styles.btn} ${styles.btnPrimary}`} disabled={!songInput.trim()} onClick={() => { setQueue((q) => [...q, songInput.trim()]); setSongInput(""); setStep(available.length === 0 ? "summary" : "select"); }}>
                ➕ Adicionar à fila
              </button>
              <button className={`${styles.btn} ${styles.btnSecondary}`} onClick={() => setStep("hunt")}>← Voltar</button>
            </div>
          </>
        )}

        {/* ── Selecionar tarefa ── */}
        {step === "select" && (() => {
          const lastSong = variant === "ten" ? queue[queue.length - 1] : null;
          return (
            <>
              {lastSong && <div className={styles.infoPill}>🎤 "{lastSong}" — cante enquanto faz a tarefa!</div>}
              <TaskSelector
                tasks={available}
                onSelect={(t) => { setSelectedTask(t); setStep("working"); }}
                onCancel={() => setStep(singStep)}
              />
            </>
          );
        })()}

        {/* ── Trabalhando na tarefa ── */}
        {step === "working" && selectedTask && (() => {
          const live = tasks.find((t) => t.id === selectedTask.id) || selectedTask;
          const currentSong = variant === "ten" ? queue[queue.length - 1] : null;
          return (
            <>
              <div className={styles.infoPill}>{currentSong ? `🎤 ${currentSong} — cantando!` : "🎙️ Cantando — foco total!"}</div>
              <div className={styles.taskDisplay}>
                <span className={styles.taskName}>{live.title}</span>
                {live.description && <span className={styles.taskMeta}>{live.description}</span>}
                {renderChecklist(live)}
              </div>
              <div className={styles.actions}>
                <button className={`${styles.btn} ${styles.btnSuccess}`} onClick={finishTask}>✅ Tarefa concluída!</button>
                <button className={`${styles.btn} ${styles.btnSecondary}`} onClick={() => setStep("select")}>Trocar tarefa</button>
                <SubtaskInline taskId={live.id} onAdd={onAddChecklist} />
              </div>
            </>
          );
        })()}

        {/* ── Fila de 10 completa ── */}
        {step === "done" && (
          <>
            <div className={styles.summaryBox}>
              <span className={styles.summaryEmoji}>🎤</span>
              <div className={styles.summaryTitle}>Fila de {QUEUE_SIZE} completa!</div>
              <div className={styles.summaryText}>{completed} tarefa{completed !== 1 ? "s" : ""} concluída{completed !== 1 ? "s" : ""} cantando.</div>
            </div>
            <div className={styles.savedTaskList}>
              <span className={styles.sectionLabel}>🎵 Suas {QUEUE_SIZE} músicas cantáveis</span>
              {queue.map((s, i) => (
                <div key={i} className={styles.savedTask}><span className={styles.savedTaskTitle}>{i + 1}. {s}</span></div>
              ))}
            </div>
            <button className={`${styles.btn} ${styles.btnPrimary}`} onClick={handleClose}>🎤 Fechar</button>
          </>
        )}

        {/* ── Resumo ── */}
        {step === "summary" && (
          <>
            <div className={styles.summaryBox}>
              <span className={styles.summaryEmoji}>{emoji}</span>
              <div className={styles.summaryTitle}>Sessão encerrada!</div>
              <div className={styles.summaryText}>{completed > 0 ? `${completed} tarefa(s) concluída(s).` : "Nenhuma tarefa concluída."}</div>
            </div>
            {variant === "ten" && queue.length > 0 && (
              <div className={styles.savedTaskList}>
                <span className={styles.sectionLabel}>🎵 Fila curada ({queue.length} música{queue.length !== 1 ? "s" : ""})</span>
                {queue.map((s, i) => (
                  <div key={i} className={styles.savedTask}><span className={styles.savedTaskTitle}>{i + 1}. {s}</span></div>
                ))}
              </div>
            )}
            <button className={`${styles.btn} ${styles.btnPrimary}`} onClick={handleClose}>Fechar</button>
          </>
        )}

      </div>
    </div>
  );
}
