import { useEffect, useRef } from "react";
import styles from "../DailyFocus.module.css";

// Duração em segundos por variante
const DURATIONS = { "5min": 5 * 60, "15min": 15 * 60 };

export const DEFAULT_STATE = {
  coisa: "",
  variant: "5min",   // "5min" | "15min"
  remaining: 5 * 60,
  running: false,
  done: false,
  rounds: 0,
};

export default function UmaCoisaHelper({ state, onChange, modeConfig }) {
  const s = { ...DEFAULT_STATE, ...state };
  const intervalRef = useRef(null);

  // Detecta variante pelo id do modo (uma_coisa_5min ou uma_coisa_15min)
  const variant = modeConfig?.id === "uma_coisa_15min" ? "15min" : "5min";
  const totalSecs = DURATIONS[variant];

  // Sincroniza variant e remaining ao montar se mudou
  useEffect(() => {
    if (s.variant !== variant) {
      onChange({ ...s, variant, remaining: totalSecs, running: false, done: false });
    }
  }, [variant]);

  // Timer interno
  useEffect(() => {
    if (s.running && s.remaining > 0 && !s.done) {
      intervalRef.current = setInterval(() => {
        onChange((prev) => {
          const cur = { ...DEFAULT_STATE, ...prev };
          if (cur.remaining <= 1) {
            clearInterval(intervalRef.current);
            return { ...cur, remaining: 0, running: false, done: true };
          }
          return { ...cur, remaining: cur.remaining - 1 };
        });
      }, 1000);
    } else {
      clearInterval(intervalRef.current);
    }
    return () => clearInterval(intervalRef.current);
  }, [s.running, s.remaining > 0, s.done]);

  const mins = Math.floor(s.remaining / 60);
  const secs = s.remaining % 60;
  const progress = (totalSecs - s.remaining) / totalSecs;

  const r = 38;
  const circ = 2 * Math.PI * r;

  const toggle = () => onChange({ ...s, running: !s.running });
  const reset = () =>
    onChange({ ...s, remaining: totalSecs, running: false, done: false, rounds: s.rounds + (s.done ? 1 : 0) });

  const handleCoisa = (e) =>
    onChange({ ...s, coisa: e.target.value });

  return (
    <div className={styles.helperPanelBody}>
      {/* Campo: o que você quer fazer */}
      <div>
        <div className={styles.helperInputLabel}>O que você quer fazer?</div>
        <input
          className={styles.helperTextInput}
          type="text"
          placeholder={`Ex.: ler, desenhar, organizar uma coisa…`}
          value={s.coisa}
          onChange={handleCoisa}
          maxLength={80}
        />
      </div>

      {/* Timer visual */}
      <div className={styles.miniTimerWrap}>
        <div className={styles.miniRingWrap}>
          <svg className={styles.miniRing} viewBox="0 0 90 90">
            <circle cx="45" cy="45" r={r} fill="none" stroke="var(--surface-2)" strokeWidth="8" />
            <circle
              cx="45" cy="45" r={r}
              fill="none"
              stroke="#4e9ef5"
              strokeWidth="8"
              strokeLinecap="round"
              strokeDasharray={circ}
              strokeDashoffset={circ * (1 - progress)}
              style={{ transition: "stroke-dashoffset 0.9s linear" }}
            />
          </svg>
          <div className={styles.timeDisplay}>
            <span className={styles.miniTimeText}>
              {s.done
                ? "✓"
                : `${String(mins).padStart(2, "0")}:${String(secs).padStart(2, "0")}`}
            </span>
          </div>
        </div>

        <div className={styles.counterLabel}>
          🎯 {variant === "15min" ? "15 minutos" : "5 minutos"} de foco
        </div>

        <div className={styles.helperRow}>
          {!s.done ? (
            <>
              <button
                className={`${styles.helperSmallBtn} ${!s.running ? styles.helperSmallBtnActive : ""}`}
                onClick={toggle}
                disabled={!s.coisa.trim()}
                title={!s.coisa.trim() ? "Escreva o que você quer fazer primeiro" : ""}
              >
                {s.running ? "⏸ Pausar" : "▶ Iniciar"}
              </button>
              {s.remaining < totalSecs && (
                <button className={styles.helperSmallBtn} onClick={() => onChange({ ...s, remaining: totalSecs, running: false })}>
                  ↺ Reset
                </button>
              )}
            </>
          ) : (
            <button className={`${styles.helperSmallBtn} ${styles.helperSmallBtnActive}`} onClick={reset}>
              ✓ +1 — fazer outra coisa
            </button>
          )}
        </div>
      </div>

      {/* Resumo de rounds */}
      {(s.rounds > 0 || s.done) && (
        <div className={styles.textCenter}>
          <span className={styles.tag}>
            🎯 {s.rounds + (s.done ? 1 : 0)} coisa{s.rounds + (s.done ? 1 : 0) !== 1 ? "s" : ""} feita{s.rounds + (s.done ? 1 : 0) !== 1 ? "s" : ""}
          </span>
        </div>
      )}
    </div>
  );
}
