import { useState } from "react";
import styles from "../DailyFocus.module.css";
import CountdownTimer from "../../CountdownTimer";
import { playTimerDone } from "../../../lib/sounds";

export const DEFAULT_STATE = {
  recordings: 0,
  duration: 3,
  intention: "",
};

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

const TIMER_DURATIONS = [2, 3, 5];

const APPS = [
  { name: "Notas de Voz", emoji: "🍎", url: null, note: "iOS" },
  { name: "Otter.ai", emoji: "🌐", url: "https://otter.ai", note: "Web/App" },
  { name: "Recorder", emoji: "🤖", url: null, note: "Android" },
  { name: "WhisperMemo", emoji: "🎙️", url: "https://whispermemo.com", note: "iOS/Web" },
];

export default function DiarioFaladoHelper({ state, onChange }) {
  const s = { ...DEFAULT_STATE, ...state };
  const [timerRunning, setTimerRunning] = useState(false);
  const [timerKey, setTimerKey] = useState(0);
  const [currentPrompt, setCurrentPrompt] = useState(null);
  const [showApps, setShowApps] = useState(false);

  const set = (field, val) => onChange({ ...s, [field]: val });

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
    onChange({ ...s, recordings: s.recordings + 1 });
    playTimerDone();
  };

  return (
    <div className={styles.helperPanelBody}>

      {/* ── Aviso principal ─────────────────────── */}
      <div style={{
        background: "rgba(160,107,191,0.10)",
        border: "1.5px solid rgba(160,107,191,0.35)",
        borderRadius: "var(--radius-sm)",
        padding: "10px 12px",
        textAlign: "center",
      }}>
        <div style={{ fontSize: 24, marginBottom: 2 }}>🗣️</div>
        <div style={{ fontWeight: 800, fontSize: 14, color: "var(--text)", marginBottom: 1 }}>
          Fale em voz alta
        </div>
        <div style={{ fontSize: 10, color: "var(--text-muted)", fontStyle: "italic" }}>
          A gravação é feita no app externo de sua escolha
        </div>
      </div>

      {/* ── Atalhos de app ──────────────────────── */}
      <div>
        <button
          className={styles.helperSmallBtn}
          style={{ width: "100%", fontSize: 11 }}
          onClick={() => setShowApps((v) => !v)}
        >
          📱 {showApps ? "Ocultar apps sugeridos" : "Ver apps de gravação"}
        </button>
        {showApps && (
          <div style={{ display: "flex", flexWrap: "wrap", gap: 5, marginTop: 6 }}>
            {APPS.map((app) =>
              app.url ? (
                <a
                  key={app.name}
                  href={app.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  style={{
                    display: "inline-flex", alignItems: "center", gap: 4,
                    padding: "4px 8px", borderRadius: "var(--radius-sm)",
                    background: "var(--surface-2)", border: "1px solid var(--border)",
                    fontSize: 11, color: "var(--text)", textDecoration: "none",
                    cursor: "pointer",
                  }}
                >
                  {app.emoji} {app.name}
                  <span style={{ color: "var(--text-muted)", fontSize: 10 }}>({app.note})</span>
                </a>
              ) : (
                <span
                  key={app.name}
                  style={{
                    display: "inline-flex", alignItems: "center", gap: 4,
                    padding: "4px 8px", borderRadius: "var(--radius-sm)",
                    background: "var(--surface-2)", border: "1px solid var(--border)",
                    fontSize: 11, color: "var(--text-muted)",
                  }}
                >
                  {app.emoji} {app.name}
                  <span style={{ fontSize: 10 }}>({app.note})</span>
                </span>
              )
            )}
          </div>
        )}
      </div>

      {/* ── Prompt sorteado ─────────────────────── */}
      <div>
        <div className={styles.counterLabel}>🎲 Prompt pra falar</div>
        {currentPrompt ? (
          <div style={{
            background: "var(--surface-2)",
            border: "1px solid var(--border)",
            borderRadius: "var(--radius-sm)",
            padding: "8px 10px",
            fontSize: 12,
            color: "var(--text)",
            fontStyle: "italic",
            marginBottom: 5,
            lineHeight: 1.4,
          }}>
            &ldquo;{currentPrompt}&rdquo;
          </div>
        ) : (
          <div style={{ fontSize: 11, color: "var(--text-muted)", marginBottom: 5 }}>
            Clique para sortear uma pergunta-gatilho
          </div>
        )}
        <button className={styles.helperSmallBtn} style={{ width: "100%" }} onClick={sortearPrompt}>
          🎲 {currentPrompt ? "Outro prompt" : "Sortear prompt"}
        </button>
      </div>

      {/* ── Timer de gravação ───────────────────── */}
      <div>
        <div className={styles.counterLabel}>⏱️ Timer de gravação</div>
        <div className={styles.variantRow}>
          {TIMER_DURATIONS.map((d) => (
            <button
              key={d}
              className={`${styles.variantBtn} ${s.duration === d ? styles.variantBtnActive : ""}`}
              onClick={() => { set("duration", d); setTimerRunning(false); }}
            >
              {d} min
            </button>
          ))}
        </div>
        {timerRunning ? (
          <CountdownTimer
            key={timerKey}
            seconds={s.duration * 60}
            title={`🗣️ Gravando ${s.duration} min`}
            onComplete={handleTimerComplete}
            onCancel={() => setTimerRunning(false)}
          />
        ) : (
          <button
            className={`${styles.variantBtn} ${styles.variantBtnActive}`}
            style={{ width: "100%", padding: "8px", marginTop: 4 }}
            onClick={startTimer}
          >
            ▶ Gravar por {s.duration} min
          </button>
        )}
      </div>

      {/* ── Intenção pós-gravação ───────────────── */}
      <div>
        <div className={styles.counterLabel}>✍️ Em uma frase: o que você vai fazer agora?</div>
        <input
          type="text"
          value={s.intention}
          onChange={(e) => set("intention", e.target.value)}
          placeholder="Ex: vou começar pelo parágrafo de abertura..."
          style={{
            width: "100%",
            boxSizing: "border-box",
            background: "var(--surface-2)",
            border: "1px solid var(--border)",
            borderRadius: "var(--radius-sm)",
            padding: "7px 10px",
            fontSize: 12,
            color: "var(--text)",
            fontFamily: "inherit",
            outline: "none",
          }}
        />
      </div>

      {/* ── Contador de gravações ───────────────── */}
      <div>
        <div className={styles.counterLabel}>🎙️ Gravações feitas</div>
        <div className={styles.counter}>
          <button
            className={styles.counterBtn}
            onClick={() => set("recordings", Math.max(0, s.recordings - 1))}
            disabled={s.recordings === 0}
          >
            −
          </button>
          <div className={styles.counterNum}>{s.recordings}</div>
          <button
            className={styles.counterBtn}
            onClick={() => set("recordings", s.recordings + 1)}
          >
            +
          </button>
        </div>
      </div>

      {/* ── Nota contextual ─────────────────────── */}
      <div style={{
        fontSize: 11,
        color: "var(--text-muted)",
        background: "var(--surface-2)",
        border: "1px solid var(--border)",
        borderRadius: "var(--radius-sm)",
        padding: "6px 9px",
        fontStyle: "italic",
      }}>
        💡 Mais eficaz quando você está travado especificamente nessa tarefa.
      </div>
    </div>
  );
}
