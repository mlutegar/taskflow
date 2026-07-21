import { memo } from "react";
import { getHistory, getMaxLevel, getStats } from "../../../lib/dailyFocusHistory";
import { getAllWithStatus } from "../../../lib/dailyFocusAchievements";
import ModalOverlay from "../../shared/ModalOverlay";
import styles from "../DailyFocus.module.css";

function HistoryPanel({ onClose }) {
  const history = getHistory();
  const maxLevel = getMaxLevel();
  const achievements = getAllWithStatus();
  const stats = getStats();

  return (
    <ModalOverlay onClose={onClose}>
      <div className={styles.modal} style={{ maxHeight: "90vh" }}>
        <div className={styles.modalHeader}>
          <span className={styles.modalTitle}>📋 Histórico & Conquistas</span>
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
