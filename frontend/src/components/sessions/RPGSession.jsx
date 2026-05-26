import { useState, useEffect } from "react";
import TaskSelector from "../TaskSelector";
import CountdownTimer from "../CountdownTimer";
import SubtaskInline from "./SubtaskInline";
import SubtaskFlow from "./SubtaskFlow";
import styles from "./session.module.css";
import { useSessionPersist } from "../../lib/useSessionPersist";

const CLASSES = {
  warrior: { name: "Warrior", emoji: "⚔️", desc: "Foco intenso e resistência", focus: 30, color: "#e05252" },
  mage: { name: "Mage", emoji: "🧙‍♂️", desc: "+25% XP em tarefas de estudo", focus: 25, color: "#7c6ef5" },
  rogue: { name: "Rogue", emoji: "🗡️", desc: "Sessões curtas, velocidade máxima", focus: 15, color: "#4ecca3" },
};

const LEVELS = [[0,"Novice"],[100,"Apprentice"],[250,"Adept"],[500,"Expert"],[1000,"Master"],[2000,"Grandmaster"],[5000,"Legend"]];

const DIFFICULTIES = [
  { id: "easy",      label: "🟢 Easy",      xpBase: 5  },
  { id: "medium",    label: "🟡 Medium",    xpBase: 10 },
  { id: "hard",      label: "🟠 Hard",      xpBase: 20 },
  { id: "very_hard", label: "🔴 Very Hard", xpBase: 30 },
];

const LS_KEY = "taskflow_rpg_save";

function calcLevel(xp) {
  let lv = 1, nm = "Novice";
  for (let i = 0; i < LEVELS.length; i++) { if (xp >= LEVELS[i][0]) { lv = i + 1; nm = LEVELS[i][1]; } else break; }
  return { level: lv, name: nm };
}
function nextXP(level) { return level < LEVELS.length ? LEVELS[level][0] : null; }
function loadChar() { try { return JSON.parse(localStorage.getItem(LS_KEY)); } catch { return null; } }
function saveChar(d) { localStorage.setItem(LS_KEY, JSON.stringify(d)); }

export default function RPGSession({ tasks, onCompleteTask, onToggleChecklist, onAddChecklist, onClose }) {
  const { saved: sessState, persist: persistSess, clearSaved: clearSess } = useSessionPersist("rpg");

  const [step,         setStep]         = useState("loading");
  const [char,         setChar]         = useState(null);
  const [charName,     setCharName]     = useState("");
  const [selClass,     setSelClass]     = useState("warrior");
  const [selectedTask, setSelectedTask] = useState(() => {
    if (!sessState?.selectedTaskId) return null;
    return tasks.find((t) => t.id === sessState.selectedTaskId) || null;
  });
  const [difficulty,  setDifficulty]  = useState(sessState?.difficulty ?? null);
  const [xpGained,    setXpGained]    = useState(0);
  const [leveledUp,   setLeveledUp]   = useState(false);
  const [doneIds,     setDoneIds]     = useState(() => new Set(sessState?.doneIds ?? []));
  const [wasRestored, setWasRestored] = useState(!!sessState);

  // Carrega personagem e restaura step de sessão
  useEffect(() => {
    const saved = loadChar();
    if (saved) {
      setChar(saved);
      // Restaura step de sessão se havia uma em progresso
      setStep(sessState?.step ?? "dashboard");
    } else {
      setStep("create");
    }
  }, []); // eslint-disable-line

  const available = tasks.filter((t) => !t.completed && !doneIds.has(t.id));

  // Persistir estado de sessão
  useEffect(() => {
    if (!char || step === "loading" || step === "quest_result") return;
    persistSess({ step, doneIds: [...doneIds], selectedTaskId: selectedTask?.id ?? null, difficulty });
  }, [step, doneIds, selectedTask, difficulty]); // eslint-disable-line

  const handleClose = () => { clearSess(); onClose(); };

  const createChar = () => {
    if (!charName.trim()) return;
    const c = { name: charName.trim(), class: selClass, xp: 0, totalTasks: 0, totalFocus: 0 };
    saveChar(c);
    setChar(c);
    setStep("dashboard");
  };

  const completeQuest = async () => {
    const diff = DIFFICULTIES.find((d) => d.id === difficulty);
    let earned = diff.xpBase;
    if (char.class === "mage" && ["medium", "hard"].includes(difficulty)) earned = Math.floor(earned * 1.25);
    if (char.class === "rogue" && difficulty === "easy") earned = Math.floor(earned * 1.5);

    const oldLv = calcLevel(char.xp).level;
    const newXp = char.xp + earned;
    const didLvUp = calcLevel(newXp).level > oldLv;

    await onCompleteTask(selectedTask.id);
    setDoneIds((p) => new Set([...p, selectedTask.id]));

    const updated = { ...char, xp: newXp, totalTasks: (char.totalTasks || 0) + 1, totalFocus: (char.totalFocus || 0) + CLASSES[char.class].focus };
    saveChar(updated);
    setChar(updated);
    setXpGained(earned);
    setLeveledUp(didLvUp);
    setStep("quest_result");
  };

  if (step === "loading") return <div className={styles.root}><div className={styles.body}><div className={styles.promptText}>Carregando...</div></div></div>;

  const { level, name: lvName } = char ? calcLevel(char.xp) : { level: 1, name: "Novice" };
  const nxtXp = char ? nextXP(level) : null;
  const prog = (char && nxtXp) ? Math.min(char.xp / nxtXp, 1) : 1;
  const cls = char ? CLASSES[char.class] : null;

  return (
    <div className={styles.root}>
      <div className={styles.header}>
        <span className={styles.headerEmoji}>{cls?.emoji || "🎮"}</span>
        <div className={styles.headerMeta}>
          <span className={styles.headerTitle}>RPG Class Mode</span>
          <span className={styles.headerSub}>{char ? `${char.name} • Lv.${level} ${lvName}` : "Novo personagem"}</span>
        </div>
        <button className={styles.closeBtn} onClick={onClose}>✕</button>
      </div>

      <div className={styles.body}>
        {step === "create" && (
          <>
            <div className={styles.promptBox}>
              <div className={styles.promptTitle}>⚔️ Crie seu personagem</div>
              <div className={styles.promptText}>Escolha nome e classe para começar sua jornada.</div>
            </div>
            <input className={styles.input} placeholder="Nome do personagem" value={charName} onChange={(e) => setCharName(e.target.value)} />
            <div className={styles.classGrid}>
              {Object.entries(CLASSES).map(([key, info]) => (
                <button key={key} className={`${styles.classCard} ${selClass === key ? styles.classCardSelected : ""}`} onClick={() => setSelClass(key)}>
                  <span className={styles.classEmoji}>{info.emoji}</span>
                  <div className={styles.classInfo}>
                    <span className={styles.className}>{info.name}</span>
                    <span className={styles.classDesc}>{info.desc}</span>
                    <span className={styles.classFocus}>Timer: {info.focus} min</span>
                  </div>
                </button>
              ))}
            </div>
            <button className={`${styles.btn} ${styles.btnPrimary}`} onClick={createChar} disabled={!charName.trim()}>
              ✨ Criar personagem
            </button>
          </>
        )}

        {step === "dashboard" && char && (
          <>
            <div className={styles.promptBox}>
              <div className={styles.promptTitle}>{cls.emoji} {char.name}</div>
              <div className={styles.promptText}>{cls.name} — Nível {level} ({lvName})</div>
              <div style={{ marginTop: 8 }}>
                <div style={{ fontSize: 11, color: "var(--text-muted)", marginBottom: 5 }}>
                  XP: {char.xp}{nxtXp ? ` / ${nxtXp}` : " (MAX)"}
                </div>
                <div className={styles.xpBar}><div className={styles.xpFill} style={{ width: `${prog * 100}%` }} /></div>
              </div>
            </div>
            {[["Tarefas concluídas", char.totalTasks || 0], ["Tempo de foco total", `${char.totalFocus || 0} min`]].map(([l, v]) => (
              <div key={l} className={styles.statRow}><span className={styles.statLabel}>{l}</span><span className={styles.statValue}>{v}</span></div>
            ))}
            <div className={styles.actions}>
              <button className={`${styles.btn} ${styles.btnPrimary}`} onClick={() => available.length > 0 ? setStep("select_quest") : null} disabled={available.length === 0}>
                ⚔️ Selecionar Quest
              </button>
              <button className={`${styles.btn} ${styles.btnDanger}`} onClick={() => { if (window.confirm("Resetar personagem? Esta ação não pode ser desfeita.")) { localStorage.removeItem(LS_KEY); setChar(null); setCharName(""); setStep("create"); } }}>
                🗑 Resetar personagem
              </button>
            </div>
          </>
        )}

        {step === "select_quest" && (
          <TaskSelector tasks={available} onSelect={(t) => { setSelectedTask(t); setStep("select_difficulty"); }} onCancel={() => setStep("dashboard")} />
        )}

        {step === "select_difficulty" && selectedTask && (
          <>
            <div className={styles.taskDisplay}>
              <span className={styles.taskName}>{selectedTask.title}</span>
            </div>
            <div className={styles.promptBox}>
              <div className={styles.promptTitle}>Dificuldade da quest</div>
              <div className={styles.promptText}>A dificuldade define o XP ganho ao completar.</div>
            </div>
            <div className={styles.diffGrid}>
              {DIFFICULTIES.map((d) => (
                <button key={d.id} className={styles.diffBtn} onClick={() => { setDifficulty(d.id); setStep("ready_timer"); }}>
                  {d.label}<br /><span style={{ fontSize: 10, color: "var(--text-muted)" }}>{d.xpBase} XP</span>
                </button>
              ))}
            </div>
            <button className={`${styles.btn} ${styles.btnSecondary}`} onClick={() => setStep("select_quest")}>Voltar</button>
          </>
        )}

        {step === "ready_timer" && selectedTask && cls && (() => {
          const live = tasks.find((t) => t.id === selectedTask.id) || selectedTask;
          return (
            <>
              <div className={styles.infoPill}>{cls.emoji} Sessão de {cls.focus} minutos ({cls.name})</div>
              <div className={styles.taskDisplay}>
                <span className={styles.taskName}>{live.title}</span>
                {live.description && <span className={styles.taskMeta}>{live.description}</span>}
                {live.checklist?.length > 0 && (
                  <SubtaskFlow
                    checklist={live.checklist}
                    onToggle={(itemId) => onToggleChecklist?.(live.id, itemId)}
                    onAllDone={completeTask}
                    onSkip={() => setStep("timing")}
                  />
                )}
              </div>
              <SubtaskInline taskId={live.id} onAdd={onAddChecklist} />
              {!live.checklist?.length && (
                <button className={`${styles.btn} ${styles.btnPrimary}`} onClick={() => setStep("timing")}>
                  ▶ Iniciar quest ({cls.focus} min)
                </button>
              )}
            </>
          );
        })()}

        {step === "timing" && cls && (
          <CountdownTimer
            seconds={cls.focus * 60}
            title={selectedTask?.title}
            onComplete={() => completeQuest()}
            onCancel={() => setStep("post_timer_choice")}
          />
        )}

        {step === "post_timer_choice" && (
          <>
            <div className={styles.promptBox}>
              <div className={styles.promptTitle}>Timer cancelado</div>
              <div className={styles.promptText}>O que deseja fazer?</div>
            </div>
            <div className={styles.actions}>
              <button className={`${styles.btn} ${styles.btnPrimary}`} onClick={() => setStep("timing")}>Retomar timer</button>
              <button className={`${styles.btn} ${styles.btnSuccess}`} onClick={() => completeQuest()}>✅ Completar assim mesmo</button>
              <SubtaskInline taskId={selectedTask?.id} onAdd={onAddChecklist} />
              <button className={`${styles.btn} ${styles.btnSecondary}`} onClick={() => setStep("dashboard")}>Voltar ao dashboard</button>
            </div>
          </>
        )}

        {step === "quest_result" && char && (
          <>
            <div className={styles.summaryBox}>
              <span className={styles.summaryEmoji}>{leveledUp ? "🎉" : "✅"}</span>
              <div className={styles.summaryTitle}>{leveledUp ? "LEVEL UP!" : "Quest Completa!"}</div>
              <div className={styles.summaryText}>
                +{xpGained} XP{leveledUp ? ` — Nível ${calcLevel(char.xp).level} (${calcLevel(char.xp).name})!` : ""}
              </div>
            </div>
            <div className={styles.xpBar}>
              <div className={styles.xpFill} style={{ width: `${Math.min(char.xp / (nextXP(calcLevel(char.xp).level) || char.xp), 1) * 100}%` }} />
            </div>
            <button className={`${styles.btn} ${styles.btnPrimary}`} onClick={() => { setSelectedTask(null); setDifficulty(null); setStep("dashboard"); }}>
              Voltar ao Dashboard
            </button>
            <button className={`${styles.btn} ${styles.btnSecondary}`} onClick={onClose}>Encerrar sessão</button>
          </>
        )}
      </div>
    </div>
  );
}
