import { useState, useEffect } from "react";
import TaskSelector from "../TaskSelector";
import SessionHeader from "./SessionHeader";
import ResumeBanner from "./ResumeBanner";
import WorkingTask from "./WorkingTask";
import styles from "./session.module.css";
import { useModeSession } from "../../hooks/useModeSession";
import { getSongs, addSong, removeSong, randomSong } from "../../lib/singableSongs";

/**
 * Modos de cantar:
 *  - preset.variant === "one": Cantar 1 música → concluir 1 tarefa; repetir.
 *  - preset.variant === "ten": Montar uma fila de 10 músicas cantáveis, concluindo
 *    uma tarefa a cada música adicionada.
 * Em ambos, é possível sortear (🎲) uma música da lista editável.
 */
const QUEUE_SIZE = 10;

/** Gerenciador compacto da lista de músicas cantáveis (adicionar/remover). */
function SongManager({ songs, onAdd, onRemove }) {
  const [input, setInput] = useState("");
  const submit = () => { onAdd(input); setInput(""); };
  return (
    <details className={styles.promptBox} style={{ padding: "10px 12px" }}>
      <summary style={{ cursor: "pointer", fontSize: 13 }}>🎵 Minhas músicas cantáveis ({songs.length})</summary>
      <div className={styles.savedTaskList} style={{ marginTop: 8 }}>
        {songs.map((s) => (
          <div key={s} style={{ display: "flex", gap: 6, alignItems: "center" }}>
            <span className={styles.savedTaskTitle} style={{ flex: 1 }}>{s}</span>
            <button
              className={`${styles.btn} ${styles.btnSecondary}`}
              style={{ flex: "0 0 auto", padding: "0 10px" }}
              onClick={() => onRemove(s)}
              aria-label={`Remover ${s}`}
            >✕</button>
          </div>
        ))}
      </div>
      <div className={styles.actionsRow} style={{ marginTop: 8 }}>
        <input
          className={styles.input}
          placeholder="Nova música — Artista..."
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter") submit(); }}
        />
        <button className={`${styles.btn} ${styles.btnPrimary}`} onClick={submit} disabled={!input.trim()}>＋</button>
      </div>
    </details>
  );
}

export default function SingSession({ preset, tasks, onCompleteTask, onToggleChecklist, onAddChecklist, onClose }) {
  const variant = preset?.variant === "ten" ? "ten" : "one";
  const {
    persist, clearSaved, saved,
    completed, setCompleted,
    doneIds, addDone,
    selectedTask, setSelectedTask,
    wasRestored, setWasRestored,
    available,
  } = useModeSession(`sing:${variant}`, tasks);

  const [step,      setStep]      = useState(saved?.step  ?? (variant === "ten" ? "hunt" : "sing"));
  const [queue,     setQueue]     = useState(saved?.queue ?? []);
  const [songInput, setSongInput] = useState("");
  const [songs,     setSongs]     = useState(() => getSongs());
  const [suggestion, setSuggestion] = useState(() => randomSong());

  useEffect(() => {
    if (step === "summary" || step === "done") return;
    persist({ step, completed, doneIds: [...doneIds], queue, selectedTaskId: selectedTask?.id ?? null });
  }, [step, completed, doneIds, queue, selectedTask]); // eslint-disable-line

  const handleClose = () => { clearSaved(); onClose(); };
  const singStep = variant === "ten" ? "hunt" : "sing";

  const reroll = () => setSuggestion(randomSong(suggestion));
  const handleAddSong = (name) => { const list = addSong(name); setSongs(list); };
  const handleRemoveSong = (name) => { const list = removeSong(name); setSongs(list); if (suggestion === name) setSuggestion(randomSong(name)); };

  const finishTask = async () => {
    await onCompleteTask(selectedTask.id);
    addDone(selectedTask.id);
    setCompleted((c) => c + 1);
    setSelectedTask(null);
    if (variant === "ten" && queue.length >= QUEUE_SIZE) setStep("done");
    else if (available.length - 1 === 0) setStep("summary");
    else setStep(singStep);
  };

  const registerQueueSong = (name) => {
    setQueue((q) => [...q, name]);
    setSongInput("");
    setStep(available.length === 0 ? "summary" : "select");
  };

  const emoji = variant === "ten" ? "🎤" : "🎙️";
  const title = variant === "ten" ? "10 Músicas Cantáveis" : "Cantar 1 Música";

  const suggestionBox = suggestion && (
    <div className={styles.promptBox}>
      <div className={styles.promptText}>
        🎲 Sugestão: <strong>{suggestion}</strong>
      </div>
      <div className={styles.actionsRow} style={{ marginTop: 8 }}>
        <button className={`${styles.btn} ${styles.btnSecondary}`} onClick={reroll}>🎲 Sortear outra</button>
        {variant === "ten" && (
          <button className={`${styles.btn} ${styles.btnPrimary}`} onClick={() => registerQueueSong(suggestion)}>
            ➕ Usar na fila
          </button>
        )}
      </div>
    </div>
  );

  return (
    <div className={styles.root}>
      <SessionHeader
        emoji={emoji}
        title={title}
        sub={`${variant === "ten" ? `${queue.length}/${QUEUE_SIZE} músicas • ` : ""}${completed} concluída(s)`}
        onClose={handleClose}
      />

      <div className={styles.body}>
        <ResumeBanner show={wasRestored && step !== "summary" && step !== "done"} onDismiss={() => setWasRestored(false)}>
          ↩ Sessão restaurada — {completed} tarefa(s) concluída(s)
        </ResumeBanner>

        {/* ── Variante "one": cantar uma música ── */}
        {step === "sing" && (
          <>
            <div className={styles.infoPill}>🎙️ Música {completed + 1}</div>
            <div className={styles.promptBox}>
              <div className={styles.promptTitle}>🎙️ Cante uma música!</div>
              <div className={styles.promptText}>
                Escolha uma música que você ama (ou use a sugestão) e cante junto do começo ao fim. Quando terminar, volte para fazer uma tarefa.
              </div>
            </div>
            {suggestionBox}
            <SongManager songs={songs} onAdd={handleAddSong} onRemove={handleRemoveSong} />
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
              <div className={styles.promptText}>Escolha uma música que dá vontade de cantar junto (ou use a sugestão). Depois registre.</div>
            </div>
            {suggestionBox}
            {queue.length > 0 && (
              <div className={styles.savedTaskList}>
                <span className={styles.sectionLabel}>Na fila até agora</span>
                {queue.map((s, i) => (
                  <div key={i} className={styles.savedTask}><span className={styles.savedTaskTitle}>🎵 {i + 1}. {s}</span></div>
                ))}
              </div>
            )}
            <SongManager songs={songs} onAdd={handleAddSong} onRemove={handleRemoveSong} />
            <button className={`${styles.btn} ${styles.btnPrimary}`} onClick={() => setStep("enter")}>🎵 Registrar música manualmente</button>
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
                onKeyDown={(e) => { if (e.key === "Enter" && songInput.trim()) registerQueueSong(songInput.trim()); }}
                placeholder="Música — Artista..."
                autoFocus
              />
              <button className={`${styles.btn} ${styles.btnPrimary}`} disabled={!songInput.trim()} onClick={() => registerQueueSong(songInput.trim())}>
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
            <WorkingTask
              task={live}
              badge={<div className={styles.infoPill}>{currentSong ? `🎤 ${currentSong} — cantando!` : "🎙️ Cantando — foco total!"}</div>}
              completeLabel="✅ Tarefa concluída!"
              onComplete={finishTask}
              onToggleChecklist={onToggleChecklist}
              onAddChecklist={onAddChecklist}
              onSwap={() => setStep("select")}
            />
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
