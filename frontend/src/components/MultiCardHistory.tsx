import { useMemo } from "react";
import { getMultiCardSessions, MultiCardSessionEntry } from "../lib/multiCardSessionLog";
import { MODES } from "../data/modes";
import { getCustomModes } from "../lib/customModes";
import styles from "./MultiCardHistory.module.css";

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

function formatDateTime(iso: string): string {
  return new Date(iso).toLocaleString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function exportToCSV(sessions: MultiCardSessionEntry[]): void {
  const header = ["id", "cards", "startedAt", "endedAt", "durationMinutes", "focusedMinutes", "worked", "feelings", "idleReason"];
  const rows = sessions.map((s) => [
    s.id,
    s.cards.join(" + "),
    s.startedAt,
    s.endedAt,
    s.durationMinutes,
    s.focusedMinutes,
    s.worked ? "true" : "false",
    s.feelings.join(";"),
    s.idleReason.join(";"),
  ]);
  const csvContent = [header, ...rows]
    .map((row) => row.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(","))
    .join("\n");
  const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  const today = new Date().toISOString().slice(0, 10);
  link.href = url;
  link.download = `sessoes-multicard-${today}.csv`;
  link.click();
  URL.revokeObjectURL(url);
}

export default function MultiCardHistory(): JSX.Element {
  const sessions = useMemo(() => {
    const all = getMultiCardSessions();
    return [...all].sort((a, b) => new Date(b.startedAt).getTime() - new Date(a.startedAt).getTime());
  }, []);

  const modeMap = useMemo(() => buildModeMap(), []);

  const handleExport = (): void => {
    exportToCSV(getMultiCardSessions());
  };

  return (
    <div className={styles.root}>
      <div className={styles.header}>
        <h2 className={styles.title}>Historico de sessoes</h2>
        <button className={styles.exportBtn} onClick={handleExport} title="Exportar dados como CSV">
          Exportar dados
        </button>
      </div>

      {sessions.length === 0 ? (
        <div className={styles.emptyState}>
          <span className={styles.emptyIcon}>📭</span>
          <p>Nenhuma sessão registrada ainda</p>
        </div>
      ) : (
        <div className={styles.list}>
          {sessions.map((session) => (
            <div key={session.id} className={styles.card}>
              <div className={styles.cardTop}>
                <span className={styles.dateTime}>{formatDateTime(session.startedAt)}</span>
                <span className={`${styles.workedBadge} ${session.worked ? styles.workedYes : styles.workedNo}`}>
                  {session.worked ? "✅ Funcionou" : "❌ Não funcionou"}
                </span>
              </div>

              <div className={styles.chips}>
                {session.cards.map((cardId) => {
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

              <div className={styles.stats}>
                <span className={styles.stat}>
                  <span className={styles.statLabel}>Duracao</span>
                  <span className={styles.statValue}>{session.durationMinutes} min</span>
                </span>
                <span className={styles.stat}>
                  <span className={styles.statLabel}>Focado</span>
                  <span className={styles.statValue}>{session.focusedMinutes} min</span>
                </span>
              </div>

              {session.feelings.length > 0 && (
                <div className={styles.feelings}>
                  {session.feelings.map((f, i) => (
                    <span key={i} className={styles.feelingChip}>{f}</span>
                  ))}
                </div>
              )}

              {session.cards.length > 0 && (session as MultiCardSessionEntry & { cardRatings?: Record<string, number> }).cardRatings && (
                <div className={styles.ratings}>
                  {Object.entries((session as MultiCardSessionEntry & { cardRatings: Record<string, number> }).cardRatings).map(([cardId, rating]) => {
                    const mode = modeMap[cardId];
                    return (
                      <span key={cardId} className={styles.ratingItem}>
                        {mode ? `${mode.emoji} ${mode.name}` : cardId}: {rating}/5
                      </span>
                    );
                  })}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
