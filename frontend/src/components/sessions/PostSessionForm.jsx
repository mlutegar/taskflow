import { useState } from "react";
import { logUsage } from "../../lib/sessionUsageLog";
import styles from "./PostSessionForm.module.css";

const IDLE_REASONS = [
  { id: "distraction",  label: "📱 Distração" },
  { id: "another_task", label: "📋 Outra tarefa apareceu" },
  { id: "planned",      label: "☕ Pausa planejada" },
  { id: "tiredness",    label: "😴 Cansaço" },
  { id: "none",         label: "✅ Não fiquei ocioso" },
];

const FEELINGS = [
  { id: "flow",       label: "⚡ No flow" },
  { id: "thinking",   label: "💭 Pensando em algo" },
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

function RangeField({ label, value, onChange, min = 0, max, step = 5, unit = "min" }) {
  return (
    <div className={styles.rangeField}>
      <div className={styles.rangeHeader}>
        <span className={styles.fieldLabel}>{label}</span>
        <span className={styles.rangeValue}>
          {value === 0 ? "0" : value} {unit}
        </span>
      </div>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className={styles.rangeInput}
      />
      <div className={styles.rangeTicks}>
        <span>{min}</span>
        <span>{Math.round(max / 2)}</span>
        <span>{max}</span>
      </div>
    </div>
  );
}

export default function PostSessionForm({ modeId, modeName, onDone }) {
  const [worked,         setWorked]         = useState(null);       // true | false | null
  const [focusedMinutes, setFocusedMinutes] = useState(25);
  const [idleMinutes,    setIdleMinutes]    = useState(0);
  const [idleReason,     setIdleReason]     = useState([]);
  const [feeling,        setFeeling]        = useState([]);
  const [saved,          setSaved]          = useState(false);

  const toggleArr = (arr, setArr, id) => {
    setArr((prev) => prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]);
  };

  const handleSubmit = () => {
    logUsage({ modeId, worked: worked ?? false, focusedMinutes, idleMinutes, idleReason, feeling });
    setSaved(true);
    setTimeout(onDone, 1000);
  };

  const handleSkip = () => onDone();

  if (saved) {
    return (
      <div className={styles.root}>
        <div className={styles.savedState}>
          <span className={styles.savedEmoji}>✅</span>
          <p className={styles.savedText}>Registrado! Obrigado pelo feedback.</p>
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

        {/* 2. Tempo focado */}
        <div className={styles.section}>
          <RangeField
            label="Focou por quanto tempo?"
            value={focusedMinutes}
            onChange={setFocusedMinutes}
            min={0}
            max={120}
            step={5}
          />
        </div>

        {/* 3. Tempo ocioso */}
        <div className={styles.section}>
          <RangeField
            label="Ficou ocioso após finalizar?"
            value={idleMinutes}
            onChange={setIdleMinutes}
            min={0}
            max={60}
            step={5}
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
                onClick={() => toggleArr(idleReason, setIdleReason, r.id)}
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
                onClick={() => toggleArr(feeling, setFeeling, f.id)}
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
