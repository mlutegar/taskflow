import { useState } from "react";
import { logUsage, addPendingReminder } from "../../lib/sessionUsageLog";
import styles from "./PostSessionForm.module.css";

const IDLE_REASONS = [
  { id: "distraction",  label: "📱 Distração" },
  { id: "another_task", label: "📋 Outra tarefa" },
  { id: "planned",      label: "☕ Pausa planejada" },
  { id: "tiredness",    label: "😴 Cansaço" },
  { id: "none",         label: "✅ Não fiquei ocioso" },
];

const FEELINGS = [
  { id: "flow",       label: "⚡ No flow" },
  { id: "thinking",   label: "💭 Pensando" },
  { id: "tired",      label: "😓 Cansado" },
  { id: "sleepy",     label: "😴 Com sono" },
  { id: "anxious",    label: "😬 Ansioso" },
  { id: "good",       label: "😊 Bem" },
  { id: "distracted", label: "🌀 Distraído" },
];

function Chip({ label, selected, onClick }) {
  return (
    <button
      type="button"
      className={`${styles.chip} ${selected ? styles.chipSelected : ""}`}
      onClick={onClick}
    >
      {label}
    </button>
  );
}

function MinutesInput({ label, value, onChange, placeholder = "ex: 25" }) {
  const [raw, setRaw] = useState(value > 0 ? String(value) : "");

  const handleChange = (e) => {
    const v = e.target.value.replace(/\D/g, "").slice(0, 3);
    setRaw(v);
    onChange(v === "" ? 0 : Math.min(999, parseInt(v, 10)));
  };

  return (
    <div className={styles.minutesField}>
      <label className={styles.fieldLabel}>{label}</label>
      <div className={styles.minutesRow}>
        <input
          type="text"
          inputMode="numeric"
          pattern="[0-9]*"
          className={styles.minutesInput}
          value={raw}
          onChange={handleChange}
          placeholder={placeholder}
          maxLength={3}
        />
        <span className={styles.minutesUnit}>min</span>
      </div>
    </div>
  );
}

export default function PostSessionForm({ modeId, modeName, onDone }) {
  const [worked,         setWorked]         = useState(null);
  const [focusedMinutes, setFocusedMinutes] = useState(0);
  const [idleMinutes,    setIdleMinutes]    = useState(0);
  const [idleReason,     setIdleReason]     = useState([]);
  const [feeling,        setFeeling]        = useState([]);
  const [saved,          setSaved]          = useState(false);

  const toggleArr = (setArr, id) => {
    setArr((prev) => prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]);
  };

  const handleSubmit = () => {
    logUsage({ modeId, worked: worked ?? false, focusedMinutes, idleMinutes, idleReason, feeling });
    setSaved(true);
    setTimeout(onDone, 900);
  };

  const handleSkip = () => {
    addPendingReminder(modeId, modeName || modeId);
    onDone();
  };

  if (saved) {
    return (
      <div className={styles.root}>
        <div className={styles.savedState}>
          <span className={styles.savedEmoji}>✅</span>
          <p className={styles.savedText}>Registrado!</p>
        </div>
      </div>
    );
  }

  return (
    <div className={styles.root}>
      <div className={styles.header}>
        <span className={styles.headerEmoji}>📝</span>
        <div className={styles.headerMeta}>
          <span className={styles.headerTitle}>Registrar uso</span>
          <span className={styles.headerSub}>{modeName || modeId}</span>
        </div>
        <button className={styles.skipBtn} onClick={handleSkip} type="button">
          Pular
        </button>
      </div>

      <div className={styles.body}>

        {/* 1. Funcionou? */}
        <div className={styles.section}>
          <span className={styles.fieldLabel}>Funcionou?</span>
          <div className={styles.workedRow}>
            <button
              type="button"
              className={`${styles.workedBtn} ${worked === true ? styles.workedYes : ""}`}
              onClick={() => setWorked(true)}
            >
              ✅ Sim
            </button>
            <button
              type="button"
              className={`${styles.workedBtn} ${worked === false ? styles.workedNo : ""}`}
              onClick={() => setWorked(false)}
            >
              ❌ Não
            </button>
          </div>
        </div>

        {/* 2 + 3. Tempos — linha única no mobile */}
        <div className={styles.timesRow}>
          <MinutesInput
            label="Tempo focado"
            value={focusedMinutes}
            onChange={setFocusedMinutes}
            placeholder="ex: 30"
          />
          <div className={styles.timesDivider} />
          <MinutesInput
            label="Tempo ocioso depois"
            value={idleMinutes}
            onChange={setIdleMinutes}
            placeholder="ex: 10"
          />
        </div>

        {/* 4. Por que ficou ocioso */}
        <div className={styles.section}>
          <span className={styles.fieldLabel}>Por que ficou ocioso?</span>
          <div className={styles.chips}>
            {IDLE_REASONS.map((r) => (
              <Chip
                key={r.id}
                label={r.label}
                selected={idleReason.includes(r.id)}
                onClick={() => toggleArr(setIdleReason, r.id)}
              />
            ))}
          </div>
        </div>

        {/* 5. Como estava */}
        <div className={styles.section}>
          <span className={styles.fieldLabel}>Como você estava?</span>
          <div className={styles.chips}>
            {FEELINGS.map((f) => (
              <Chip
                key={f.id}
                label={f.label}
                selected={feeling.includes(f.id)}
                onClick={() => toggleArr(setFeeling, f.id)}
              />
            ))}
          </div>
        </div>

        <button
          type="button"
          className={styles.submitBtn}
          onClick={handleSubmit}
          disabled={worked === null}
        >
          📝 Registrar
        </button>
        {worked === null && (
          <p className={styles.hint}>Responda "Funcionou?" para continuar</p>
        )}
      </div>
    </div>
  );
}
