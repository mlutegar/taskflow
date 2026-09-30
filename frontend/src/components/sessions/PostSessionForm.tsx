import { useState, useEffect, useRef } from "react";
import { logUsage, addPendingReminder } from "../../lib/sessionUsageLog";
import { ModeFocusStats } from "../../lib/modeFocusTimer";
import { useToast } from "../shared/Toast";
import styles from "./PostSessionForm.module.css";

const IDLE_REASONS: { id: string; label: string }[] = [
  { id: "distraction",  label: "📱 Distração" },
  { id: "another_task", label: "📋 Outra tarefa" },
  { id: "planned",      label: "☕ Pausa planejada" },
  { id: "tiredness",    label: "😴 Cansaço" },
  { id: "none",         label: "✅ Não fiquei ocioso" },
];

const FEELINGS: { id: string; label: string }[] = [
  { id: "flow",       label: "⚡ No flow" },
  { id: "thinking",   label: "💭 Pensando" },
  { id: "tired",      label: "😓 Cansado" },
  { id: "sleepy",     label: "😴 Com sono" },
  { id: "anxious",    label: "😬 Ansioso" },
  { id: "good",       label: "😊 Bem" },
  { id: "distracted", label: "🌀 Distraído" },
];

interface ChipProps {
  label: string;
  selected: boolean;
  onClick: () => void;
}

function Chip({ label, selected, onClick }: ChipProps): JSX.Element {
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

interface MinutesInputProps {
  label: string;
  value: number;
  onChange: (value: number) => void;
  placeholder?: string;
}

function MinutesInput({ label, value, onChange, placeholder = "ex: 25" }: MinutesInputProps): JSX.Element {
  const [raw, setRaw] = useState<string>(value > 0 ? String(value) : "");

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>): void => {
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

interface PostSessionFormProps {
  modeId: string;
  modeName?: string;
  suggestedMinutes?: number;
  sessionStartedAt?: string | null;
  /**
   * Tempo de foco EFETIVO do modo em minutos (acumulado só enquanto o Daily Focus
   * esteve rodando). Quando presente, é a fonte de verdade da duração/eficiência,
   * substituindo o wall-clock de `sessionStartedAt`.
   */
  focusMinutes?: number | null;
  /** Métricas ricas do acumulador de foco (pausas, blocos, tarefas). */
  focusStats?: ModeFocusStats;
  intention?: string;
  onDone: () => void;
}

interface SavedResult {
  sessionDurationMinutes: number | null;
  efficiencyPct: number | null;
  focusedMinutes: number;
  worked: boolean;
}

export default function PostSessionForm({ modeId, modeName, suggestedMinutes, sessionStartedAt, focusMinutes, focusStats, intention, onDone }: PostSessionFormProps): JSX.Element {
  const { showToast } = useToast();
  const hasFocusInit = typeof focusMinutes === "number" && focusMinutes > 0;
  const [worked,         setWorked]         = useState<boolean | null>(null);
  // Pré-preenche com o FOCO MEDIDO (acumulador); o usuário só ajusta se quiser.
  const [focusedMinutes, setFocusedMinutes] = useState<number>(() => (hasFocusInit ? Math.round(focusMinutes as number) : suggestedMinutes ?? 0));
  const [idleMinutes,    setIdleMinutes]    = useState<number>(0);
  const [idleReason,     setIdleReason]     = useState<string[]>([]);
  const [feeling,        setFeeling]        = useState<string[]>([]);
  const [note,           setNote]           = useState<string>("");
  const [phase,       setPhase]       = useState<"form" | "saved">("form");
  const [savedResult, setSavedResult] = useState<SavedResult | null>(null);
  const ivRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Duração da sessão = tempo de FOCO efetivo (sincronizado ao Daily Focus) quando
  // disponível; senão, fallback wall-clock desde o início.
  const hasFocus = typeof focusMinutes === "number" && focusMinutes > 0;
  const sessionDurationNow: number | null = hasFocus
    ? Math.max(1, Math.round(focusMinutes as number))
    : sessionStartedAt
    ? Math.max(1, Math.round((Date.now() - new Date(sessionStartedAt).getTime()) / 60000))
    : null;

  // Fix #9 — reseta campos se o modeId mudar (reutilização do componente sem desmontagem)
  useEffect(() => {
    setWorked(null);
    setFocusedMinutes(hasFocusInit ? Math.round(focusMinutes as number) : suggestedMinutes ?? 0);
    setIdleMinutes(0);
    setIdleReason([]);
    setFeeling([]);
    setNote("");
    setPhase("form");
    setSavedResult(null);
  }, [modeId]); // eslint-disable-line react-hooks/exhaustive-deps

  const toggleArr = (setArr: React.Dispatch<React.SetStateAction<string[]>>, id: string): void => {
    setArr((prev) => prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]);
  };

  const handleSubmit = (): void => {
    if (focusedMinutes === 0 && idleMinutes === 0) {
      showToast("💡 Preencha ao menos o tempo focado ou ocioso para um registro mais preciso.", "info");
    }

    const endedAt = new Date().toISOString();

    // Calcula eficiência para exibir no card pós-sessão (base = tempo de foco efetivo
    // quando disponível; senão, wall-clock).
    let sessionDurationMinutes: number | null = null;
    let efficiencyPct: number | null = null;
    if (hasFocus) {
      sessionDurationMinutes = Math.max(1, Math.round(focusMinutes as number));
    } else if (sessionStartedAt) {
      const diffMs = new Date(endedAt).getTime() - new Date(sessionStartedAt).getTime();
      if (diffMs > 0) sessionDurationMinutes = Math.max(1, Math.round(diffMs / 60000));
    }
    if (sessionDurationMinutes != null && focusedMinutes > 0) {
      efficiencyPct = Math.min(100, Math.round((focusedMinutes / sessionDurationMinutes) * 100));
    }

    const saved = logUsage({ modeId, worked: worked ?? false, focusedMinutes, idleMinutes, idleReason, feeling, sessionStartedAt: sessionStartedAt ?? undefined, sessionEndedAt: endedAt, focusMinutes: hasFocus ? Math.round(focusMinutes as number) : undefined, pauseCount: focusStats?.pauseCount, pausedMinutes: focusStats?.pausedMinutes, focusBlocks: focusStats?.focusBlocks, tasksCompleted: focusStats?.tasksCompleted, note: note.trim() || undefined, intention: intention || undefined });
    if (!saved) {
      showToast("⚠️ Não foi possível salvar localmente (armazenamento cheio). Os dados foram enviados ao servidor.", "error");
    }
    setSavedResult({ sessionDurationMinutes, efficiencyPct, focusedMinutes, worked: worked ?? false });
    setPhase("saved");
    setTimeout(onDone, 3200);
  };

  useEffect(() => () => clearInterval(ivRef.current!), []);

  const handleSkip = (): void => {
    // #2 — mesmo ao "Pular", persiste um registro MÍNIMO com o foco já medido, para
    // que a sessão nunca desapareça da análise. O lembrete continua para enriquecer depois.
    logUsage({
      modeId,
      worked: false,
      focusedMinutes: hasFocus ? Math.round(focusMinutes as number) : 0,
      idleMinutes: 0,
      idleReason: [],
      feeling: [],
      sessionStartedAt: sessionStartedAt ?? undefined,
      sessionEndedAt: new Date().toISOString(),
      focusMinutes: hasFocus ? Math.round(focusMinutes as number) : undefined,
      pauseCount: focusStats?.pauseCount,
      pausedMinutes: focusStats?.pausedMinutes,
      focusBlocks: focusStats?.focusBlocks,
      tasksCompleted: focusStats?.tasksCompleted,
      intention: intention || undefined,
    });
    addPendingReminder(modeId, modeName || modeId);
    onDone();
  };

  if (phase === "saved") {
    const r = savedResult;
    const effLevel = r?.efficiencyPct != null
      ? r.efficiencyPct >= 70 ? "high" : r.efficiencyPct >= 40 ? "mid" : "low"
      : null;

    return (
      <div className={styles.root}>
        {r?.sessionDurationMinutes != null ? (
          <div className={styles.efficiencyCard}>
            <div className={styles.efficiencyIcon}>
              {r.worked ? "✅" : "📝"}
            </div>
            <div className={styles.efficiencyTitle}>
              {modeName || modeId} — registrado!
            </div>

            <div className={styles.efficiencyGrid}>
              <div className={styles.efficiencyMetric}>
                <span className={styles.efficiencyValue}>{r.sessionDurationMinutes}</span>
                <span className={styles.efficiencyLabel}>🕐 min total</span>
              </div>
              <div className={styles.efficiencyMetric}>
                <span className={styles.efficiencyValue}>{r.focusedMinutes}</span>
                <span className={styles.efficiencyLabel}>⚡ min focado</span>
              </div>
              <div className={styles.efficiencyMetric}>
                {effLevel ? (
                  <>
                    <span className={`${styles.efficiencyValue} ${styles[`eff_${effLevel}`]}`}>
                      {r.efficiencyPct}%
                    </span>
                    <span className={styles.efficiencyLabel}>🎯 eficiência</span>
                  </>
                ) : (
                  <>
                    <span className={styles.efficiencyValue} style={{ color: "var(--text-muted)" }}>—</span>
                    <span className={styles.efficiencyLabel}>🎯 eficiência</span>
                  </>
                )}
              </div>
            </div>

            {effLevel && (
              <div className={`${styles.efficiencyBadge} ${styles[`badge_${effLevel}`]}`}>
                {effLevel === "high" && "🔥 Sessão muito eficiente!"}
                {effLevel === "mid"  && "👍 Sessão razoável"}
                {effLevel === "low"  && "💡 Pode melhorar"}
              </div>
            )}
          </div>
        ) : (
          <div className={styles.savedState}>
            <span className={styles.savedEmoji}>✅</span>
            <p className={styles.savedText}>Registrado!</p>
          </div>
        )}
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

        {/* 6. Nota rápida */}
        <div className={styles.section}>
          <span className={styles.fieldLabel}>
            📝 O que você aprendeu ou quer lembrar?{" "}
            <span style={{ fontWeight: 400, opacity: 0.6 }}>(opcional)</span>
          </span>
          <textarea
            className={styles.noteTextarea}
            placeholder="Ex: Funcionou bem de manhã, mas perdi foco depois de 20min..."
            value={note}
            onChange={(e) => setNote(e.target.value)}
            maxLength={500}
            rows={3}
          />
        </div>

        {/* Banner de contexto: foco medido automaticamente (sincronizado ao Daily Focus) */}
        {sessionDurationNow != null && (
          <div className={styles.sessionContextBanner}>
            {hasFocus ? (
              <>⚡ Foco medido: <strong>{sessionDurationNow} min</strong>
                {focusStats && focusStats.pauseCount > 0 && <> · {focusStats.pauseCount} pausa{focusStats.pauseCount > 1 ? "s" : ""}</>}
                {focusStats && focusStats.tasksCompleted > 0 && <> · {focusStats.tasksCompleted} tarefa{focusStats.tasksCompleted > 1 ? "s" : ""}</>}
                {" "}— ajuste abaixo se quiser
              </>
            ) : (
              <>🕐 Sessão ativa por <strong>{sessionDurationNow} min</strong> — insira abaixo o tempo que você realmente ficou focado</>
            )}
          </div>
        )}

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
