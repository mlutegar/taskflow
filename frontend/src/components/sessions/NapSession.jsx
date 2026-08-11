import { useState, useEffect, useRef } from "react";
import SessionHeader from "./SessionHeader";
import styles from "./session.module.css";

export default function NapSession({ preset, onClose, onComplete }) {
  const duration = preset?.duration ?? 5; // minutos
  const totalSeconds = duration * 60;

  const [phase, setPhase] = useState("idle"); // idle | running | done
  const [remaining, setRemaining] = useState(totalSeconds);
  const intervalRef = useRef(null);

  useEffect(() => {
    return () => clearInterval(intervalRef.current);
  }, []);

  const start = () => {
    setPhase("running");
    setRemaining(totalSeconds);
    intervalRef.current = setInterval(() => {
      setRemaining((r) => {
        if (r <= 1) {
          clearInterval(intervalRef.current);
          setPhase("done");
          return 0;
        }
        return r - 1;
      });
    }, 1000);
  };

  const cancel = () => {
    clearInterval(intervalRef.current);
    setPhase("idle");
    setRemaining(totalSeconds);
  };

  const mins = Math.floor(remaining / 60);
  const secs = remaining % 60;
  const progress = 1 - remaining / totalSeconds;

  const circumference = 2 * Math.PI * 54;
  const strokeDashoffset = circumference * (1 - progress);

  return (
    <div className={styles.root}>
      <SessionHeader
        emoji={preset?.emoji ?? "😴"}
        title={preset?.name ?? `Soneca de ${duration} min`}
        sub={
          phase === "idle"
            ? "Pronto para descansar?"
            : phase === "running"
            ? `${mins}:${String(secs).padStart(2, "0")} restantes`
            : "Tempo esgotado!"
        }
        onClose={() => { clearInterval(intervalRef.current); onClose(); }}
      />

      <div className={styles.body} style={{ alignItems: "center", gap: 24 }}>

        {/* Círculo de progresso */}
        {phase !== "idle" && (
          <svg width="128" height="128" viewBox="0 0 128 128" style={{ transform: "rotate(-90deg)" }}>
            <circle cx="64" cy="64" r="54" fill="none" stroke="var(--border)" strokeWidth="8" />
            <circle
              cx="64" cy="64" r="54" fill="none"
              stroke={phase === "done" ? "#4ecca3" : "#7986cb"}
              strokeWidth="8"
              strokeLinecap="round"
              strokeDasharray={circumference}
              strokeDashoffset={phase === "done" ? 0 : strokeDashoffset}
              style={{ transition: "stroke-dashoffset 1s linear" }}
            />
          </svg>
        )}

        {phase === "idle" && (
          <div className={styles.promptBox} style={{ textAlign: "center", maxWidth: 320 }}>
            <div className={styles.promptTitle}>
              {preset?.emoji ?? "😴"} Soneca de {duration} min
            </div>
            <div className={styles.promptText}>
              Deite ou recline em posição confortável. O timer vai tocar quando o tempo acabar. Não force dormir — apenas relaxe.
            </div>
          </div>
        )}

        {phase === "running" && (
          <div style={{ textAlign: "center" }}>
            <div style={{ fontSize: 42, fontWeight: 700, color: "#7986cb", fontVariantNumeric: "tabular-nums" }}>
              {mins}:{String(secs).padStart(2, "0")}
            </div>
            <div style={{ fontSize: 13, color: "var(--text-muted)", marginTop: 4 }}>
              relaxando…
            </div>
          </div>
        )}

        {phase === "done" && (
          <div className={styles.summaryBox} style={{ textAlign: "center" }}>
            <span className={styles.summaryEmoji}>⏰</span>
            <div className={styles.summaryTitle}>Soneca concluída!</div>
            <div className={styles.summaryText}>
              Levante devagar, beba água e se movimente um pouco antes de voltar ao trabalho.
            </div>
          </div>
        )}

        {phase === "idle" && (
          <button className={`${styles.btn} ${styles.btnPrimary}`} onClick={start}>
            😴 Iniciar soneca
          </button>
        )}

        {phase === "running" && (
          <button className={`${styles.btn} ${styles.btnDanger}`} onClick={cancel}>
            Cancelar
          </button>
        )}

        {phase === "done" && (
          <button className={`${styles.btn} ${styles.btnPrimary}`} onClick={onComplete ?? onClose}>
            ✅ Acordei! Registrar sessão
          </button>
        )}
      </div>
    </div>
  );
}
