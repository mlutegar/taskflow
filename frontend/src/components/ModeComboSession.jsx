/**
 * ModeComboSession — Modal para testar dois ou três modos juntos e registrar o resultado.
 * Melhorias:
 *  - Timer automático (stopwatch) que preenche "minutos focados"
 *  - Aviso quando os modos têm tipos diferentes (durante vs entre)
 *  - Undo por 5s antes de salvar definitivamente
 *  - Suporta 2 ou 3 modos via prop `modes` (array)
 */
import { useState, useEffect, useRef } from "react";
import { logCombo } from "../lib/modeComboLog";
import { logUsage } from "../lib/sessionUsageLog";
import styles from "./ModeComboSession.module.css";

const FEELINGS = [
  { id: "flow",       label: "🌊 Flow" },
  { id: "foco",      label: "🎯 Foco" },
  { id: "cansaco",   label: "😴 Cansaço" },
  { id: "distracao", label: "📱 Distração" },
  { id: "ansiedade", label: "😬 Ansiedade" },
  { id: "animado",   label: "⚡ Animado" },
];

const IDLE_REASONS = [
  { id: "distraction",  label: "📱 Distração" },
  { id: "another_task", label: "📋 Outra tarefa" },
  { id: "planned",      label: "☕ Pausa planejada" },
  { id: "tiredness",    label: "😴 Cansaço" },
  { id: "none",         label: "✅ Não fiquei ocioso" },
];

const MAX_STEPS_SHOWN = 4;

function fmtTime(secs) {
  const m = Math.floor(secs / 60);
  const s = secs % 60;
  return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

export default function ModeComboSession({ modes, onClose }) {
  const [worked, setWorked]       = useState(undefined); // true | false | null
  const [minutes, setMinutes]     = useState("");
  const [idleMinutes, setIdleMin] = useState("");
  const [idleReason, setIdleReason] = useState([]);
  const [feeling, setFeeling]     = useState([]);
  // Estados do fluxo: "running" | "form" | "saving" | "saved"
  const [phase, setPhase]       = useState("running");
  const [undoTimer, setUndoTimer] = useState(5); // contagem regressiva para undo

  // Stopwatch
  const [elapsed, setElapsed]   = useState(0); // segundos
  const tickRef                 = useRef(null);

  // Inicia o timer ao montar
  useEffect(() => {
    tickRef.current = setInterval(() => setElapsed((e) => e + 1), 1000);
    return () => clearInterval(tickRef.current);
  }, []);

  // Para o timer quando o usuário vai preencher o form
  const handleEncerrar = () => {
    clearInterval(tickRef.current);
    setMinutes(String(Math.round(elapsed / 60) || ""));
    setPhase("form");
  };

  // Fecha ao pressionar Escape
  useEffect(() => {
    const handler = (e) => { if (e.key === "Escape") onClose(); };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [onClose]);

  const toggleFeeling = (id) =>
    setFeeling((prev) =>
      prev.includes(id) ? prev.filter((f) => f !== id) : [...prev, id]
    );

  const toggleIdleReason = (id) =>
    setIdleReason((prev) =>
      prev.includes(id) ? prev.filter((r) => r !== id) : [...prev, id]
    );

  // Salva com countdown para undo
  const handleSubmit = () => {
    setPhase("saving");
    let count = 5;
    setUndoTimer(count);
    const iv = setInterval(() => {
      count -= 1;
      setUndoTimer(count);
      if (count <= 0) {
        clearInterval(iv);
        const focusedMins = parseInt(minutes, 10) || 0;
        const idleMins = parseInt(idleMinutes, 10) || 0;

        // Log all pairs for combo tracking
        for (let i = 0; i < modes.length; i++) {
          for (let j = i + 1; j < modes.length; j++) {
            logCombo({
              modeIdA: modes[i].id,
              modeIdB: modes[j].id,
              worked,
              focusedMinutes: focusedMins,
              feeling,
            });
          }
        }

        // Log usage for each mode with comboWith set to the other mode IDs joined
        for (let i = 0; i < modes.length; i++) {
          const others = modes.filter((_, idx) => idx !== i);
          const comboWith = others[0]?.id; // primary partner (first other)
          logUsage({
            modeId: modes[i].id,
            worked,
            focusedMinutes: focusedMins,
            idleMinutes: idleMins,
            idleReason,
            feeling,
            comboWith,
          });
        }

        setPhase("saved");
        setTimeout(() => onClose(), 1600);
      }
    }, 1000);
    // Guarda ref para cancelar
    tickRef.current = iv;
  };

  const handleUndo = () => {
    clearInterval(tickRef.current);
    setPhase("form");
    setUndoTimer(5);
  };

  const canSubmit = worked !== undefined;
  const types = [...new Set(modes.map((m) => m.type).filter(Boolean))];
  const typeMismatch = types.length > 1;

  return (
    <div className={styles.overlay} onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className={styles.sheet}>

        {/* Header */}
        <div className={styles.header}>
          <div className={styles.headerLeft}>
            <div className={styles.headerTitle}>
              🔀 {modes.map((m) => m.name).join(" + ")}
            </div>
            <div className={styles.headerSub}>
              {phase === "running"
                ? `⏱ ${fmtTime(elapsed)} · sessão em andamento`
                : "Combo de modos · registre o resultado"}
            </div>
          </div>
          <button className={styles.closeBtn} onClick={onClose} aria-label="Fechar">×</button>
        </div>

        {/* Aviso de tipo misto */}
        {typeMismatch && (
          <div className={styles.typeMismatchBanner}>
            <span>⚠️</span>
            <span>
              {modes.map((m) => `${m.name} (${m.type})`).join(", ")} —
              podem funcionar em fases diferentes da sessão.
            </span>
          </div>
        )}

        {/* Modos lado a lado */}
        <div className={styles.modesGrid}>
          {modes.map((m) => (
            <ModeCard key={m.id} mode={m} />
          ))}
        </div>

        {/* Botão encerrar (fase running) */}
        {phase === "running" && (
          <div className={styles.runningFooter}>
            <button className={styles.encerrarBtn} onClick={handleEncerrar}>
              ✓ Encerrar e registrar
            </button>
          </div>
        )}

        {/* Formulário (fase form) */}
        {phase === "form" && (
          <div className={styles.form}>
            <p className={styles.formTitle}>📝 Registrar resultado</p>

            {/* Funcionou? */}
            <div>
              <div className={styles.fieldLabel}>Funcionou?</div>
              <div className={styles.workedRow}>
                <button
                  className={`${styles.workedBtn} ${worked === true ? styles.workedYes : ""}`}
                  onClick={() => setWorked(true)}
                >
                  ✅ Sim
                </button>
                <button
                  className={`${styles.workedBtn} ${worked === null ? styles.workedMaybe : ""}`}
                  onClick={() => setWorked(null)}
                >
                  🤔 Mais ou menos
                </button>
                <button
                  className={`${styles.workedBtn} ${worked === false ? styles.workedNo : ""}`}
                  onClick={() => setWorked(false)}
                >
                  ❌ Não
                </button>
              </div>
            </div>

            {/* Minutos focados + ociosos */}
            <div className={styles.timesRow}>
              <div>
                <div className={styles.fieldLabel}>Minutos focados</div>
                <div className={styles.minutesRow}>
                  <input
                    className={styles.minutesInput}
                    type="number"
                    min="0"
                    max="480"
                    placeholder="—"
                    value={minutes}
                    onChange={(e) => setMinutes(e.target.value)}
                  />
                  <span className={styles.minutesUnit}>min</span>
                  {elapsed > 0 && (
                    <span className={styles.timerHint}>⏱ timer</span>
                  )}
                </div>
              </div>
              <div>
                <div className={styles.fieldLabel}>Tempo ocioso depois</div>
                <div className={styles.minutesRow}>
                  <input
                    className={styles.minutesInput}
                    type="number"
                    min="0"
                    max="480"
                    placeholder="—"
                    value={idleMinutes}
                    onChange={(e) => setIdleMin(e.target.value)}
                  />
                  <span className={styles.minutesUnit}>min</span>
                </div>
              </div>
            </div>

            {/* Por que ficou ocioso */}
            <div>
              <div className={styles.fieldLabel}>Por que ficou ocioso?</div>
              <div className={styles.chips}>
                {IDLE_REASONS.map((r) => (
                  <button
                    key={r.id}
                    className={`${styles.chip} ${idleReason.includes(r.id) ? styles.chipSelected : ""}`}
                    onClick={() => toggleIdleReason(r.id)}
                  >
                    {r.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Sentimento */}
            <div>
              <div className={styles.fieldLabel}>Como foi?</div>
              <div className={styles.chips}>
                {FEELINGS.map((f) => (
                  <button
                    key={f.id}
                    className={`${styles.chip} ${feeling.includes(f.id) ? styles.chipSelected : ""}`}
                    onClick={() => toggleFeeling(f.id)}
                  >
                    {f.label}
                  </button>
                ))}
              </div>
            </div>

            <button
              className={styles.submitBtn}
              disabled={!canSubmit}
              onClick={handleSubmit}
            >
              Salvar registro
            </button>
          </div>
        )}

        {/* Estado: salvando (com undo) */}
        {phase === "saving" && (
          <div className={styles.savingState}>
            <span className={styles.savingEmoji}>💾</span>
            <span className={styles.savingText}>Salvando em {undoTimer}s…</span>
            <button className={styles.undoBtn} onClick={handleUndo}>
              ↩ Desfazer
            </button>
          </div>
        )}

        {/* Estado: salvo */}
        {phase === "saved" && (
          <div className={styles.savedState}>
            <span className={styles.savedEmoji}>✅</span>
            <span className={styles.savedText}>Combo registrado!</span>
            <span className={styles.savedSub}>
              {modes.map((m) => `${m.emoji} ${m.name}`).join(" + ")}
            </span>
          </div>
        )}
      </div>
    </div>
  );
}

function ModeCard({ mode }) {
  const steps = mode.steps?.slice(0, MAX_STEPS_SHOWN) ?? [];
  return (
    <div className={styles.modeCard} style={{ "--mode-color": mode.color }}>
      <div className={styles.modeCardTop}>
        <span className={styles.modeEmoji}>{mode.emoji}</span>
        <div>
          <div className={styles.modeName}>{mode.name}</div>
          <div className={styles.modeTagline}>{mode.tagline}</div>
        </div>
      </div>
      <div className={styles.modeColorBar} style={{ background: mode.color }} />
      {steps.length > 0 && (
        <ol className={styles.modeSteps}>
          {steps.map((step, i) => (
            <li key={i} className={styles.modeStep}>
              <span className={styles.stepNum} style={{ background: mode.color }}>
                {i + 1}
              </span>
              <span>{step}</span>
            </li>
          ))}
        </ol>
      )}
    </div>
  );
}
