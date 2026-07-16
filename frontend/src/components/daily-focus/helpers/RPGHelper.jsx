import { useState, useEffect } from "react";
import styles from "../DailyFocus.module.css";

const LS_KEY = "taskflow_rpg_save";
const XP_PER_LEVEL = 50;
const DIFFICULTIES = [
  { id: "easy", label: "Easy", xp: 5 },
  { id: "medium", label: "Medium", xp: 10 },
  { id: "hard", label: "Hard", xp: 20 },
  { id: "very_hard", label: "Very Hard", xp: 30 },
];
const CLASSES = [
  { emoji: "⚔️", name: "Warrior" },
  { emoji: "🧙‍♂️", name: "Mage" },
  { emoji: "🗡️", name: "Rogue" },
];

export const DEFAULT_STATE = { difficulty: "medium", xpThisSession: 0, questsDone: 0 };

export default function RPGHelper({ state, onChange }) {
  const s = { ...DEFAULT_STATE, ...state };
  const [char, setChar] = useState(() => {
    try { return JSON.parse(localStorage.getItem(LS_KEY)); } catch { return null; }
  });
  const [creating, setCreating] = useState(!char);
  const [nameInput, setNameInput] = useState("");
  const [classInput, setClassInput] = useState("Warrior");

  const saveChar = () => {
    if (!nameInput.trim()) return;
    const c = { name: nameInput.trim(), class: classInput, xp: 0, totalTasks: 0, totalFocus: 0 };
    localStorage.setItem(LS_KEY, JSON.stringify(c));
    setChar(c);
    setCreating(false);
  };

  const completeQuest = () => {
    const diff = DIFFICULTIES.find((d) => d.id === s.difficulty);
    let bonus = 1;
    if (char?.class === "Mage" && (s.difficulty === "medium" || s.difficulty === "hard")) bonus = 1.25;
    if (char?.class === "Rogue" && s.difficulty === "easy") bonus = 1.5;
    const xpGained = Math.round(diff.xp * bonus);
    const newXp = (char?.xp || 0) + xpGained;
    const updated = { ...char, xp: newXp, totalTasks: (char?.totalTasks || 0) + 1 };
    localStorage.setItem(LS_KEY, JSON.stringify(updated));
    setChar(updated);
    onChange({ ...s, xpThisSession: (s.xpThisSession || 0) + xpGained, questsDone: (s.questsDone || 0) + 1 });
  };

  if (creating) {
    return (
      <div className={styles.helperPanelBody}>
        <div className={styles.helperInputLabel}>Nome do personagem</div>
        <input
          className={styles.helperInput}
          placeholder="Seu nome"
          value={nameInput}
          onChange={(e) => setNameInput(e.target.value)}
        />
        <div className={styles.helperInputLabel}>Classe</div>
        <div className={styles.variantRow}>
          {CLASSES.map((c) => (
            <button
              key={c.name}
              className={`${styles.variantBtn} ${classInput === c.name ? styles.variantBtnActive : ""}`}
              onClick={() => setClassInput(c.name)}
            >
              {c.emoji} {c.name}
            </button>
          ))}
        </div>
        <button className={`${styles.helperSmallBtn} ${styles.helperSmallBtnActive}`} style={{ width: "100%" }} onClick={saveChar}>
          Criar personagem
        </button>
      </div>
    );
  }

  const level = Math.floor((char?.xp || 0) / XP_PER_LEVEL) + 1;
  const xpInLevel = (char?.xp || 0) % XP_PER_LEVEL;
  const cls = CLASSES.find((c) => c.name === char?.class) || CLASSES[0];

  return (
    <div className={styles.helperPanelBody}>
      <div className={styles.helperRow}>
        <span style={{ fontSize: 24 }}>{cls.emoji}</span>
        <div className={styles.flexCol} style={{ flex: 1, gap: 2 }}>
          <span className={styles.bold}>{char?.name} — Nível {level}</span>
          <span className={styles.smallText}>{cls.name} · {char?.totalTasks || 0} quests</span>
        </div>
        {s.questsDone > 0 && (
          <span className={styles.tag}>+{s.xpThisSession} XP</span>
        )}
      </div>

      <div>
        <div className={styles.xpBarTrack}>
          <div className={styles.xpBarFill} style={{ width: `${(xpInLevel / XP_PER_LEVEL) * 100}%` }} />
        </div>
        <div className={styles.xpLabel}>{xpInLevel} / {XP_PER_LEVEL} XP</div>
      </div>

      <div>
        <div className={styles.helperInputLabel}>Dificuldade da quest</div>
        <div className={styles.variantRow}>
          {DIFFICULTIES.map((d) => (
            <button
              key={d.id}
              className={`${styles.variantBtn} ${s.difficulty === d.id ? styles.variantBtnActive : ""}`}
              onClick={() => onChange({ ...s, difficulty: d.id })}
            >
              {d.label} (+{d.xp})
            </button>
          ))}
        </div>
      </div>

      <button
        className={`${styles.helperSmallBtn} ${styles.helperSmallBtnActive}`}
        style={{ width: "100%" }}
        onClick={completeQuest}
      >
        ⚔️ Quest concluída
      </button>
    </div>
  );
}
