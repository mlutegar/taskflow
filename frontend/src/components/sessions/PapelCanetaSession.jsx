import { useState, useEffect, useRef } from "react";
import CountdownTimer from "../CountdownTimer";
import BaseSession from "./BaseSession";
import styles from "./session.module.css";
import { useSessionPersist } from "../../lib/useSessionPersist";

const TIMER_OPTIONS = [
  { label: "5 min",  seconds: 300 },
  { label: "10 min", seconds: 600 },
  { label: "15 min", seconds: 900 },
  { label: "25 min", seconds: 1500 },
  { label: "30 min", seconds: 1800 },
  { label: "45 min", seconds: 2700 },
];

export default function PapelCanetaSession({ preset, onClose, onComplete }) {
  const variant   = preset?.variant ?? "default"; // "default" | "frase" | "estimativa"
  const persistKey = `papel_caneta_${variant}`;
  const { saved, persist, clearSaved } = useSessionPersist(persistKey);

  const [step,        setStep]        = useState(saved?.step      ?? "write");
  const [taskText,    setTaskText]    = useState(saved?.taskText   ?? "");
  const [estimate,    setEstimate]    = useState(saved?.estimate   ?? "");
  const [timerSecs,   setTimerSecs]   = useState(saved?.timerSecs ?? null);
  const [startedAt,   setStartedAt]   = useState(saved?.startedAt ?? null);
  const [completed,   setCompleted]   = useState(saved?.completed ?? 0);
  const [history,     setHistory]     = useState(saved?.history    ?? []); // { text, estimate, actual }
  const [wasRestored, setWasRestored] = useState(!!saved);

  const textareaRef = useRef(null);

  useEffect(() => {
    if (step === "summary") return;
    persist({ step, taskText, estimate, timerSecs, startedAt, completed, history });
  }, [step, taskText, estimate, timerSecs, startedAt, completed, history]); // eslint-disable-line

  useEffect(() => {
    if (step === "write" && textareaRef.current) {
      textareaRef.current.focus();
    }
  }, [step]);

  const handleClose        = () => { clearSaved(); onClose(); };
  const handleSummaryClose = () => { clearSaved(); if (onComplete) onComplete(); else onClose(); };

  const startExecuting = () => {
    if (!taskText.trim()) return;
    setStartedAt(Date.now());
    setStep("execute");
  };

  const handleDone = () => {
    const actualMs  = startedAt ? Date.now() - startedAt : null;
    const actualMin = actualMs ? Math.round(actualMs / 60000) : null;
    setHistory((h) => [...h, { text: taskText, estimate, actual: actualMin }]);
    setCompleted((c) => c + 1);
    setTaskText("");
    setEstimate("");
    setTimerSecs(null);
    setStartedAt(null);
    setStep("crossed");
  };

  const isEstimativa = variant === "estimativa";
  const isFrase      = variant === "frase";

  const emoji = isFrase ? "🖊️" : isEstimativa ? "⏱️" : "✍️";
  const title = isFrase ? "Papel & Caneta: Uma Frase"
              : isEstimativa ? "Papel & Caneta: Estimativa"
              : "Papel & Caneta";

  return (
    <BaseSession
      emoji={emoji}
      title={title}
      sub={`${completed} tarefa(s) concluída(s)`}
      onClose={handleClose}
      showResume={wasRestored && step !== "write" && step !== "summary"}
      resumeMessage={`↩ Sessão restaurada — ${completed} tarefa(s) concluída(s)`}
      onDismissResume={() => setWasRestored(false)}
    >
      {/* ── STEP: WRITE ───────────────────────────────────── */}
      {step === "write" && (
        <>
          <div className={styles.promptBox}>
            <div className={styles.promptTitle}>
              {isFrase ? "✍️ Escreva UMA frase no papel" : "✍️ O que você vai fazer agora?"}
            </div>
            <div className={styles.promptText}>
              {isFrase
                ? "Uma frase. Nada mais. Quanto mais específico, melhor."
                : "Seja específico o suficiente para outra pessoa executar. Se ficou vago, reescreva."}
            </div>
          </div>

          <textarea
            ref={textareaRef}
            className={styles.writeInput}
            placeholder={
              isFrase
                ? "ex: adicionar o filtro de datas na tela de relatórios"
                : "ex: adicionar a função para que o mediador possa aprovar propostas"
            }
            value={taskText}
            onChange={(e) => {
              // Em modo "frase", limitar a uma única linha
              const val = isFrase ? e.target.value.replace(/\n/g, "") : e.target.value;
              setTaskText(val);
            }}
            rows={isFrase ? 1 : 3}
            onKeyDown={(e) => {
              if (e.key === "Enter" && (isFrase || e.metaKey || e.ctrlKey)) {
                e.preventDefault();
                if (taskText.trim()) startExecuting();
              }
            }}
          />

          {isEstimativa && (
            <div className={styles.estimateRow}>
              <span className={styles.estimateLabel}>⏱ Estimativa:</span>
              <input
                className={styles.estimateInput}
                type="text"
                placeholder="ex: 20 min"
                value={estimate}
                onChange={(e) => setEstimate(e.target.value)}
              />
            </div>
          )}

          {!isFrase && (
            <div className={styles.timerPicker}>
              <span className={styles.timerPickerLabel}>⏲ Timer opcional:</span>
              <div className={styles.timerOptions}>
                {TIMER_OPTIONS.map((opt) => (
                  <button
                    key={opt.seconds}
                    className={`${styles.timerOption} ${timerSecs === opt.seconds ? styles.timerOptionActive : ""}`}
                    onClick={() => setTimerSecs((s) => s === opt.seconds ? null : opt.seconds)}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            </div>
          )}

          <button
            className={`${styles.btn} ${styles.btnPrimary}`}
            disabled={!taskText.trim()}
            onClick={startExecuting}
          >
            ▶ Já escrevi — vou executar
          </button>
          <button className={`${styles.btn} ${styles.btnDanger}`} onClick={handleClose}>
            Cancelar
          </button>
        </>
      )}

      {/* ── STEP: EXECUTE ─────────────────────────────────── */}
      {step === "execute" && (
        <>
          <div className={styles.infoPill}>
            Execute exatamente o que está escrito — nem mais, nem menos.
          </div>

          <div className={`${styles.taskDisplay} ${styles.taskDisplayPaper}`}>
            <span className={styles.taskMeta}>📝 O que você escreveu:</span>
            <span className={styles.taskName}>{taskText}</span>
            {isEstimativa && estimate && (
              <span className={styles.taskMeta}>⏱ Estimativa: {estimate}</span>
            )}
          </div>

          {timerSecs ? (
            <CountdownTimer
              seconds={timerSecs}
              title={taskText}
              onComplete={() => setStep("post_timer")}
              onCancel={handleDone}
            />
          ) : (
            <button className={`${styles.btn} ${styles.btnSuccess}`} onClick={handleDone}>
              ✅ Concluído — riscar no papel
            </button>
          )}

          <button className={`${styles.btn} ${styles.btnSecondary}`} onClick={() => setStep("write")}>
            ← Reescrever tarefa
          </button>
        </>
      )}

      {/* ── STEP: POST TIMER ──────────────────────────────── */}
      {step === "post_timer" && (
        <>
          <div className={styles.promptBox}>
            <div className={styles.promptTitle}>⏰ Tempo esgotado!</div>
            <div className={styles.promptText}>Você concluiu o que escreveu?</div>
          </div>
          <div className={styles.taskDisplay}>
            <span className={styles.taskName}>{taskText}</span>
          </div>
          <button className={`${styles.btn} ${styles.btnSuccess}`} onClick={handleDone}>
            ✅ Sim — riscar no papel
          </button>
          <button className={`${styles.btn} ${styles.btnPrimary}`} onClick={() => setStep("execute")}>
            🔄 Ainda não — continuar
          </button>
        </>
      )}

      {/* ── STEP: CROSSED ─────────────────────────────────── */}
      {step === "crossed" && (
        <>
          <div className={styles.promptBox}>
            <div className={styles.promptTitle}>✏️ Risque no papel!</div>
            <div className={styles.promptText}>
              Riscou? Ótimo. Próxima tarefa ou encerrar a sessão?
            </div>
          </div>
          {isEstimativa && history.length > 0 && (() => {
            const last = history[history.length - 1];
            return last.actual != null && last.estimate ? (
              <div className={styles.estimateFeedback}>
                <span>Estimativa: <strong>{last.estimate}</strong></span>
                <span>Tempo real: <strong>{last.actual} min</strong></span>
              </div>
            ) : null;
          })()}
          <button className={`${styles.btn} ${styles.btnPrimary}`} onClick={() => setStep("write")}>
            ✍️ Próxima tarefa
          </button>
          <button className={`${styles.btn} ${styles.btnSecondary}`} onClick={() => setStep("summary")}>
            ⏹ Encerrar sessão
          </button>
        </>
      )}

      {/* ── STEP: SUMMARY ─────────────────────────────────── */}
      {step === "summary" && (
        <>
          <div className={styles.summaryBox}>
            <span className={styles.summaryEmoji}>{emoji}</span>
            <div className={styles.summaryTitle}>
              {completed > 0 ? `${completed} tarefa(s) riscada(s)!` : "Sessão encerrada."}
            </div>
            {isEstimativa && history.some((h) => h.actual != null) && (
              <div className={styles.summaryText}>
                {history.filter((h) => h.actual != null).map((h, i) => (
                  <div key={i} className={styles.estimateLine}>
                    <span className={styles.estimateLineText}>{h.text}</span>
                    {h.estimate && (
                      <span className={styles.estimateLineMeta}>
                        est. {h.estimate} → real {h.actual} min
                      </span>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
          <button className={`${styles.btn} ${styles.btnPrimary}`} onClick={handleSummaryClose}>
            📝 Registrar uso
          </button>
        </>
      )}
    </BaseSession>
  );
}
