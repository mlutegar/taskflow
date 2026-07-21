import { memo } from "react";
import { getHistory, getMaxLevel, getStats } from "../../../lib/dailyFocusHistory";
import { ESTADOS_DEFAULT } from "../stateToMode";
import { getAllWithStatus } from "../../../lib/dailyFocusAchievements";
import { getCheckinLog } from "../../../lib/checkinLog";
import ModalOverlay from "../../shared/ModalOverlay";
import styles from "../DailyFocus.module.css";

function HistoryPanel({ onClose }) {
  const history = getHistory();
  const maxLevel = getMaxLevel();
  const achievements = getAllWithStatus();
  const stats = getStats();

  // Melhoria 2 — gráfico de frequência de estados
  const checkinLog = getCheckinLog();
  const estadoCounts = {};
  for (const e of checkinLog) {
    if (e.estadoId) estadoCounts[e.estadoId] = (estadoCounts[e.estadoId] || 0) + 1;
  }
  const estadoChartData = ESTADOS_DEFAULT
    .map((e) => ({ ...e, count: estadoCounts[e.id] || 0 }))
    .filter((e) => e.count > 0)
    .sort((a, b) => b.count - a.count);
  const maxCount = estadoChartData[0]?.count || 1;

  // Melhoria 5 — correlação estado → resultado
  const estadoSuccesses = {};
  for (const entry of history) {
    if (entry.estadoId) {
      estadoSuccesses[entry.estadoId] = (estadoSuccesses[entry.estadoId] || 0) + 1;
    }
  }
  const bestEstado = Object.entries(estadoSuccesses)
    .sort((a, b) => b[1] - a[1])[0];
  const bestEstadoInfo = bestEstado
    ? ESTADOS_DEFAULT.find((e) => e.id === bestEstado[0])
    : null;

  // Melhoria 9 — export de dados em JSON
  function handleExport() {
    const data = {
      exportedAt: new Date().toISOString(),
      sessions: history,
      checkinLog,
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
              {bestEstadoInfo && (
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
                      {entry.tasks.map((title, j) => {
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
