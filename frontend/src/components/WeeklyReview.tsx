import { useState, useMemo } from "react";
import { getHistory } from "../lib/dailyFocusHistory";
import { getUsageLogs } from "../lib/sessionUsageLog";
import { usageStats } from "../lib/modeLog";
import { MODES } from "../data/modes";
import { storageGet, storageSet } from "../lib/storage";
import styles from "./WeeklyReview.module.css";
import { parsePtBR, ptBRtoISO, daysAgoISO } from "../lib/dateUtils";

const INTENTIONS_KEY = "taskflow.weeklyIntentions";

const daysAgoIso = daysAgoISO;
const toIso      = ptBRtoISO;

interface WeeklyReviewProps {
  onClose: () => void;
}

export default function WeeklyReview({ onClose }: WeeklyReviewProps): JSX.Element {
  const cutoff = daysAgoIso(7);

  const { weekSessions, topMode, bestMode, totalTasks, totalFocusMin } = useMemo(() => {
    const allHistory = getHistory();
    const weekSessions = allHistory.filter((e: any) => toIso(e.date) >= cutoff);
    const totalTasks = weekSessions.reduce((s: number, e: any) => s + e.tasks.length, 0);

    const logs = getUsageLogs().filter((l: any) => l.date >= cutoff);
    const totalFocusMin = logs.reduce((s: number, l: any) => s + (l.focusedMinutes || 0), 0);

    const stats = usageStats(7);
    const topModeEntry = stats[0];
    const topMode = topModeEntry ? MODES.find((m: any) => m.id === topModeEntry.modeId) : null;

    // Best mode by success rate (≥ 2 sessions)
    const modeSucc: Record<string, number> = {};
    const modeTotal: Record<string, number> = {};
    for (const l of logs) {
      modeTotal[l.modeId] = (modeTotal[l.modeId] || 0) + 1;
      if (l.worked) modeSucc[l.modeId] = (modeSucc[l.modeId] || 0) + 1;
    }
    const bestEntry = Object.entries(modeTotal)
      .filter(([, t]) => t >= 2)
      .map(([id, t]) => ({ id, rate: Math.round(((modeSucc[id] || 0) / t) * 100) }))
      .sort((a, b) => b.rate - a.rate)[0];
    const bestMode = bestEntry ? MODES.find((m: any) => m.id === bestEntry.id) : null;

    return { weekSessions, topMode, bestMode, totalTasks, totalFocusMin };
  }, []);

  const [intentions, setIntentions] = useState<string[]>(() => {
    const saved = storageGet(INTENTIONS_KEY, []);
    return Array.isArray(saved) && saved.length === 3 ? saved : ["", "", ""];
  });
  const [saved, setSaved] = useState<boolean>(false);

  const handleSave = (): void => {
    storageSet(INTENTIONS_KEY, intentions.map((s) => s.trim()));
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  const focusHours = Math.round(totalFocusMin / 6) / 10;

  return (
    <div className={styles.overlay} onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className={styles.modal}>
        <div className={styles.header}>
          <h2 className={styles.title}>📅 Revisão Semanal</h2>
          <button className={styles.closeBtn} onClick={onClose} aria-label="Fechar">✕</button>
        </div>

        <div className={styles.body}>
          {/* Olhando para trás */}
          <div className={styles.section}>
            <div className={styles.sectionTitle}>🔙 Olhando para a semana</div>
            <div className={styles.statsGrid}>
              <div className={styles.statCard}>
                <div className={styles.statValue}>{weekSessions.length}</div>
                <div className={styles.statLabel}>Sessões</div>
              </div>
              <div className={styles.statCard}>
                <div className={styles.statValue}>{totalTasks}</div>
                <div className={styles.statLabel}>Tarefas concluídas</div>
              </div>
              <div className={styles.statCard}>
                <div className={styles.statValue}>{focusHours}h</div>
                <div className={styles.statLabel}>Foco registrado</div>
              </div>
            </div>

            {weekSessions.length === 0 && (
              <p className={styles.emptyNote}>Nenhuma sessão registrada nos últimos 7 dias.</p>
            )}

            {topMode && (
              <div className={styles.insight}>
                <span className={styles.insightEmoji}>{(topMode as any).emoji}</span>
                <div>
                  <strong>{(topMode as any).name}</strong> foi seu modo mais usado essa semana.
                </div>
              </div>
            )}

            {bestMode && (
              <div className={`${styles.insight} ${styles.insightSuccess}`}>
                <span className={styles.insightEmoji}>{(bestMode as any).emoji}</span>
                <div>
                  <strong>{(bestMode as any).name}</strong> teve a melhor taxa de sucesso da semana.
                </div>
              </div>
            )}
          </div>

          {/* Intenções */}
          <div className={styles.section}>
            <div className={styles.sectionTitle}>🎯 3 intenções para a próxima semana</div>
            <p className={styles.sectionHint}>O que você quer focar? Seja específico e realista.</p>
            {intentions.map((val, i) => (
              <div key={i} className={styles.intentionRow}>
                <span className={styles.intentionNum}>{i + 1}</span>
                <input
                  className={styles.intentionInput}
                  value={val}
                  onChange={(e) => {
                    const next = [...intentions];
                    next[i] = e.target.value;
                    setIntentions(next);
                  }}
                  placeholder={
                    i === 0 ? "Ex: completar o módulo 3 do projeto X" :
                    i === 1 ? "Ex: sair do celular após 22h" :
                    "Ex: meditar 5 min antes de começar"
                  }
                />
              </div>
            ))}
            <button className={styles.saveBtn} onClick={handleSave}>
              {saved ? "✓ Salvo!" : "Salvar intenções"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
