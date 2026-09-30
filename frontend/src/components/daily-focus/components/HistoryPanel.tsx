import { memo } from "react";
import { getHistory, getMaxLevel, getStats } from "../../../lib/dailyFocusHistory";
import { ESTADOS_DEFAULT } from "../stateToMode";
import { getAllWithStatus } from "../../../lib/dailyFocusAchievements";
import { getCheckinLog } from "../../../lib/checkinLog";
import { getEmotionLog, getEmotionsByHour, getEmotionCounts } from "../../../lib/emotionLog";
import { getEmotionById } from "../../../data/emotions";
import ModalOverlay from "../../shared/ModalOverlay";
import styles from "../DailyFocus.module.css";

interface HistoryPanelProps {
  onClose: () => void;
}

function HistoryPanel({ onClose }: HistoryPanelProps) {
  const history = getHistory();
  const maxLevel = getMaxLevel();
  const achievements = getAllWithStatus();
  const stats = getStats();

  // Melhoria 2 — gráfico de frequência de estados
  const checkinLog = getCheckinLog();
  const estadoCounts: Record<string, number> = {};
  for (const e of checkinLog) {
    if (e.estadoId) estadoCounts[e.estadoId] = (estadoCounts[e.estadoId] || 0) + 1;
  }
  const estadoChartData = ESTADOS_DEFAULT
    .map((e) => ({ ...e, count: estadoCounts[e.id] || 0 }))
    .filter((e) => e.count > 0)
    .sort((a, b) => b.count - a.count);
  const maxCount = estadoChartData[0]?.count || 1;

  // Melhoria 5 — correlação estado → resultado
  const estadoSuccesses: Record<string, number> = {};
  for (const entry of history) {
    if (entry.estadoId) {
      estadoSuccesses[entry.estadoId] = (estadoSuccesses[entry.estadoId] || 0) + 1;
    }
  }
  const bestEstado = Object.entries(estadoSuccesses)
    .sort((a, b) => b[1] - a[1])[0] as [string, number] | undefined;
  const bestEstadoInfo = bestEstado
    ? ESTADOS_DEFAULT.find((e) => e.id === bestEstado[0])
    : null;

  // Checkpoints emocionais (Play / Retomar / Fim) — heatmap por hora
  const emotionLog = getEmotionLog();
  const emotionByHour = getEmotionsByHour(emotionLog);
  const emotionHours = Object.keys(emotionByHour)
    .map(Number)
    .sort((a, b) => a - b);
  const emotionTotals = getEmotionCounts(undefined, emotionLog);
  const emotionRank = Object.entries(emotionTotals).sort((a, b) => b[1] - a[1]);
  const maxHourTotal = emotionHours.reduce((mx, h) => {
    const total = Object.values(emotionByHour[h]).reduce((s, n) => s + n, 0);
    return Math.max(mx, total);
  }, 1);

  // Melhoria 9 — export de dados em JSON
  function handleExport(): void {
    const data = {
      exportedAt: new Date().toISOString(),
      sessions: history,
      checkinLog,
      emotionLog,
      stats,
    };
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `taskflow-historico-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <ModalOverlay onClose={onClose}>
      <div className={styles.modal} style={{ maxHeight: "90vh" }}>
        <div className={styles.modalHeader}>
          <span className={styles.modalTitle}>📋 Histórico & Conquistas</span>
          <button
            onClick={handleExport}
            title="Exportar histórico em JSON"
            style={{
              background: "none",
              border: "1px solid var(--border)",
              borderRadius: "6px",
              cursor: "pointer",
              fontSize: "13px",
              color: "var(--text-muted)",
              padding: "2px 8px",
              marginRight: "4px",
            }}
          >
            ⬇ exportar
          </button>
          <button className={styles.modalClose} onClick={onClose}>×</button>
        </div>
        <div className={styles.modalBody}>
          {/* Stats grid */}
          {stats && (
            <div className={styles.historySection}>
              <div className={styles.historySectionLabel}>📊 Estatísticas</div>
              <div className={styles.statsGrid}>
                <div className={styles.statCard}>
                  <div className={styles.statValue}>{stats.totalSessions}</div>
                  <div className={styles.statLabel}>sessões</div>
                </div>
                <div className={styles.statCard}>
                  <div className={styles.statValue}>{stats.totalTasks}</div>
                  <div className={styles.statLabel}>tarefas feitas</div>
                </div>
                <div className={styles.statCard}>
                  <div className={styles.statValue}>{stats.avgLevel}</div>
                  <div className={styles.statLabel}>nível médio</div>
                </div>
                <div className={styles.statCard}>
                  <div className={styles.statValue}>{stats.streak > 0 ? `🔥 ${stats.streak}` : "—"}</div>
                  <div className={styles.statLabel}>dias seguidos</div>
                </div>
                <div className={styles.statCard}>
                  <div className={styles.statValue}>{stats.maxLevel || "—"}</div>
                  <div className={styles.statLabel}>nível máx.</div>
                </div>
                <div className={styles.statCard}>
                  <div className={styles.statValue}>{stats.rushCount}</div>
                  <div className={styles.statLabel}>sessões rush</div>
                </div>
              </div>
              {bestEstadoInfo && bestEstado && (
                <div style={{
                  marginTop: "10px",
                  padding: "8px 12px",
                  background: "var(--surface-2)",
                  borderRadius: "var(--radius-sm)",
                  fontSize: "12px",
                  color: "var(--text-muted)",
                  display: "flex",
                  alignItems: "center",
                  gap: "6px",
                }}>
                  <span style={{ fontSize: "16px" }}>{bestEstadoInfo.emoji}</span>
                  <span>
                    Você completou <strong>{bestEstado[1]} sessão{bestEstado[1] !== 1 ? "ões" : ""}</strong> mesmo{" "}
                    <strong>{bestEstadoInfo.label.toLowerCase()}</strong>. Isso é resiliência.
                  </span>
                </div>
              )}
            </div>
          )}

          {/* Max level */}
          <div className={styles.historySection}>
            <div className={styles.historySectionLabel}>🏆 Nível Máximo</div>
            <div className={styles.maxLevelDisplay}>
              <span className={styles.maxLevelNum}>{maxLevel || "—"}</span>
              {maxLevel >= 3 && <span className={styles.tag} style={{ fontSize: 13 }}>🔥 Em Chamas</span>}
              {maxLevel >= 5 && <span className={styles.tag} style={{ fontSize: 13 }}>👑 Lenda</span>}
            </div>
          </div>

          {/* Achievements */}
          <div className={styles.historySection}>
            <div className={styles.historySectionLabel}>🎖️ Conquistas</div>
            <div className={styles.achievementsGrid}>
              {achievements.map((a) => (
                <div key={a.id} className={`${styles.achievementItem} ${!a.unlocked ? styles.achievementLocked : ""}`} title={a.desc}>
                  <span className={styles.achievementEmoji}>{a.emoji}</span>
                  <span className={styles.achievementName}>{a.name}</span>
                  {!a.unlocked && <span className={styles.achievementLockedIcon}>🔒</span>}
                </div>
              ))}
            </div>
          </div>

          {/* Estado frequency chart */}
          {estadoChartData.length > 0 && (
            <div className={styles.historySection}>
              <div className={styles.historySectionLabel}>🧠 Seus estados mais frequentes</div>
              <div style={{ display: "flex", flexDirection: "column", gap: "6px", marginTop: "8px" }}>
                {estadoChartData.map((e) => (
                  <div key={e.id} style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                    <span style={{ width: "22px", textAlign: "center", fontSize: "14px" }}>{e.emoji}</span>
                    <span style={{ width: "80px", fontSize: "12px", color: "var(--text-muted)" }}>{e.label}</span>
                    <div style={{ flex: 1, background: "var(--surface-2)", borderRadius: "4px", height: "10px", overflow: "hidden" }}>
                      <div style={{
                        width: `${(e.count / maxCount) * 100}%`,
                        background: "var(--primary)",
                        height: "100%",
                        borderRadius: "4px",
                        transition: "width 0.5s ease",
                      }} />
                    </div>
                    <span style={{ fontSize: "11px", color: "var(--text-muted)", width: "28px", textAlign: "right" }}>
                      {e.count}x
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Checkpoints emocionais — heatmap por hora do dia */}
          {emotionLog.length > 0 && (
            <div className={styles.historySection}>
              <div className={styles.historySectionLabel}>💗 Emoção ao longo do dia</div>

              {/* Ranking compacto */}
              <div style={{ display: "flex", flexWrap: "wrap", gap: "6px", margin: "8px 0 12px" }}>
                {emotionRank.map(([id, n]) => {
                  const em = getEmotionById(id);
                  return (
                    <span key={id} style={{
                      fontSize: "12px",
                      padding: "3px 8px",
                      borderRadius: "999px",
                      background: "var(--surface-2)",
                      border: `1px solid ${em?.color ?? "var(--border)"}`,
                      color: "var(--text)",
                    }}>
                      {em?.emoji ?? ""} {em?.label ?? id} <strong>{n}</strong>
                    </span>
                  );
                })}
              </div>

              {/* Heatmap: uma coluna por hora com dado; cor = emoção dominante, opacidade = volume */}
              <div style={{ display: "flex", gap: "4px", alignItems: "flex-end", flexWrap: "wrap" }}>
                {emotionHours.map((h) => {
                  const byEmotion = emotionByHour[h];
                  const total = Object.values(byEmotion).reduce((s, n) => s + n, 0);
                  const [domId] = Object.entries(byEmotion).sort((a, b) => b[1] - a[1])[0];
                  const em = getEmotionById(domId);
                  const opacity = 0.35 + 0.65 * (total / maxHourTotal);
                  const tip = Object.entries(byEmotion)
                    .map(([id, n]) => `${getEmotionById(id)?.label ?? id}: ${n}`)
                    .join(", ");
                  return (
                    <div key={h} style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: "3px" }} title={`${h}h — ${tip}`}>
                      <div style={{
                        width: "22px",
                        height: "22px",
                        borderRadius: "5px",
                        background: em?.color ?? "var(--primary)",
                        opacity,
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        fontSize: "12px",
                      }}>{em?.emoji ?? ""}</div>
                      <span style={{ fontSize: "9px", color: "var(--text-muted)" }}>{h}h</span>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Session history */}
          <div className={styles.historySection}>
            <div className={styles.historySectionLabel}>📅 Sessões ({history.length})</div>
            {history.length === 0 ? (
              <div className={styles.emptyState}>Nenhuma sessão completada ainda.</div>
            ) : (
              <div className={styles.historyList}>
                {history.map((entry, i) => (
                  <div key={i} className={styles.historyEntry}>
                    <div className={styles.historyEntryHeader}>
                      <span className={styles.historyEntryLevel}>Nível {entry.level}</span>
                      {entry.rushMode && <span className={styles.tag}>🚀 Rush</span>}
                      {entry.estadoId && (() => {
                        const est = ESTADOS_DEFAULT.find((e) => e.id === entry.estadoId);
                        return est ? (
                          <span className={styles.tag} title={est.label}>
                            {est.emoji} {est.label}
                          </span>
                        ) : null;
                      })()}
                      <span className={styles.historyEntryDate}>{entry.date} · {entry.completedAt}</span>
                    </div>
                    <div className={styles.historyEntryTasks}>
                      {entry.tasks.map((title: string, j: number) => {
                        const timing = entry.timings?.[j];
                        return (
                          <div key={j} className={styles.historyTask}>
                            <span className={styles.historyTaskCheck}>✓</span>
                            <span className={styles.historyTaskTitle}>{title}</span>
                            {timing && (
                              <span className={`${styles.historyTaskTime} ${timing.used < timing.total ? styles.success : ""}`}>
                                {timing.used}/{timing.total}min
                              </span>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </ModalOverlay>
  );
}

export default memo(HistoryPanel);
