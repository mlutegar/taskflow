import { useState, useEffect, useRef } from "react";
import SessionHeader from "./SessionHeader";
import styles from "./session.module.css";

// Técnica 4-7-8: inspira 4s, segura 7s, expira 8s
const PHASES = [
  { key: "inhale",  label: "Inspire",   emoji: "🫁", duration: 4,  color: "#4ea8cc", instruction: "Inspire pelo nariz lentamente" },
  { key: "hold",    label: "Segure",    emoji: "🤐", duration: 7,  color: "#7986cb", instruction: "Segure o ar" },
  { key: "exhale",  label: "Expire",    emoji: "💨", duration: 8,  color: "#4ecca3", instruction: "Expire pela boca com som de 'SHHH'" },
];

const CYCLE_GOAL = 4; // número de ciclos recomendados

export default function BreathingSession({ preset, onClose, onComplete }) {
  const [phase, setPhase] = useState("idle"); // idle | breathing | done
  const [phaseIndex, setPhaseIndex] = useState(0);
  const [remaining, setRemaining] = useState(PHASES[0].duration);
  const [cycle, setCycle] = useState(1);
  const intervalRef = useRef(null);

  useEffect(() => {
    return () => clearInterval(intervalRef.current);
  }, []);

  const start = () => {
    setPhase("breathing");
    setPhaseIndex(0);
    setRemaining(PHASES[0].duration);
    setCycle(1);
    runTimer(0, 1);
  };

  const runTimer = (pIdx, cycleNum) => {
    clearInterval(intervalRef.current);
    const phaseDuration = PHASES[pIdx].duration;
    let r = phaseDuration;
    setRemaining(phaseDuration);

    intervalRef.current = setInterval(() => {
      r -= 1;
      setRemaining(r);
      if (r <= 0) {
        clearInterval(intervalRef.current);
        const nextPIdx = (pIdx + 1) % PHASES.length;
        const nextCycle = nextPIdx === 0 ? cycleNum + 1 : cycleNum;

        if (nextPIdx === 0 && cycleNum >= CYCLE_GOAL) {
          setPhase("done");
        } else {
          setPhaseIndex(nextPIdx);
          setCycle(nextCycle);
          runTimer(nextPIdx, nextCycle);
        }
      }
    }, 1000);
  };

  const stop = () => {
    clearInterval(intervalRef.current);
    setPhase("idle");
    setPhaseIndex(0);
    setRemaining(PHASES[0].duration);
    setCycle(1);
  };

  const currentPhase = PHASES[phaseIndex];
  const progress = phase === "breathing" ? 1 - remaining / currentPhase.duration : 0;
  const circumference = 2 * Math.PI * 54;
  const strokeDashoffset = circumference * (1 - progress);

  return (
    <div className={styles.root}>
      <SessionHeader
        emoji="🌬️"
        title="Respiração 4-7-8"
        sub={
          phase === "idle"
            ? `${CYCLE_GOAL} ciclos recomendados • ~${CYCLE_GOAL * 19}s`
            : phase === "breathing"
            ? `Ciclo ${cycle} de ${CYCLE_GOAL} • ${currentPhase.label}`
            : "Sessão concluída!"
        }
        onClose={() => { clearInterval(intervalRef.current); onClose(); }}
      />

      <div className={styles.body} style={{ alignItems: "center", gap: 20 }}>

        {phase === "idle" && (
          <>
            <div className={styles.promptBox} style={{ maxWidth: 340 }}>
              <div className={styles.promptTitle}>🌬️ Técnica 4-7-8</div>
              <div className={styles.promptText}>
                Criada pelo Dr. Andrew Weil, a respiração 4-7-8 ativa o sistema nervoso parassimpático em menos de 2 minutos.
              </div>
              <div style={{ marginTop: 8, display: "flex", flexDirection: "column", gap: 6 }}>
                {PHASES.map((p) => (
                  <div key={p.key} style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13, color: "var(--text-muted)" }}>
                    <span style={{ fontSize: 16 }}>{p.emoji}</span>
                    <span style={{ color: p.color, fontWeight: 600, minWidth: 60 }}>{p.label}</span>
                    <span>{p.duration}s — {p.instruction}</span>
                  </div>
                ))}
              </div>
            </div>

            <button className={`${styles.btn} ${styles.btnPrimary}`} onClick={start}>
              🌬️ Iniciar respiração
            </button>
          </>
        )}

        {phase === "breathing" && (
          <>
            {/* Círculo de progresso da fase atual */}
            <div style={{ position: "relative", display: "flex", alignItems: "center", justifyContent: "center" }}>
              <svg width="140" height="140" viewBox="0 0 128 128" style={{ transform: "rotate(-90deg)" }}>
                <circle cx="64" cy="64" r="54" fill="none" stroke="var(--border)" strokeWidth="8" />
                <circle
                  cx="64" cy="64" r="54" fill="none"
                  stroke={currentPhase.color}
                  strokeWidth="8"
                  strokeLinecap="round"
                  strokeDasharray={circumference}
                  strokeDashoffset={strokeDashoffset}
                  style={{ transition: "stroke-dashoffset 1s linear, stroke 0.5s" }}
                />
              </svg>
              <div style={{ position: "absolute", textAlign: "center" }}>
                <div style={{ fontSize: 28 }}>{currentPhase.emoji}</div>
                <div style={{ fontSize: 26, fontWeight: 700, color: currentPhase.color, fontVariantNumeric: "tabular-nums" }}>
                  {remaining}s
                </div>
              </div>
            </div>

            <div style={{ textAlign: "center" }}>
              <div style={{ fontSize: 18, fontWeight: 700, color: currentPhase.color }}>{currentPhase.label}</div>
              <div style={{ fontSize: 13, color: "var(--text-muted)", marginTop: 4 }}>{currentPhase.instruction}</div>
              <div style={{ fontSize: 12, color: "var(--text-muted)", marginTop: 8 }}>
                Ciclo {cycle} de {CYCLE_GOAL}
              </div>
            </div>

            {/* Indicadores das fases */}
            <div style={{ display: "flex", gap: 8 }}>
              {PHASES.map((p, i) => (
                <div
                  key={p.key}
                  style={{
                    padding: "4px 10px",
                    borderRadius: 20,
                    fontSize: 12,
                    fontWeight: i === phaseIndex ? 700 : 400,
                    background: i === phaseIndex ? p.color + "22" : "var(--surface-2)",
                    color: i === phaseIndex ? p.color : "var(--text-muted)",
                    border: `1px solid ${i === phaseIndex ? p.color : "var(--border)"}`,
                    transition: "all 0.3s",
                  }}
                >
                  {p.emoji} {p.label} {p.duration}s
                </div>
              ))}
            </div>

            <button className={`${styles.btn} ${styles.btnDanger}`} onClick={stop}>
              Parar
            </button>
          </>
        )}

        {phase === "done" && (
          <>
            <div className={styles.summaryBox} style={{ textAlign: "center" }}>
              <span className={styles.summaryEmoji}>🌬️</span>
              <div className={styles.summaryTitle}>{CYCLE_GOAL} ciclos completos!</div>
              <div className={styles.summaryText}>
                Seu sistema nervoso foi ativado. Você deve sentir mais calma e clareza nos próximos minutos.
              </div>
            </div>
            <button className={`${styles.btn} ${styles.btnPrimary}`} onClick={onComplete ?? onClose}>
              ✅ Registrar sessão
            </button>
          </>
        )}
      </div>
    </div>
  );
}
