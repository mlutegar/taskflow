/**
 * ModeComboSession — Modal para testar dois modos juntos e registrar o resultado.
 * Melhorias:
 *  - Timer automático (stopwatch) que preenche "minutos focados"
 *  - Aviso quando os dois modos têm tipos diferentes (durante vs entre)
 *  - Undo por 5s antes de salvar definitivamente
 */
import { useState, useEffect, useRef } from "react";
import { logCombo } from "../lib/modeComboLog";
import styles from "./ModeComboSession.module.css";

const FEELINGS = [
  { id: "flow",       label: "🌊 Flow" },
  { id: "foco",      label: "🎯 Foco" },
  { id: "cansaco",   label: "😴 Cansaço" },
  { id: "distracao", label: "📱 Distração" },
  { id: "ansiedade", label: "😬 Ansiedade" },
  { id: "animado",   label: "⚡ Animado" },
];

const MAX_STEPS_SHOWN = 4;

function fmtTime(secs) {
  const m = Math.floor(secs / 60);
  const s = secs % 60;
  return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

export default function ModeComboSession({ modeA, modeB, onClose }) {
  const [worked, setWorked]     = useState(undefined); // true | false | null
  const [minutes, setMinutes]   = useState("");
  const [feeling, setFeeling]   = useState([]);
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
        logCombo({
          modeIdA: modeA.id,
          modeIdB: modeB.id,
          worked,
          focusedMinutes: parseInt(minutes, 10) || 0,
          feeling,
        });
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
  const typeMismatch = modeA.type && modeB.type && modeA.type !== modeB.type;

  return (
    <div className={styles.overlay} onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className={styles.sheet}>

        {/* Header */}
        <div className={styles.header}>
          <div className={styles.headerLeft}>
            <div className={styles.headerTitle}>
              🔀 {modeA.name} + {modeB.name}
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
              <strong>{modeA.name}</strong> é um modo <em>{modeA.type}</em> tarefas e{" "}
              <strong>{modeB.name}</strong> é um modo <em>{modeB.type}</em> tarefas —
              podem funcionar em fases diferentes da sessão.
            </span>
          </div>
        )}

        {/* Dois modos lado a lado */}
        <div className={styles.modesGrid}>
          <ModeCard mode={modeA} />
          <ModeCard mode={modeB} />
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

            {/* Minutos focados (pré-preenchido pelo timer) */}
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
                  <span className={styles.timerHint}>⏱ medido pelo timer</span>
                )}
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
              {modeA.emoji} {modeA.name} + {modeB.emoji} {modeB.name}
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
