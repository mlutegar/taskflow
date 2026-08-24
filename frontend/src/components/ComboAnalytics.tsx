import { useMemo } from "react";
import { getMultiCardSessions } from "../lib/multiCardSessionLog";
import { MODES } from "../data/modes";
import { getCustomModes } from "../lib/customModes";
import styles from "./ComboAnalytics.module.css";

function buildModeMap(): Record<string, { emoji: string; name: string; color: string; colorBg: string }> {
  const customModes = getCustomModes();
  const map: Record<string, { emoji: string; name: string; color: string; colorBg: string }> = {};
  for (const m of MODES) {
    map[m.id] = { emoji: m.emoji, name: m.name, color: m.color, colorBg: m.colorBg };
  }
  for (const m of customModes) {
    map[m.id] = { emoji: m.emoji, name: m.name, color: m.color, colorBg: m.colorBg };
  }
  return map;
}

interface ComboStat {
  key: string;
  cards: string[];
  totalSessions: number;
  workedCount: number;
  successRate: number;
  avgFocusedMinutes: number;
}

export default function ComboAnalytics(): JSX.Element {
  const modeMap = useMemo(() => buildModeMap(), []);

  const topCombos = useMemo((): ComboStat[] => {
    const sessions = getMultiCardSessions();
    const groups: Record<string, { cards: string[]; sessions: typeof sessions }> = {};

    for (const s of sessions) {
      const key = [...s.cards].sort().join("|");
      if (!groups[key]) {
        groups[key] = { cards: [...s.cards].sort(), sessions: [] };
      }
      groups[key].sessions.push(s);
    }

    return Object.entries(groups)
      .filter(([, g]) => g.sessions.length >= 2)
      .map(([key, g]) => {
        const workedCount = g.sessions.filter((s) => s.worked).length;
        const successRate = workedCount / g.sessions.length;
        const avgFocusedMinutes =
          g.sessions.reduce((sum, s) => sum + (s.focusedMinutes || 0), 0) / g.sessions.length;
        return {
          key,
          cards: g.cards,
          totalSessions: g.sessions.length,
          workedCount,
          successRate,
          avgFocusedMinutes: Math.round(avgFocusedMinutes),
        };
      })
      .sort((a, b) => b.successRate - a.successRate)
      .slice(0, 5);
  }, []);

  if (topCombos.length === 0) {
    return (
      <div className={styles.root}>
        <h3 className={styles.title}>Combinações mais eficazes</h3>
        <div className={styles.empty}>
          <span>📊</span>
          <p>Registre pelo menos 2 sessões com a mesma combinação para ver análises.</p>
        </div>
      </div>
    );
  }

  return (
    <div className={styles.root}>
      <h3 className={styles.title}>Combinações mais eficazes</h3>
      <div className={styles.list}>
        {topCombos.map((combo, index) => (
          <div key={combo.key} className={styles.item}>
            <span className={styles.rank}>#{index + 1}</span>

            <div className={styles.content}>
              <div className={styles.chips}>
                {combo.cards.map((cardId) => {
                  const mode = modeMap[cardId];
                  if (!mode) return (
                    <span key={cardId} className={styles.chip} style={{ background: "rgba(255,255,255,0.08)" }}>
                      {cardId}
                    </span>
                  );
                  return (
                    <span
                      key={cardId}
                      className={styles.chip}
                      style={{ background: mode.colorBg, borderColor: mode.color, color: mode.color }}
                    >
                      {mode.emoji} {mode.name}
                    </span>
                  );
                })}
              </div>

              <div className={styles.barRow}>
                <div className={styles.barTrack}>
                  <div
                    className={styles.barFill}
                    style={{ width: `${Math.round(combo.successRate * 100)}%` }}
                  />
                </div>
                <span className={styles.pct}>{Math.round(combo.successRate * 100)}%</span>
              </div>

              <div className={styles.meta}>
                <span>{combo.totalSessions} sessão{combo.totalSessions !== 1 ? "ões" : ""}</span>
                <span>•</span>
                <span>Média {combo.avgFocusedMinutes} min focados</span>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
