import { useState, useEffect, useRef } from "react";
import BaseSession from "./BaseSession";
import CountdownTimer from "../CountdownTimer";
import styles from "./session.module.css";
import { useModeSession } from "../../hooks/useModeSession";

export default function SprintPendenciasSession({ preset, tasks, onClose, onComplete }) {
  const { persist, clearSaved, saved, wasRestored, setWasRestored } = useModeSession("sprint_pendencias", tasks);

  const sprintMin = preset?.sprintMin ?? 15;

  const [step,             setStep]             = useState(saved?.step             ?? "setup");
  const [projetoNome,      setProjetoNome]      = useState(saved?.projetoNome      ?? "");
  const [pendencias,       setPendencias]       = useState(saved?.pendencias       ?? []);
  const [sprintCount,      setSprintCount]      = useState(saved?.sprintCount      ?? 0);
  const [currentIdx,       setCurrentIdx]       = useState(saved?.currentIdx       ?? 0);
  const [novaInput,        setNovaInput]        = useState("");
  const [timerKey,         setTimerKey]         = useState(0); // força remontagem do timer

  const inputRef = useRef(null);

  useEffect(() => {
    if (step === "summary") return;
    persist({ step, projetoNome, pendencias, sprintCount, currentIdx });
  }, [step, projetoNome, pendencias, sprintCount, currentIdx]); // eslint-disable-line

  const handleClose = () => { clearSaved(); onClose(); };

  // ── Helpers ────────────────────────────────────────────────────────────────

  const addPendencia = () => {
    const texto = novaInput.trim();
    if (!texto) return;
    setPendencias((prev) => [...prev, { id: Date.now(), texto, feita: false }]);
    setNovaInput("");
    inputRef.current?.focus();
  };

  const removePendencia = (id) => {
    setPendencias((prev) => prev.filter((p) => p.id !== id));
  };

  const marcarFeita = () => {
    setPendencias((prev) =>
      prev.map((p, i) => (i === currentIdx ? { ...p, feita: true } : p))
    );
    const proxIdx = currentIdx + 1;
    const restantes = pendencias.filter((p, i) => !p.feita && i !== currentIdx);
    if (restantes.length === 0) {
      // fila zerada
      setStep("summary");
    } else {
      setCurrentIdx(proxIdx);
      setTimerKey((k) => k + 1);
      setStep("sprint");
    }
  };

  const sprintConcluido = () => {
    setSprintCount((c) => c + 1);
    // próxima pendência pendente a partir de currentIdx
    const proxIdx = pendencias.findIndex((p, i) => !p.feita && i >= currentIdx);
    if (proxIdx === -1) {
      setStep("summary");
    } else {
      setCurrentIdx(proxIdx);
      setStep("pendencia");
    }
  };

  const pendenciasFeitas  = pendencias.filter((p) => p.feita);
  const pendenciasTotal   = pendencias.length;
  const pendenciaAtual    = pendencias[currentIdx];

  // ── UI ─────────────────────────────────────────────────────────────────────

  return (
    <BaseSession
      emoji="🔁"
      title="Sprint + Pendências"
      sub={step === "setup"
        ? "Configure a sessão"
        : `Sprint #${sprintCount + (step === "sprint" ? 1 : 0)} · ${pendenciasFeitas.length}/${pendenciasTotal} pendências`}
      onClose={handleClose}
      showResume={wasRestored && step !== "setup" && step !== "summary"}
      resumeMessage={`↩ Sessão restaurada — ${sprintCount} sprint(s), ${pendenciasFeitas.length} pendência(s) resolvida(s)`}
      onDismissResume={() => setWasRestored(false)}
    >

      {/* ── SETUP ─────────────────────────────────────────────────────────── */}
      {step === "setup" && (
        <>
          <div className={styles.promptBox}>
            <div className={styles.promptTitle}>🎯 Qual é o foco principal hoje?</div>
            <div className={styles.promptText}>
              Este projeto vai receber sprints de {sprintMin} min intercalados com as pendências.
            </div>
          </div>

          <input
            className={styles.input}
            placeholder="Ex: terminar o app da IZA…"
            value={projetoNome}
            onChange={(e) => setProjetoNome(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && inputRef.current?.focus()}
          />

          <div>
            <span className={styles.sectionLabel}>📋 Pendências</span>
            <div style={{ display: "flex", gap: 6 }}>
              <input
                ref={inputRef}
                className={styles.input}
                placeholder="Ex: enviar cronograma pra Carla…"
                value={novaInput}
                onChange={(e) => setNovaInput(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && addPendencia()}
                style={{ flex: 1 }}
              />
              <button
                className={`${styles.btn} ${styles.btnSecondary}`}
                style={{ width: "auto", padding: "0 14px" }}
                onClick={addPendencia}
                disabled={!novaInput.trim()}
              >
                ➕
              </button>
            </div>

            {pendencias.length > 0 && (
              <div style={{ display: "flex", flexDirection: "column", gap: 5, marginTop: 8 }}>
                {pendencias.map((p) => (
                  <div key={p.id} style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 8,
                    padding: "8px 12px",
                    background: "var(--surface-2)",
                    border: "1px solid var(--border)",
                    borderRadius: "var(--radius-sm)",
                  }}>
                    <span style={{ flex: 1, fontSize: 13, color: "var(--text)" }}>{p.texto}</span>
                    <button
                      onClick={() => removePendencia(p.id)}
                      style={{
                        background: "none",
                        border: "none",
                        color: "var(--text-muted)",
                        cursor: "pointer",
                        fontSize: 14,
                        padding: "0 4px",
                        fontFamily: "inherit",
                      }}
                    >
                      ✕
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          <button
            className={`${styles.btn} ${styles.btnPrimary}`}
            disabled={!projetoNome.trim() || pendencias.length === 0}
            onClick={() => { setTimerKey((k) => k + 1); setStep("sprint"); }}
          >
            ▶ Iniciar sessão
          </button>
        </>
      )}

      {/* ── SPRINT ────────────────────────────────────────────────────────── */}
      {step === "sprint" && (
        <>
          <div className={styles.cycleBadge}>🔁 Sprint {sprintCount + 1} — {sprintMin} min</div>

          <div className={styles.taskDisplay}>
            <div className={styles.taskName}>{projetoNome}</div>
            <div className={styles.taskMeta}>
              {pendenciasFeitas.length}/{pendenciasTotal} pendências resolvidas
            </div>
          </div>

          <CountdownTimer
            key={timerKey}
            seconds={sprintMin * 60}
            title={projetoNome}
            onComplete={sprintConcluido}
            onCancel={sprintConcluido}
          />

          <button
            className={`${styles.btn} ${styles.btnSecondary}`}
            onClick={sprintConcluido}
          >
            ⏭ Pular para pendência
          </button>
        </>
      )}

      {/* ── PENDÊNCIA ─────────────────────────────────────────────────────── */}
      {step === "pendencia" && pendenciaAtual && (
        <>
          <div className={styles.promptBox}>
            <div className={styles.promptTitle}>📋 Hora da pendência</div>
            <div className={styles.promptText}>
              Resolva essa tarefa no tempo que precisar. Quando concluir, volte aqui.
            </div>
          </div>

          <div style={{
            background: "var(--surface-2)",
            border: "2px solid var(--accent)",
            borderRadius: "var(--radius)",
            padding: "18px 16px",
            display: "flex",
            flexDirection: "column",
            gap: 6,
          }}>
            <div style={{ fontSize: 11, fontWeight: 600, color: "var(--accent)", textTransform: "uppercase", letterSpacing: "0.06em" }}>
              Pendência {pendenciasFeitas.length + 1} de {pendenciasTotal}
            </div>
            <div style={{ fontSize: 16, fontWeight: 700, color: "var(--text)", lineHeight: 1.4 }}>
              {pendenciaAtual.texto}
            </div>
          </div>

          {pendenciasFeitas.length > 0 && (
            <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
              <span className={styles.sectionLabel}>✅ Já resolvidas</span>
              {pendenciasFeitas.map((p) => (
                <div key={p.id} style={{
                  fontSize: 12.5,
                  color: "var(--text-muted)",
                  padding: "5px 10px",
                  textDecoration: "line-through",
                  opacity: 0.6,
                }}>
                  {p.texto}
                </div>
              ))}
            </div>
          )}

          <button
            className={`${styles.btn} ${styles.btnSuccess}`}
            onClick={marcarFeita}
          >
            ✓ Concluí
          </button>
        </>
      )}

      {/* ── SUMMARY ───────────────────────────────────────────────────────── */}
      {step === "summary" && (
        <>
          <div className={styles.summaryBox}>
            <span className={styles.summaryEmoji}>🏁</span>
            <div className={styles.summaryTitle}>Sessão encerrada!</div>
            <div className={styles.summaryText}>
              {sprintCount} sprint{sprintCount !== 1 ? "s" : ""} de {sprintMin} min no projeto <strong>{projetoNome}</strong>
            </div>
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: 0 }}>
            <div className={styles.statRow}>
              <span className={styles.statLabel}>Sprints concluídos</span>
              <span className={styles.statValue}>{sprintCount}</span>
            </div>
            <div className={styles.statRow}>
              <span className={styles.statLabel}>Pendências resolvidas</span>
              <span className={styles.statValue}>{pendenciasFeitas.length}/{pendenciasTotal}</span>
            </div>
          </div>

          {pendencias.length > 0 && (
            <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
              <span className={styles.sectionLabel}>Pendências</span>
              {pendencias.map((p) => (
                <div key={p.id} style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 8,
                  fontSize: 13,
                  color: p.feita ? "var(--text-muted)" : "var(--text)",
                  textDecoration: p.feita ? "line-through" : "none",
                  opacity: p.feita ? 0.6 : 1,
                  padding: "3px 0",
                }}>
                  <span>{p.feita ? "✅" : "⏳"}</span>
                  <span>{p.texto}</span>
                </div>
              ))}
            </div>
          )}

          <button
            className={`${styles.btn} ${styles.btnPrimary}`}
            onClick={onComplete ?? handleClose}
          >
            📝 Registrar uso
          </button>
        </>
      )}
    </BaseSession>
  );
}
