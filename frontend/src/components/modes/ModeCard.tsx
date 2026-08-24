import React, { memo } from "react";
import styles from "../ModesPanel.module.css";
import { getModeSuccessRate, getBestHourForMode, getFocusedMinutesByMode, getModeEfficiencyHistory, getModeNotes, getModeEfficiencyComparison, getUsageLogs } from "../../lib/sessionUsageLog";
import { MODES } from "../../data/modes";
import { storageSet } from "../../lib/storage";
import { SK } from "../../lib/storageKeys";
import type { ModeConfig } from "./types";

// ── Props ──────────────────────────────────────────────────────────────────────
// All primitive/scalar props so React.memo can do shallow equality comparison.
export interface ModeCardProps {
  mode: ModeConfig;
  index: number;
  // Expansion
  open: boolean;                // expanded === mode.id
  compactView: boolean;
  // Session
  isActiveSession: boolean;     // activeSession?.id === mode.id
  sessionRef: React.RefObject<HTMLDivElement>;
  // Sorting / sequence
  sortBy: string;
  inRandomMode: boolean;        // sortBy === "random"
  wasStartedInSeq: boolean;
  isNextGuided: boolean;
  // Stats
  taskCount: number;            // modeStats[mode.id] || 0
  activationCount: number;      // activations[mode.id] || 0
  usedToday: boolean;
  smartScore: number;           // smartScores[mode.id] ?? 0
  // Combo
  isComboSelected: boolean;
  comboCount: number;
  // Efficiency ranking
  avgEfficiency?: number | null;
  // Favorites
  isFavorite: boolean;
  // Flash animation
  flashingCard: string | null;
  // Callbacks (must be stable refs — use useCallback in parent)
  onToggle: (id: string) => void;
  onFavorite: (id: string) => void;
  onCombo: (id: string) => void;
  onStart: (mode: ModeConfig) => void;
  onDelete: (id: string) => void;
  onUnpin: (activity: string) => void;
  onFlash: (id: string | null) => void;
  onSequenceAdd: (id: string) => void;
}

// ── Component ──────────────────────────────────────────────────────────────────
function ModeCard({
  mode,
  index,
  open,
  compactView,
  isActiveSession,
  sessionRef,
  sortBy,
  inRandomMode,
  wasStartedInSeq,
  isNextGuided,
  taskCount,
  activationCount,
  usedToday,
  smartScore,
  isComboSelected,
  comboCount,
  avgEfficiency,
  isFavorite,
  flashingCard,
  onToggle,
  onFavorite,
  onCombo,
  onStart,
  onDelete,
  onUnpin,
  onFlash,
  onSequenceAdd,
}: ModeCardProps) {
  if (compactView) {
    return (
      <div
        className={styles.compactCard}
        style={{ borderLeft: "3px solid " + mode.color }}
        onClick={() => onStart(mode)}
      >
        <span className={styles.compactEmoji}>{mode.emoji}</span>
        <div className={styles.compactInfo}>
          <strong>{mode.name}</strong>
          <span className={styles.compactTagline}>{mode.tagline}</span>
        </div>
        {usedToday && <span className={styles.usedTodayBadge}>hoje</span>}
      </div>
    );
  }

  const showSmartBadge = sortBy === "smart" && smartScore >= 2 && index < 3;
  const successRate = getModeSuccessRate(mode.id);
  const bestHour = getBestHourForMode(mode.id);

  const handleStartClick = (): void => {
    onFlash(mode.id);
    setTimeout(() => onFlash(null), 450);
    if (inRandomMode) {
      onSequenceAdd(mode.id);
    }
    setTimeout(() => onStart(mode), 150);
  };

  return (
    <div
      className={`${styles.card} ${open ? styles.cardOpen : ""} ${mode.isCustom ? styles.cardCustom : ""} ${isComboSelected ? styles.cardComboSelected : ""} ${isActiveSession ? styles.cardActive : ""} ${isNextGuided ? styles.guidedNext : ""} ${wasStartedInSeq ? styles.seqDone : ""} ${avgEfficiency != null && avgEfficiency >= 70 ? styles.cardHighEff : ""}`}
      style={{ "--mode-color": mode.color, "--mode-bg": mode.colorBg } as React.CSSProperties}
    >
      <div className={styles.cardHeader}>
        <button className={styles.cardToggle} onClick={() => onToggle(mode.id)}>
          <span className={styles.cardEmoji}>{mode.emoji}</span>
          <div className={styles.cardMeta}>
            <div className={styles.cardNameRow}>
              <span className={styles.cardName}>{mode.name}</span>
              {/* Sequência aleatória badge */}
              {inRandomMode && (
                <span
                  className={`${styles.seqBadge} ${wasStartedInSeq ? styles.seqBadgeDone : ""} ${isNextGuided ? styles.seqBadgeNext : ""}`}
                >
                  {wasStartedInSeq ? "✓" : isNextGuided ? `▶ #${index + 1}` : `#${index + 1}`}
                </span>
              )}
              {isActiveSession && (
                <span className={styles.cardActiveIndicator}>● Em sessão</span>
              )}
              {showSmartBadge && (
                <span className={styles.smartBadge} title={`Pontuação smart: ${smartScore}`}>
                  ✨ ideal agora
                </span>
              )}
              {mode.isCustom && <span className={styles.customBadge}>Personalizado</span>}
              {taskCount > 0 && (
                <span className={styles.statBadge}>✓ {taskCount}</span>
              )}
              {activationCount > 0 && (
                <span className={styles.statBadge} style={{ opacity: 0.75 }} title="Ativações">
                  ▶ {activationCount}
                </span>
              )}
              {comboCount > 0 && (
                <span
                  className={styles.statBadge}
                  style={{ background: "rgba(124,110,245,0.12)", color: "var(--accent)", border: "1px solid rgba(124,110,245,0.25)" }}
                  title={`${comboCount} sessão(ões) em combo`}
                >
                  🔀 {comboCount}
                </span>
              )}
              {taskCount === 0 && activationCount === 0 && sortBy === "smart" && (
                <span className={styles.neverUsedBadge} title="Você ainda não usou este modo">Nunca usado</span>
              )}
              {successRate && (
                <span
                  className={styles.statBadge}
                  style={{
                    background:
                      successRate.successRate >= 70
                        ? "rgba(78,204,163,0.15)"
                        : successRate.successRate >= 40
                        ? "rgba(124,110,245,0.12)"
                        : "rgba(224,82,82,0.12)",
                    color:
                      successRate.successRate >= 70
                        ? "var(--success)"
                        : successRate.successRate >= 40
                        ? "var(--accent)"
                        : "#e05252",
                    border: "none",
                  }}
                  title={`${successRate.worked} de ${successRate.total} sessões funcionaram`}
                >
                  ✅ {successRate.worked}/{successRate.total}
                </span>
              )}
              {avgEfficiency != null && (
                <span
                  className={`${styles.effAvgBadge} ${
                    avgEfficiency >= 70 ? styles.effAvgHigh :
                    avgEfficiency >= 40 ? styles.effAvgMid :
                    styles.effAvgLow
                  }`}
                  title={`Eficiência média histórica: ${avgEfficiency}%`}
                >
                  ⚡ {avgEfficiency}% avg
                </span>
              )}
            </div>
            <div className={styles.cardTaglineRow}>
              <span className={styles.cardTagline}>{mode.tagline}</span>
              {usedToday && <span className={styles.usedTodayBadge}>usado hoje</span>}
            </div>
            {bestHour && (
              <span className={styles.hourRecommendation} title="Baseado no seu histórico de uso">
                💡 Melhor na {bestHour.block.emoji} {bestHour.block.label} — {bestHour.successRate}% de sucesso
              </span>
            )}
            {!open && mode.prerequisite && (
              <span className={styles.cardPrereqHint} title="Pré-requisito">
                ✅ {mode.prerequisite}
              </span>
            )}
            {mode.context && mode.context.length > 0 && (
              <div className={styles.contextTags}>
                {mode.context.map((tag) => (
                  <span
                    key={tag}
                    className={tag.startsWith("⚠️") ? styles.contextTagWarning : styles.contextTag}
                  >
                    {tag}
                  </span>
                ))}
              </div>
            )}
          </div>
          <span className={`${styles.chevron} ${open ? styles.chevronOpen : ""}`}>›</span>
        </button>

        <div className={styles.cardActions}>
          <button
            className={styles.favBtn}
            onClick={(e: React.MouseEvent) => { e.stopPropagation(); onFavorite(mode.id); }}
            title={isFavorite ? "Remover dos favoritos" : "Adicionar aos favoritos"}
          >
            {isFavorite ? "⭐" : "☆"}
          </button>
          {isActiveSession ? (
            <button
              className={styles.viewSessionBtn}
              onClick={() => sessionRef.current?.scrollIntoView({ behavior: "smooth", block: "start" })}
              title="Ir para a sessão ativa"
            >
              ● Ver sessão ↑
            </button>
          ) : (
            <>
              <button
                className={`${styles.comboBtn} ${isComboSelected ? styles.comboBtnActive : ""}`}
                onClick={() => onCombo(mode.id)}
                title={isComboSelected ? "Remover do combo" : "Adicionar ao combo"}
              >
                {isComboSelected ? "✓" : "+"}
              </button>
              <button
                className={`${styles.startBtn} ${flashingCard === mode.id ? styles.startBtnFlash : ""}`}
                onClick={handleStartClick}
                title={`Iniciar ${mode.name}`}
              >
                ▶ Iniciar
              </button>
            </>
          )}
          {mode.isCustom && (
            <button
              className={styles.deleteBtn}
              onClick={() => onDelete(mode.id)}
              title="Excluir modo"
            >
              ×
            </button>
          )}
          {mode.id.startsWith("splite_") && (
            <button
              className={styles.deleteBtn}
              onClick={() => onUnpin(mode.preset?.activity as string)}
              title="Remover atividade"
            >
              ×
            </button>
          )}
        </div>
      </div>

      {open && (
        <div className={styles.cardBody}>
          {taskCount > 0 && (
            <div className={styles.statRow}>
              <span className={styles.statIcon}>🎯</span>
              <span className={styles.statText}>
                {taskCount} tarefa{taskCount !== 1 ? "s" : ""} concluída{taskCount !== 1 ? "s" : ""} neste modo
              </span>
            </div>
          )}

          {/* ── Seus dados ── */}
          {activationCount > 0 && (() => {
            const sr       = getModeSuccessRate(mode.id);
            const byMode   = getFocusedMinutesByMode(90);
            const modeData = byMode.find((m: { modeId: string }) => m.modeId === mode.id) as
              { totalFocusMin: number; sessions: number } | undefined;
            const avgFocus = modeData && modeData.sessions > 0
              ? Math.round(modeData.totalFocusMin / modeData.sessions)
              : null;

            const pills = [
              { label: `▶ ${activationCount} uso${activationCount !== 1 ? "s" : ""}` },
              sr && sr.total >= 3 ? { label: `📈 ${sr.successRate}% de sucesso` } : null,
              avgFocus !== null && avgFocus > 0 ? { label: `⏱ ~${avgFocus}min foco/sessão` } : null,
            ].filter(Boolean) as { label: string }[];

            return (
              <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 2 }}>
                {pills.map((p) => (
                  <span
                    key={p.label}
                    style={{
                      display: "inline-flex",
                      alignItems: "center",
                      fontSize: 11,
                      fontWeight: 600,
                      color: "var(--text-muted)",
                      background: "var(--surface)",
                      border: "1px solid var(--border)",
                      borderRadius: 99,
                      padding: "2px 9px",
                    }}
                  >
                    {p.label}
                  </span>
                ))}
              </div>
            );
          })()}

          {/* ── Histórico de eficiência ── */}
          {(() => {
            const history = getModeEfficiencyHistory(mode.id, 10);
            if (history.length < 2) return null;

            // Tendência: média das últimas 3 vs primeiras 3
            const firstAvg = history.slice(0, 3).reduce((s, e) => s + e.efficiencyPct, 0) / Math.min(3, history.length);
            const lastAvg  = history.slice(-3).reduce((s, e) => s + e.efficiencyPct, 0) / Math.min(3, history.length);
            const delta = lastAvg - firstAvg;
            const trend = delta > 10
              ? { label: "↗ melhorando", color: "#4caf82" }
              : delta < -10
              ? { label: "↘ caindo",     color: "#e05c5c" }
              : { label: "→ estável",    color: "var(--text-muted)" };

            const W = 220, H = 56;
            const barW = Math.floor((W - (history.length - 1) * 3) / history.length);

            return (
              <div className={styles.effHistoryBlock}>
                <div className={styles.effHistoryHeader}>
                  <span className={styles.effHistoryTitle}>📈 Últimas {history.length} sessões</span>
                  <span className={styles.effHistoryTrend} style={{ color: trend.color }}>{trend.label}</span>
                </div>
                <svg width={W} height={H} viewBox={`0 0 ${W} ${H}`} className={styles.effHistorySvg}>
                  {/* linha de referência 70% */}
                  <line
                    x1={0} y1={H - H * 0.7} x2={W} y2={H - H * 0.7}
                    stroke="rgba(76,175,130,0.25)" strokeWidth={1} strokeDasharray="3 3"
                  />
                  {history.map((s, i) => {
                    const barH = Math.max(3, Math.round((s.efficiencyPct / 100) * H));
                    const x = i * (barW + 3);
                    const fill = s.efficiencyPct >= 70 ? "#4caf82" : s.efficiencyPct >= 40 ? "#f5c542" : "#e05c5c";
                    return (
                      <rect key={s.id} x={x} y={H - barH} width={barW} height={barH} rx={2} fill={fill} fillOpacity={0.85}>
                        <title>{s.date} — {s.efficiencyPct}% eficiência ({s.focusedMinutes}min focado)</title>
                      </rect>
                    );
                  })}
                </svg>
                <div className={styles.effHistoryAxis}>
                  <span>{history[0].date.slice(5)}</span>
                  <span>{history[history.length - 1].date.slice(5)}</span>
                </div>
              </div>
            );
          })()}

          {/* ── Últimas sessões ── */}
          {(() => {
            const sessions = getUsageLogs()
              .filter((s) => s.modeId === mode.id)
              .sort((a, b) => b.date.localeCompare(a.date))
              .slice(0, 5);

            if (!sessions.length) return null;

            return (
              <div style={{ marginBottom: 10 }}>
                <span style={{ fontSize: 11, fontWeight: 600, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.05em" }}>
                  Últimas sessões
                </span>
                <div style={{ display: "flex", flexDirection: "column", gap: 4, marginTop: 6 }}>
                  {sessions.map((s) => (
                    <div
                      key={s.id}
                      style={{
                        display: "flex",
                        flexDirection: "column",
                        gap: 3,
                        fontSize: 12,
                        color: "var(--text-muted)",
                        background: "var(--surface)",
                        border: "1px solid var(--border)",
                        borderRadius: 8,
                        padding: "5px 10px",
                      }}
                    >
                      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                        <span style={{ color: s.worked ? "var(--success)" : "var(--danger)", fontSize: 14, flexShrink: 0 }}>
                          {s.worked ? "✅" : "❌"}
                        </span>
                        <span style={{ flexShrink: 0, minWidth: 72 }}>{s.date}</span>
                        {s.focusedMinutes > 0 && (
                          <span style={{ flexShrink: 0 }}>⏱ {s.focusedMinutes}min</span>
                        )}
                        {s.efficiencyPct != null && (
                          <span style={{ flexShrink: 0 }}>⚡ {s.efficiencyPct}%</span>
                        )}
                        {s.feeling && s.feeling.length > 0 && (
                          <span style={{ marginLeft: "auto", flexShrink: 0 }}>{s.feeling.join(" ")}</span>
                        )}
                      </div>
                      {(s as { intention?: string }).intention && (
                        <div style={{ fontSize: 11, fontStyle: "italic", color: "var(--text-muted)", paddingLeft: 22, opacity: 0.8 }}>
                          🎯 {(s as { intention?: string }).intention}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            );
          })()}

          {/* ── Comparativo com outro modo ── */}
          {(() => {
            const comp = getModeEfficiencyComparison(mode.id);
            if (!comp || Math.abs(comp.delta) < 5) return null;
            const compareMode = (MODES as ModeConfig[]).find((m) => m.id === comp.compareModeId);
            if (!compareMode) return null;
            const label = `${compareMode.emoji} ${compareMode.name}`;
            const contextSuffix = comp.context === "shared_blocks" ? " nos mesmos horários" : "";
            const isBetter = comp.delta > 0;
            return (
              <div className={styles.compBlock}>
                <span className={styles.compIcon}>{isBetter ? "⚡" : "💡"}</span>
                <span className={styles.compText}>
                  {isBetter ? (
                    <>Você é <strong>{comp.delta}%</strong> mais eficiente aqui do que em{" "}
                    <span className={styles.compMode}>{label}</span>{contextSuffix}</>
                  ) : (
                    <>Você é <strong>{Math.abs(comp.delta)}%</strong> mais eficiente em{" "}
                    <span className={styles.compMode}>{label}</span>{contextSuffix}</>
                  )}
                </span>
              </div>
            );
          })()}

          {/* ── Anotações pessoais ── */}
          {(() => {
            const notes = getModeNotes(mode.id, 3);
            if (!notes.length) return null;
            return (
              <div className={styles.modeNotesBlock}>
                <div className={styles.modeNotesTitle}>📝 Anotações anteriores</div>
                {notes.map((n, i) => (
                  <div key={i} className={styles.modeNoteItem}>
                    <span className={styles.modeNoteDate}>{n.date.slice(5)}</span>
                    <span className={styles.modeNoteText}>{n.note}</span>
                  </div>
                ))}
              </div>
            );
          })()}

          <div className={styles.infoGrid}>
            <div className={styles.infoItem}>
              <span className={styles.infoLabel}>✅ Pré-requisito</span>
              <p className={styles.infoText}>{mode.prerequisite}</p>
            </div>
            <div className={styles.infoItem}>
              <span className={styles.infoLabel}>🧠 Por que funciona</span>
              <p className={styles.infoText}>{mode.whyItWorks}</p>
            </div>
            <div className={styles.infoItem}>
              <span className={styles.infoLabel}>🕐 Quando usar</span>
              <p className={styles.infoText}>{mode.whenToUse}</p>
            </div>
          </div>

          <div className={styles.section}>
            <span className={styles.sectionLabel}>Como funciona</span>
            <ol className={styles.stepList}>
              {mode.steps?.map((step, i) => (
                <li key={i} className={styles.stepItem}>
                  <span className={styles.stepNum} style={{ background: mode.color }}>{i + 1}</span>
                  <span>{step}</span>
                </li>
              ))}
            </ol>
          </div>

          {mode.classes && (
            <div className={styles.section}>
              <span className={styles.sectionLabel}>Classes disponíveis</span>
              <div className={styles.classesList}>
                {mode.classes.map((cls) => (
                  <div
                    key={cls.name}
                    className={styles.classItem}
                    style={{ "--cls-color": cls.color } as React.CSSProperties}
                  >
                    <span className={styles.classEmoji}>{cls.emoji}</span>
                    <div>
                      <span className={styles.className}>{cls.name}</span>
                      <span className={styles.classDesc}>{cls.desc}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {mode.tips && (
            <div className={styles.tip}>
              <span className={styles.tipIcon}>💡</span>
              <span>{mode.tips}</span>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// Custom comparison: re-render only when props that affect output actually change.
// Callbacks are excluded from comparison — they must be stable via useCallback.
function areEqual(prev: ModeCardProps, next: ModeCardProps): boolean {
  return (
    prev.mode === next.mode &&
    prev.index === next.index &&
    prev.open === next.open &&
    prev.compactView === next.compactView &&
    prev.isActiveSession === next.isActiveSession &&
    prev.sortBy === next.sortBy &&
    prev.inRandomMode === next.inRandomMode &&
    prev.wasStartedInSeq === next.wasStartedInSeq &&
    prev.isNextGuided === next.isNextGuided &&
    prev.taskCount === next.taskCount &&
    prev.activationCount === next.activationCount &&
    prev.usedToday === next.usedToday &&
    prev.smartScore === next.smartScore &&
    prev.isComboSelected === next.isComboSelected &&
    prev.comboCount === next.comboCount &&
    prev.avgEfficiency === next.avgEfficiency &&
    prev.isFavorite === next.isFavorite &&
    prev.flashingCard === next.flashingCard &&
    prev.sessionRef === next.sessionRef
    // Callbacks intentionally omitted — parent must use useCallback
  );
}

export default memo(ModeCard, areEqual);
