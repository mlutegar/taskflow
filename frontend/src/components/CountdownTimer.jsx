import { useState, useEffect, useRef, useCallback } from "react";
import styles from "./CountdownTimer.module.css";

export default function CountdownTimer({ seconds, title, onComplete, onCancel }) {
  const [paused, setPaused] = useState(false);
  const [displayRemaining, setDisplayRemaining] = useState(seconds);

  // Referências para não recriar o interval ao cada mudança de estado
  const startedAtRef        = useRef(null);       // Date.now() do último (re)início
  const remainingAtPauseRef = useRef(seconds);    // segundos restantes no momento da pausa
  const firedRef            = useRef(false);
  const intervalRef         = useRef(null);
  const pausedRef           = useRef(false);
  const onCompleteRef       = useRef(onComplete);

  // Mantém a ref do callback atualizada sem recriar o interval
  useEffect(() => { onCompleteRef.current = onComplete; }, [onComplete]);

  // Pede permissão de notificação ao montar (uma vez)
  useEffect(() => {
    if ("Notification" in window && Notification.permission === "default") {
      Notification.requestPermission();
    }
  }, []);

  const fire = useCallback(() => {
    if (!firedRef.current) {
      firedRef.current = true;
      setTimeout(() => onCompleteRef.current?.(), 50);
      // Notificação nativa quando o timer termina em background
      if ("Notification" in window && Notification.permission === "granted") {
        try {
          new Notification("⏱️ Timer concluído!", {
            body: title || "Seu timer chegou ao fim.",
            icon: "/taskflow/icon.svg",
            tag: "taskflow-timer",
            renotify: true,
          });
        } catch {}
      }
    }
  }, [title]);

  const tick = useCallback(() => {
    if (startedAtRef.current === null) return;
    const elapsed = Math.floor((Date.now() - startedAtRef.current) / 1000);
    const left = Math.max(0, remainingAtPauseRef.current - elapsed);
    setDisplayRemaining(left);
    if (left === 0) {
      clearInterval(intervalRef.current);
      fire();
    }
  }, [fire]);

  // Inicia / reinicia o interval quando sai do estado pausado
  useEffect(() => {
    if (paused) {
      clearInterval(intervalRef.current);
      return;
    }

    startedAtRef.current = Date.now();
    intervalRef.current = setInterval(tick, 500);

    return () => clearInterval(intervalRef.current);
  }, [paused, tick]);

  // Page Visibility API — quando o app volta ao primeiro plano, recalcula imediatamente
  useEffect(() => {
    const onVisibility = () => {
      if (document.visibilityState === "visible" && !pausedRef.current) {
        tick(); // força um re-render imediato com o tempo correto
      }
    };
    document.addEventListener("visibilitychange", onVisibility);
    return () => document.removeEventListener("visibilitychange", onVisibility);
  }, [tick]);

  const handlePause = () => {
    const nowPaused = !paused;
    pausedRef.current = nowPaused;

    if (nowPaused) {
      // Salva exatamente quanto tempo resta neste instante
      const elapsed = Math.floor((Date.now() - (startedAtRef.current ?? Date.now())) / 1000);
      remainingAtPauseRef.current = Math.max(0, remainingAtPauseRef.current - elapsed);
      startedAtRef.current = null;
    }

    setPaused(nowPaused);
  };

  const mins = Math.floor(displayRemaining / 60);
  const secs = displayRemaining % 60;
  const r = 52;
  const circ = 2 * Math.PI * r;
  const progress = (seconds - displayRemaining) / seconds;

  return (
    <div className={styles.root}>
      <div className={styles.ringWrap}>
        <svg className={styles.ring} viewBox="0 0 120 120">
          <circle cx="60" cy="60" r={r} className={styles.ringBg} />
          <circle
            cx="60" cy="60" r={r}
            className={styles.ringProgress}
            strokeDasharray={circ}
            strokeDashoffset={circ * (1 - progress)}
          />
        </svg>
        <div className={styles.timeDisplay}>
          <span className={styles.time}>
            {String(mins).padStart(2, "0")}:{String(secs).padStart(2, "0")}
          </span>
          {paused && <span className={styles.pausedLabel}>pausado</span>}
        </div>
      </div>
      {title && <div className={styles.title}>{title}</div>}
      <div className={styles.timerActions}>
        <button className={`${styles.btn} ${styles.btnPause}`} onClick={handlePause}>
          {paused ? "▶ Continuar" : "⏸ Pausar"}
        </button>
        <button className={`${styles.btn} ${styles.btnCancel}`} onClick={onCancel}>
          ✕ Cancelar
        </button>
      </div>
    </div>
  );
}
