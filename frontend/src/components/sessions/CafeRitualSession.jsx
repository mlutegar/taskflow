import { useState, useEffect } from "react";
import TaskSelector from "../TaskSelector";
import SubtaskInline from "./SubtaskInline";
import SubtaskFlow from "./SubtaskFlow";
import styles from "./session.module.css";
import { useSessionPersist } from "../../lib/useSessionPersist";

export default function CafeRitualSession({ tasks, onCompleteTask, onToggleChecklist, onAddChecklist, onClose }) {
  const { saved, persist, clearSaved } = useSessionPersist("caferitual");

  const [step,         setStep]         = useState(saved?.step         ?? "ritual");
  const [completed,    setCompleted]    = useState(saved?.completed    ?? 0);
  const [cycles,       setCycles]       = useState(saved?.cycles       ?? 0);
  const [songName,     setSongName]     = useState(saved?.songName     ?? "");
  const [songInput,    setSongInput]    = useState("");
  const [doneIds,      setDoneIds]      = useState(() => new Set(saved?.doneIds ?? []));
  const [selectedTask, setSelectedTask] = useState(() => {
    if (!saved?.selectedTaskId) return null;
    return tasks.find((t) => t.id === saved.selectedTaskId) || null;
  });
  const [wasRestored, setWasRestored] = useState(!!saved);

  const available = tasks.filter((t) => !t.completed && !doneIds.has(t.id));

  useEffect(() => {
    if (step === "summary") return;
    persist({ step, completed, cycles, songName, doneIds: [...doneIds], selectedTaskId: selectedTask?.id ?? null });
  }, [step, completed, cycles, songName, doneIds, selectedTask]); // eslint-disable-line

  const handleClose       = () => { clearSaved(); onClose(); };
  const handleSummaryClose = () => { clearSaved(); onClose(); };

  const finishTask = async () => {
    await onCompleteTask(selectedTask.id);
    setDoneIds((p) => new Set([...p, selectedTask.id]));
    setCompleted((c) => c + 1);
    setCycles((c) => c + 1);
    setSelectedTask(null);
    setSongName("");
    setStep(available.length - 1 === 0 ? "summary" : "cycle_done");
  };

  const handleSubtaskToggle = async (taskId, itemId) => {
    const current = tasks.find((t) => t.id === taskId);
    const item = current?.checklist?.find((c) => c.id === itemId);
    const wasCompleted = item?.completed ?? true;
    await onToggleChecklist?.(taskId, itemId);
    if (!wasCompleted) {
      setCompleted((c) => c + 1);
      setCycles((c) => c + 1);
      setSelectedTask(null);
      setSongName("");
      setStep(available.length === 0 ? "summary" : "cycle_done");
    }
  };

  const renderChecklist = (live) =>
    live.checklist?.length > 0 && (
      <SubtaskFlow
        checklist={live.checklist}
        onToggle={(itemId) => handleSubtaskToggle(live.id, itemId)}
        onAllDone={finishTask}
        onSkip={finishTask}
      />
    );

  return (
    <div className={styles.root}>
      {/* ── Header ── */}
      <div className={styles.header}>
        <span className={styles.headerEmoji}>🫖</span>
        <div className={styles.headerMeta}>
          <span className={styles.headerTitle}>Café Ritual</span>
          <span className={styles.headerSub}>
            {cycles > 0 ? `Ciclo ${cycles + 1}` : "Ritual inicial"} • ✅ {completed} concluída{completed !== 1 ? "s" : ""}
          </span>
        </div>
        <button className={styles.closeBtn} onClick={handleClose}>✕</button>
      </div>

      <div className={styles.body}>

        {wasRestored && step !== "ritual" && step !== "summary" && (
          <div className={styles.resumeBanner}>
            ↩ Sessão restaurada — {cycles} ciclo{cycles !== 1 ? "s" : ""}, {completed} tarefa(s)
            <button className={styles.resumeDismiss} onClick={() => setWasRestored(false)}>✕</button>
          </div>
        )}

        {/* ── Etapa 1: Ritual do café ── */}
        {step === "ritual" && (
          <>
            <div className={styles.promptBox}>
              <div className={styles.promptTitle}>
                {cycles === 0 ? "🫖 Prepare seu shot de café" : "🫖 Novo ciclo — prepare outro shot"}
              </div>
              <div className={styles.promptText}>
                {cycles === 0
                  ? "Este é o seu ritual de âncora. Prepare um shot de café quente agora. O momento de tomá-lo marca o início da sua sessão de foco."
                  : "Você completou um ciclo. Para o próximo, prepare outro shot. A consistência do ritual é o que cria o estado de pico."}
              </div>
            </div>
            {cycles > 0 && (
              <div className={styles.infoPill}>
                🔄 Ciclo {cycles + 1} • {completed} tarefa{completed !== 1 ? "s" : ""} esta sessão
              </div>
            )}
            <button
              className={`${styles.btn} ${styles.btnPrimary}`}
              style={{ background: "#d4960a", borderColor: "#d4960a" }}
              onClick={() => setStep("music_hunt")}
            >
              🫖 Shot tomado — vamos caçar a música!
            </button>
            <button className={`${styles.btn} ${styles.btnDanger}`} onClick={handleClose}>
              Sem café, sem ritual
            </button>
          </>
        )}

        {/* ── Etapa 2: Caça à música ── */}
        {step === "music_hunt" && (
          <>
            <div className={styles.infoPill} style={{ color: "#d4960a", borderColor: "rgba(212,150,10,0.3)" }}>
              ☕ Café tomado — agora a música certa
            </div>
            <div className={styles.promptBox}>
              <div className={styles.promptTitle}>🎵 Encontre A música do ciclo</div>
              <div className={styles.promptText}>
                Abra o Spotify e passe por ~100 músicas. Não escolha racionalmente — espere por UMA que faz você sentir que pode fazer qualquer coisa. Quando encontrar, volte aqui.
              </div>
            </div>
            <button
              className={`${styles.btn} ${styles.btnPrimary}`}
              style={{ background: "#d4960a", borderColor: "#d4960a" }}
              onClick={() => setStep("register_song")}
            >
              🎵 Encontrei minha música!
            </button>
            <button className={`${styles.btn} ${styles.btnSecondary}`} onClick={() => setStep("ritual")}>
              ← Voltar ao ritual
            </button>
          </>
        )}

        {/* ── Etapa 3: Registrar a música ── */}
        {step === "register_song" && (
          <>
            <div className={styles.infoPill} style={{ color: "#d4960a", borderColor: "rgba(212,150,10,0.3)" }}>
              🎵 Qual é a música que ressoou?
            </div>
            <div className={styles.promptBox}>
              <div className={styles.promptTitle}>📝 Registre a música</div>
              <div className={styles.promptText}>
                Anote o nome da música (e artista, se quiser). Isso cria um histórico do seu estado de pico.
              </div>
            </div>
            <div className={styles.actions}>
              <input
                className={styles.input}
                value={songInput}
                onChange={(e) => setSongInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && songInput.trim()) {
                    setSongName(songInput.trim());
                    setSongInput("");
                    setStep(available.length === 0 ? "summary" : "select_task");
                  }
                }}
                placeholder="Música — Artista..."
                autoFocus
              />
              <button
                className={`${styles.btn} ${styles.btnPrimary}`}
                style={{ background: "#d4960a", borderColor: "#d4960a" }}
                disabled={!songInput.trim()}
                onClick={() => {
                  setSongName(songInput.trim());
                  setSongInput("");
                  setStep(available.length === 0 ? "summary" : "select_task");
                }}
              >
                ✓ Confirmar e escolher tarefa
              </button>
              <button className={`${styles.btn} ${styles.btnSecondary}`} onClick={() => {
                setSongName("—");
                setStep(available.length === 0 ? "summary" : "select_task");
              }}>
                Pular registro
              </button>
            </div>
          </>
        )}

        {/* ── Etapa 4: Seleção de tarefa ── */}
        {step === "select_task" && (
          <>
            <div className={styles.infoPill} style={{ color: "#d4960a", borderColor: "rgba(212,150,10,0.3)" }}>
              ☕🎵 Estado de pico ativado — escolha sua tarefa
            </div>
            {songName && songName !== "—" && (
              <div className={styles.promptBox}>
                <div className={styles.promptTitle}>🎵 "{songName}"</div>
                <div className={styles.promptText}>
                  Você está no estado de pico. Você pode fazer <strong>qualquer tarefa</strong> agora. Escolha uma.
                </div>
              </div>
            )}
            <TaskSelector
              tasks={available}
              onSelect={(t) => { setSelectedTask(t); setStep("working"); }}
              onCancel={() => setStep("music_hunt")}
            />
          </>
        )}

        {/* ── Etapa 5: Trabalhando ── */}
        {step === "working" && selectedTask && (() => {
          const live = tasks.find((t) => t.id === selectedTask.id) || selectedTask;
          return (
            <>
              <div className={styles.infoPill} style={{ color: "#d4960a", borderColor: "rgba(212,150,10,0.3)" }}>
                {songName && songName !== "—" ? `🎵 ${songName} — foco total!` : "☕ Estado de pico — foco total!"}
              </div>
              <div className={styles.taskDisplay}>
                <span className={styles.taskName}>{live.title}</span>
                {live.description && <span className={styles.taskMeta}>{live.description}</span>}
                {renderChecklist(live)}
              </div>
              <div className={styles.actions}>
                <button className={`${styles.btn} ${styles.btnSuccess}`} onClick={finishTask}>
                  ✅ Tarefa concluída!
                </button>
                <button className={`${styles.btn} ${styles.btnSecondary}`} onClick={() => setStep("select_task")}>
                  Trocar tarefa
                </button>
                <SubtaskInline taskId={live.id} onAdd={onAddChecklist} />
                <button className={`${styles.btn} ${styles.btnDanger}`} onClick={() => setStep("summary")}>
                  ⏹ Encerrar sessão
                </button>
              </div>
            </>
          );
        })()}

        {/* ── Entre ciclos ── */}
        {step === "cycle_done" && (
          <>
            <div className={styles.summaryBox} style={{ borderColor: "rgba(212,150,10,0.25)" }}>
              <span className={styles.summaryEmoji}>✅</span>
              <div className={styles.summaryTitle}>Ciclo {cycles} completo!</div>
              <div className={styles.summaryText}>
                {completed} tarefa{completed !== 1 ? "s" : ""} concluída{completed !== 1 ? "s" : ""} nesta sessão.
              </div>
            </div>
            <div className={styles.promptBox}>
              <div className={styles.promptTitle}>Próximo ciclo?</div>
              <div className={styles.promptText}>
                Cada ciclo começa do zero: novo shot de café, nova música, novo estado de pico. O ritual é o que cria a consistência.
              </div>
            </div>
            <button
              className={`${styles.btn} ${styles.btnPrimary}`}
              style={{ background: "#d4960a", borderColor: "#d4960a" }}
              onClick={() => setStep("ritual")}
            >
              🫖 Novo ciclo — preparar shot
            </button>
            <button className={`${styles.btn} ${styles.btnSecondary}`} onClick={() => setStep("music_hunt")}>
              🎵 Só nova música (sem café)
            </button>
            <button className={`${styles.btn} ${styles.btnDanger}`} onClick={() => setStep("summary")}>
              ⏹ Encerrar sessão
            </button>
          </>
        )}

        {/* ── Sumário ── */}
        {step === "summary" && (
          <>
            <div className={styles.summaryBox} style={{ borderColor: "rgba(212,150,10,0.25)" }}>
              <span className={styles.summaryEmoji}>🫖</span>
              <div className={styles.summaryTitle}>Sessão encerrada!</div>
              <div className={styles.summaryText}>
                {cycles} ciclo{cycles !== 1 ? "s" : ""} • {completed} tarefa{completed !== 1 ? "s" : ""} concluída{completed !== 1 ? "s" : ""}
              </div>
            </div>
            <button className={`${styles.btn} ${styles.btnPrimary}`} onClick={handleSummaryClose}>
              Fechar
            </button>
          </>
        )}

      </div>
    </div>
  );
}
