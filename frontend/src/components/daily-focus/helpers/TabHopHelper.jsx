import { useState } from "react";
import styles from "../DailyFocus.module.css";

export const DEFAULT_STATE = { tabs: [], currentIdx: 0, cycles: 0 };

export default function TabHopHelper({ state, onChange }) {
  const s = { ...DEFAULT_STATE, ...state };
  const [tabInput, setTabInput] = useState("");

  const addTab = () => {
    if (!tabInput.trim()) return;
    onChange({ ...s, tabs: [...s.tabs, { name: tabInput.trim(), visits: 0 }] });
    setTabInput("");
  };

  const nextTab = () => {
    if (s.tabs.length === 0) return;
    const updatedTabs = s.tabs.map((t, i) =>
      i === s.currentIdx ? { ...t, visits: t.visits + 1 } : t
    );
    const next = (s.currentIdx + 1) % s.tabs.length;
    const newCycles = next === 0 ? s.cycles + 1 : s.cycles;
    onChange({ ...s, tabs: updatedTabs, currentIdx: next, cycles: newCycles });
  };

  const currentTab = s.tabs[s.currentIdx];

  return (
    <div className={styles.helperPanelBody}>
      {s.tabs.length === 0 ? (
        <div>
          <div className={styles.helperInputLabel}>Adicione os apps/abas que vai usar</div>
          <div className={styles.helperRow}>
            <input
              className={styles.helperInput}
              placeholder="Ex: GitHub, Figma, Notion…"
              value={tabInput}
              onChange={(e) => setTabInput(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && addTab()}
            />
            <button className={styles.helperSmallBtn} onClick={addTab}>+</button>
          </div>
        </div>
      ) : (
        <>
          {currentTab && (
            <div className={styles.statRow}>
              <div className={styles.statItem} style={{ flex: 1 }}>
                <span className={styles.statNum} style={{ fontSize: 16 }}>{currentTab.name}</span>
                <span className={styles.statLabel}>aba atual · {currentTab.visits} visita{currentTab.visits !== 1 ? "s" : ""}</span>
              </div>
            </div>
          )}

          <div className={styles.tabDots}>
            {s.tabs.map((t, i) => (
              <div
                key={i}
                className={`${styles.tabDot} ${i < s.currentIdx ? styles.tabDotDone : i === s.currentIdx ? styles.tabDotActive : ""}`}
                title={t.name}
              />
            ))}
          </div>

          <div className={styles.helperRow}>
            <button
              className={`${styles.helperSmallBtn} ${styles.helperSmallBtnActive}`}
              style={{ flex: 1 }}
              onClick={nextTab}
            >
              Próxima: {s.tabs[(s.currentIdx + 1) % s.tabs.length]?.name || "—"} →
            </button>
            <button
              className={styles.helperSmallBtn}
              onClick={() => {
                const t = s.tabs;
                const ni = (s.currentIdx + 1) % t.length;
                onChange({ ...s, tabs: [...t, { name: tabInput, visits: 0 }] });
              }}
              style={{ display: "none" }}
            />
          </div>

          <div className={styles.helperRow}>
            <input
              className={styles.helperInput}
              placeholder="+ Nova aba"
              value={tabInput}
              onChange={(e) => setTabInput(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && addTab()}
            />
            <button className={styles.helperSmallBtn} onClick={addTab}>+</button>
          </div>

          {s.cycles > 0 && (
            <div className={styles.textCenter}>
              <span className={styles.tag}>🔄 {s.cycles} ciclo{s.cycles !== 1 ? "s" : ""}</span>
            </div>
          )}
        </>
      )}
    </div>
  );
}
