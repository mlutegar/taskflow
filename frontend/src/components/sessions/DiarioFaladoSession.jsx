import { useState } from "react";
import SessionHeader from "./SessionHeader";
import TaskSelector from "../TaskSelector";
import WorkingTask from "./WorkingTask";
import CountdownTimer from "../CountdownTimer";
import styles from "./session.module.css";
import { playTimerDone } from "../../lib/sounds";

const PROMPTS = [
  "O que está me travando agora?",
  "Como eu me sinto em relação a essa tarefa?",
  "O que eu precisaria para começar?",
  "O que está na minha cabeça nesse momento?",
  "Qual é o menor passo possível que eu poderia dar?",
  "O que eu estou evitando e por quê?",
  "Se eu fosse explicar essa tarefa pra alguém, como eu descreveria?",
  "O que eu já sei sobre isso que posso usar agora?",
  "O que vai acontecer se eu não fizer isso hoje?",
  "Que parte disso parece mais fácil de começar?",
];

const TIMER_DURATIONS = [
  { label: "2 min", value: 2 },
  { label: "3 min", value: 3 },
  { label: "5 min", value: 5 },
];

const APPS = [
  { name: "Notas de Voz", emoji: "🍎", url: null, note: "iOS" },
  { name: "Otter.ai", emoji: "🌐", url: "https://otter.ai", note: "Web" },
  { name: "Recorder", emoji: "🤖", url: null, note: "Android" },
  { name: "WhisperMemo", emoji: "🎙️", url: "https://whispermemo.com", note: "iOS/Web" },
];

export default function DiarioFaladoSession({ tasks, onCompleteTask, onToggleChecklist, onAddChecklist, onClose }) {
  const [step, setStep] = useState("orient"); // "orient" | "select_task" | "working" | "summary"
  const [selectedTask, setSelectedTask] = useState(null);
  const [completed, setCompleted] = useState(0);
  const [recordings, setRecordings] = useState(0);

  // Orient step state
  const [currentPrompt, setCurrentPrompt] = useState(null);
  const [duration, setDuration] = useState(3);
  const [timerRunning, setTimerRunning] = useState(false);
  const [timerKey, setTimerKey] = useState(0);
  const [intention, setIntention] = useState("");

  const available = tasks.filter((t) => !t.completed);

  const sortearPrompt = () => {
    const remaining = PROMPTS.filter((p) => p !== currentPrompt);
    const pool = remaining.length > 0 ? remaining : PROMPTS;
    setCurrentPrompt(pool[Math.floor(Math.random() * pool.length)]);
  };

  const startTimer = () => {
    setTimerKey((k) => k + 1);
    setTimerRunning(true);
  };

  const handleTimerComplete = () => {
    setTimerRunning(false);
    setRecordings((r) => r + 1);
    playTimerDone();
  };

  const handleComplete = async () => {
    await onCompleteTask(selectedTask.id);
    setCompleted((c) => c + 1);
    setSelectedTask(null);
    setIntention("");
    setCurrentPrompt(null);
    setStep(available.length - 1 === 0 ? "summary" : "orient");
  };

  const goRecord = () => {
    setTimerRunning(false);
    setStep("orient");
  };

  return (
    <div className={styles.root}>
      <SessionHeader
        emoji="🗣️"
        title="Diário Falado"
        sub={
          recordings > 0 || completed > 0
            ? `🎙️ ${recordings} gravação${recordings !== 1 ? "ões" : ""} · ✅ ${completed} tarefa${completed !== 1 ? "s" : ""}`
            : "Fale em voz alta antes de cada tarefa"
        }
        onClose={onClose}
      />

      <div className={styles.body}>

        {/* ── Orientação / Gravação ─────────────────── */}
        {step === "orient" && (
          <>
            {/* Aviso de destaque */}
            <div style={{
              background: "rgba(160,107,191,0.10)",
              border: "2px solid rgba(160,107,191,0.40)",
              borderRadius: "var(--radius)",
              padding: "18px",
              textAlign: "center",
            }}>
              <div style={{ fontSize: 44, marginBottom: 6 }}>🗣️</div>
              <div style={{ fontSize: 19, fontWeight: 800, color: "var(--text)", marginBottom: 5 }}>
                Fale em voz alta
              </div>
              <div style={{
                fontSize: 12,
                color: "var(--text-muted)",
                background: "var(--surface-2)",
                display: "inline-block",
                padding: "3px 10px",
                borderRadius: "var(--radius-sm)",
                fontStyle: "italic",
              }}>
                📱 A gravação é feita no app externo de sua escolha
              </div>
            </div>

            {/* ── Atalhos de app ────────────────── */}
            <div>
              <div className={styles.sectionLabel} style={{ fontSize: 12, fontWeight: 700, color: "var(--text-muted)", marginBottom: 6 }}>
                📱 Apps de gravação sugeridos
              </div>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                {APPS.map((app) =>
                  app.url ? (
                    <a
                      key={app.name}
                      href={app.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      style={{
                        display: "inline-flex", alignItems: "center", gap: 5,
                        padding: "5px 10px", borderRadius: "var(--radius-sm)",
                        background: "var(--surface-2)", border: "1px solid var(--border)",
                        fontSize: 12, color: "var(--text)", textDecoration: "none",
                        cursor: "pointer",
                      }}
                    >
                      {app.emoji} {app.name}
                      <span style={{ color: "var(--text-muted)", fontSize: 10 }}>· {app.note}</span>
                    </a>
                  ) : (
                    <span
                      key={app.name}
                      style={{
                        display: "inline-flex", alignItems: "center", gap: 5,
                        padding: "5px 10px", borderRadius: "var(--radius-sm)",
                        background: "var(--surface-2)", border: "1px solid var(--border)",
                        fontSize: 12, color: "var(--text-muted)",
                      }}
                    >
                      {app.emoji} {app.name}
                      <span style={{ fontSize: 10 }}>· {app.note}</span>
                    </span>
                  )
                )}
              </div>
            </div>

            {/* ── Prompt sorteado ───────────────── */}
            <div>
              <div style={{ fontSize: 12, fontWeight: 700, color: "var(--text-muted)", marginBottom: 6 }}>
                🎲 Prompt pra começar a falar
              </div>
              {currentPrompt && (
                <div style={{
                  background: "var(--surface-2)",
                  border: "1px solid var(--border)",
                  borderRadius: "var(--radius-sm)",
                  padding: "10px 12px",
                  fontSize: 13,
                  color: "var(--text)",
                  fontStyle: "italic",
                  marginBottom: 6,
                  lineHeight: 1.5,
                }}>
                  &ldquo;{currentPrompt}&rdquo;
                </div>
              )}
              <button
                className={`${styles.btn} ${styles.btnSecondary}`}
                onClick={sortearPrompt}
              >
                🎲 {currentPrompt ? "Outro prompt" : "Sortear prompt"}
              </button>
            </div>

            {/* ── Timer de gravação ─────────────── */}
            <div>
              <div style={{ fontSize: 12, fontWeight: 700, color: "var(--text-muted)", marginBottom: 6 }}>
                ⏱️ Timer de gravação (opcional)
              </div>
              <div style={{ display: "flex", gap: 6, marginBottom: 8 }}>
                {TIMER_DURATIONS.map((d) => (
                  <button
                    key={d.value}
                    className={`${styles.btn} ${duration === d.value ? styles.btnPrimary : styles.btnSecondary}`}
                    style={{ flex: 1 }}
                    onClick={() => { setDuration(d.value); setTimerRunning(false); }}
                  >
                    {d.label}
                  </button>
                ))}
              </div>
              {timerRunning ? (
                <CountdownTimer
                  key={timerKey}
                  seconds={duration * 60}
                  title={`🗣️ Gravando por ${duration} min`}
                  onComplete={handleTimerComplete}
                  onCancel={() => setTimerRunning(false)}
                />
              ) : (
                <button
                  className={`${styles.btn} ${styles.btnSecondary}`}
                  style={{ width: "100%" }}
                  onClick={startTimer}
                >
                  ▶ Gravar por {duration} min
                </button>
              )}
              {recordings > 0 && (
                <div style={{
                  marginTop: 8, fontSize: 12, color: "var(--text-muted)", textAlign: "center",
                }}>
                  🎙️ {recordings} gravação{recordings !== 1 ? "ões" : ""} feita{recordings !== 1 ? "s" : ""} nessa sessão
                </div>
              )}
            </div>

            {/* ── Intenção pós-gravação ─────────── */}
            <div>
              <div style={{ fontSize: 12, fontWeight: 700, color: "var(--text-muted)", marginBottom: 6 }}>
                ✍️ Em uma frase: o que você vai fazer agora?
              </div>
              <input
                type="text"
                value={intention}
                onChange={(e) => setIntention(e.target.value)}
                placeholder="Ex: vou começar pelo parágrafo de abertura..."
                style={{
                  width: "100%",
                  boxSizing: "border-box",
                  background: "var(--surface-2)",
                  border: "1px solid var(--border)",
                  borderRadius: "var(--radius-sm)",
                  padding: "8px 12px",
                  fontSize: 13,
                  color: "var(--text)",
                  fontFamily: "inherit",
                  outline: "none",
                }}
              />
            </div>

            <button
              className={`${styles.btn} ${styles.btnPrimary}`}
              onClick={() => setStep("select_task")}
            >
              🎙️ Já gravei — escolher tarefa
            </button>

            {/* Painéis informativos colapsáveis */}
            <InfoSection />
          </>
        )}

        {/* ── Seleção de tarefa ──────────────────── */}
        {step === "select_task" && (
          <TaskSelector
            tasks={available}
            onSelect={(t) => { setSelectedTask(t); setStep("working"); }}
            onCancel={() => setStep("orient")}
          />
        )}

        {/* ── Trabalhando ────────────────────────── */}
        {step === "working" && selectedTask && (() => {
          const live = tasks.find((t) => t.id === selectedTask.id) || selectedTask;
          return (
            <>
              {intention && (
                <div style={{
                  background: "rgba(160,107,191,0.08)",
                  border: "1px solid rgba(160,107,191,0.25)",
                  borderRadius: "var(--radius-sm)",
                  padding: "7px 11px",
                  fontSize: 12,
                  color: "var(--text)",
                  fontStyle: "italic",
                }}>
                  🎯 <strong>Sua intenção:</strong> {intention}
                </div>
              )}
              <WorkingTask
                task={live}
                completeLabel="✅ Tarefa concluída!"
                onComplete={handleComplete}
                onToggleChecklist={onToggleChecklist}
                onAddChecklist={onAddChecklist}
                onSwap={() => { setSelectedTask(null); setStep("select_task"); }}
                swapLabel="↩ Trocar tarefa"
              >
                <button
                  className={`${styles.btn} ${styles.btnSecondary}`}
                  onClick={goRecord}
                >
                  🗣️ Gravar mais antes de continuar
                </button>
              </WorkingTask>
            </>
          );
        })()}

        {/* ── Resumo ─────────────────────────────── */}
        {step === "summary" && (
          <div style={{ textAlign: "center", padding: "20px 0" }}>
            <div style={{ fontSize: 48, marginBottom: 12 }}>🎉</div>
            <div className={styles.summaryTitle}>Sessão encerrada!</div>
            <div className={styles.summaryText} style={{ marginBottom: 8 }}>
              {completed} tarefa{completed !== 1 ? "s" : ""} concluída{completed !== 1 ? "s" : ""} com o Diário Falado.
            </div>
            {recordings > 0 && (
              <div style={{ fontSize: 13, color: "var(--text-muted)", marginBottom: 20 }}>
                🎙️ {recordings} gravação{recordings !== 1 ? "ões" : ""} feita{recordings !== 1 ? "s" : ""} no total
              </div>
            )}
            <button className={`${styles.btn} ${styles.btnPrimary}`} onClick={onClose}>Fechar</button>
          </div>
        )}
      </div>
    </div>
  );
}

function InfoSection() {
  const [open, setOpen] = useState(false);
  return (
    <div>
      <button
        style={{
          background: "none", border: "none", cursor: "pointer",
          fontSize: 12, color: "var(--text-muted)", padding: "2px 0",
          fontFamily: "inherit",
        }}
        onClick={() => setOpen((v) => !v)}
      >
        {open ? "▲" : "▼"} {open ? "Ocultar" : "Ver"} como funciona
      </button>
      {open && (
        <div style={{ display: "flex", flexDirection: "column", gap: 8, marginTop: 8 }}>
          <InfoCard emoji="📌" label="Pré-requisito">
            Estar numa sessão de foco. Abra um app de gravação antes de começar.
          </InfoCard>
          <InfoCard emoji="⚡" label="Por que funciona">
            Falar em voz alta pula o filtro de &quot;formular a frase certa por escrito&quot; — destrava quando você está paralisado.
          </InfoCard>
          <InfoCard emoji="🎯" label="Quando usar">
            Quando você está travado, com a cabeça cheia, ou quando escrever parece pesado demais pra começar.
          </InfoCard>
        </div>
      )}
    </div>
  );
}

function InfoCard({ emoji, label, children }) {
  return (
    <div style={{
      background: "var(--surface-2)",
      border: "1px solid var(--border)",
      borderRadius: "var(--radius-sm)",
      padding: "9px 12px",
      fontSize: 12,
    }}>
      <div style={{ fontWeight: 700, color: "var(--text)", marginBottom: 3 }}>
        {emoji} {label}
      </div>
      <div style={{ color: "var(--text-muted)", lineHeight: 1.5 }}>{children}</div>
    </div>
  );
}
