import { useState, useMemo, useEffect } from "react";
import {
  BarChart, Bar, LineChart, Line, ReferenceLine,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend,
} from "recharts";
import { getHistory, getStreak } from "../../lib/dailyFocusHistory";
import { usageStats, loadRemoteModeLog } from "../../lib/modeLog";
import { getCheckinLog, getSessionFeedback } from "../../lib/checkinLog";
import { getAllWithStatus } from "../../lib/dailyFocusAchievements";
import { getUsageLogs, getFeelingStats, getTemporalTrend, getCorrelationByEstado, getFocusedMinutesByDay, getTotalFocusedMinutes, getFocusedMinutesByMode, getBestDayOfWeek, getWeeklyFocusComparison, loadRemoteUsageLogs, getSessionEfficiencyList, getTwoHourBlockEfficiency, getAvgEfficiencyByMode, getWeeklyEfficiencyTrend, getDailyEfficiencyMap, getEfficiencyByDayOfWeek } from "../../lib/sessionUsageLog";
import { getMoodModeStats } from "../../lib/moodModeCorrelation";
import { getDistractionInsights } from "../../lib/distractionInsights";
import WeeklyReview from "../WeeklyReview";
import { tasksApi } from "../../api/tasks";
import { routinesApi } from "../../api/routines";
import { storageGet, storageSet } from "../../lib/storage";
import { MODES } from "../../data/modes";
import { ESTADOS_DEFAULT } from "../daily-focus/stateToMode";
import styles from "./Dashboard.module.css";
import EmptyState from "../shared/EmptyState";
import { parsePtBR, ptBRtoISO, todayISO, daysAgoISO, formatISOShort } from "../../lib/dateUtils";

// ── helpers ──────────────────────────────────────────────────────────────────
const toIso           = ptBRtoISO;
const localIsoDate    = todayISO;
const daysAgoIso      = daysAgoISO;
const formatIsoToPtBR = formatISOShort;

const PERIOD_OPTS: { label: string; days: number }[] = [
  { label: "7d", days: 7 },
  { label: "30d", days: 30 },
  { label: "90d", days: 90 },
  { label: "Tudo", days: 9999 },
];

const TOOLTIP_STYLE: React.CSSProperties = {
  backgroundColor: "#1a1a22",
  border: "1px solid #2e2e3e",
  borderRadius: 8,
  color: "#e8e8f0",
  fontSize: 12,
};

// ── Fix #4: Exportar dados ────────────────────────────────────────────────────
function handleExport(): void {
  const history = getHistory();
  const checkinLog = getCheckinLog();
  const feedback = getSessionFeedback();
  const data = {
    exportedAt: new Date().toISOString(),
    sessions: history,
    checkinLog,
    feedback,
  };
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `taskflow-dados-${localIsoDate()}.json`;
  a.click();
  URL.revokeObjectURL(url);
}

// ── subcomponents ─────────────────────────────────────────────────────────────

function formatMinutes(total: number): string {
  if (total < 60) return `${total}min`;
  const h = Math.floor(total / 60);
  const m = total % 60;
  return m > 0 ? `${h}h ${m}min` : `${h}h`;
}

interface HistoryEntry {
  date: string;
  level: number;
  tasks: string[];
  timings?: { used: number }[];
  completedAt?: string;
  rushMode?: boolean;
  estadoId?: string;
}

interface HeroStatsProps {
  history: HistoryEntry[];
  streak: number;
}

function HeroStats({ history, streak }: HeroStatsProps): JSX.Element {
  const totalSessions = history.length;
  const totalTasks = history.reduce((s, e) => s + e.tasks.length, 0);
  const maxLevel = history.length ? Math.max(...history.map((e) => e.level)) : 0;
  const weeklyFocus = getTotalFocusedMinutes(7);

  const recordDay = useMemo(() => {
    const all = getFocusedMinutesByDay(365);
    const best = all.reduce(
      (top: { focusedMinutes: number; label: string } | null, d: { focusedMinutes: number; label: string }) =>
        d.focusedMinutes > (top?.focusedMinutes || 0) ? d : top,
      null
    );
    return best && best.focusedMinutes > 0 ? best : null;
  }, []);

  const weeklyBreakdown = useMemo(() => {
    const byMode = getFocusedMinutesByMode(7).filter((m: { totalFocusMin: number }) => m.totalFocusMin > 0);
    if (!byMode.length) return null;
    return byMode.map((m: { modeId: string; totalFocusMin: number }) => {
      const mode = MODES.find((x) => x.id === m.modeId);
      return `${mode?.emoji || "•"} ${mode?.name || m.modeId}: ${formatMinutes(m.totalFocusMin)}`;
    }).join("\n");
  }, []);

  return (
    <div className={styles.section}>
      <div className={styles.sectionHeader}>
        <div className={styles.sectionTitle}>Visão geral</div>
        <button className={styles.exportBtn} onClick={handleExport} title="Exportar todos os dados como JSON">
          ⬇ exportar
        </button>
      </div>
      <div className={styles.heroGrid}>
        <div className={styles.statCard}>
          <div className={`${styles.statValue} ${styles.statAccent}`}>{streak}</div>
          <div className={styles.statLabel}>🔥 Streak</div>
        </div>
        <div className={styles.statCard}>
          <div className={styles.statValue}>{totalSessions}</div>
          <div className={styles.statLabel}>Sessões</div>
        </div>
        <div className={styles.statCard}>
          <div className={`${styles.statValue} ${styles.statSuccess}`}>{totalTasks}</div>
          <div className={styles.statLabel}>Tarefas</div>
        </div>
        <div className={styles.statCard}>
          <div className={`${styles.statValue} ${styles.statWarning}`}>{maxLevel}</div>
          <div className={styles.statLabel}>👑 Nível máx</div>
        </div>
        <div className={styles.statCard} title={weeklyBreakdown || undefined}>
          <div className={`${styles.statValue} ${styles.statAccent}`}>{weeklyFocus > 0 ? formatMinutes(weeklyFocus) : "—"}</div>
          <div className={styles.statLabel}>⏱️ Foco esta semana</div>
        </div>
        {recordDay && (
          <div className={styles.statCard} title={`Melhor dia: ${recordDay.label}`}>
            <div className={`${styles.statValue} ${styles.statSuccess}`}>{formatMinutes(recordDay.focusedMinutes)}</div>
            <div className={styles.statLabel}>🏆 Recorde do dia</div>
          </div>
        )}
      </div>
    </div>
  );
}

// Fix #1: tooltip com data legível
function HeatmapTooltip({ iso, count }: { iso: string; count: number }): string {
  return `${formatIsoToPtBR(iso)}: ${count} sessão${count !== 1 ? "ões" : ""}`;
}

interface ActivityHeatmapProps {
  history: HistoryEntry[];
  days: number;
}

function ActivityHeatmap({ history, days }: ActivityHeatmapProps): JSX.Element {
  const cells = useMemo(() => {
    const map: Record<string, number> = {};
    history.forEach((e) => {
      const iso = toIso(e.date);
      map[iso] = (map[iso] || 0) + 1;
    });

    const result: { iso: string; count: number; level: number }[] = [];
    const n = Math.min(days, 90);
    for (let i = n - 1; i >= 0; i--) {
      const iso = daysAgoIso(i);
      const count = map[iso] || 0;
      const level = count === 0 ? 0 : count === 1 ? 1 : count === 2 ? 2 : count <= 3 ? 3 : 4;
      result.push({ iso, count, level });
    }
    return result;
  }, [history, days]);

  return (
    <div className={styles.section}>
      <div className={styles.sectionTitle}>Atividade ({Math.min(days, 90)} dias)</div>
      <div className={styles.heatmapGrid}>
        {cells.map((c) => (
          <div
            key={c.iso}
            className={styles.heatmapCell}
            data-level={c.level}
            title={HeatmapTooltip(c)}
          />
        ))}
      </div>
      <div className={styles.heatmapLegend}>
        <span>Menos</span>
        <div className={styles.heatmapLegendCells}>
          {[0, 1, 2, 3, 4].map((l) => (
            <div key={l} className={styles.heatmapCell} data-level={l} />
          ))}
        </div>
        <span>Mais</span>
      </div>
    </div>
  );
}

function EfficiencyYearHeatmap({ remoteLoaded }: { remoteLoaded: boolean }): JSX.Element | null {
  const { cells, hasData } = useMemo(() => {
    const effMap = getDailyEfficiencyMap(365);
    if (!Object.keys(effMap).length) return { cells: [], hasData: false };

    const pad = (d: Date) =>
      [d.getFullYear(), String(d.getMonth() + 1).padStart(2, "0"), String(d.getDate()).padStart(2, "0")].join("-");
    const dayOfWeekMon = (d: Date) => (d.getDay() + 6) % 7; // Mon=0, Sun=6

    const oldest = new Date();
    oldest.setDate(oldest.getDate() - 364);
    const padCount = dayOfWeekMon(oldest);

    const pads = Array.from({ length: padCount }, (_, i) => ({
      iso: `pad-${i}`,
      eff: null as number | null,
      isPad: true as const,
    }));
    const real: { iso: string; eff: number | null; isPad: false }[] = [];
    for (let i = 364; i >= 0; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      const iso = pad(d);
      real.push({ iso, eff: effMap[iso] ?? null, isPad: false });
    }
    return { cells: [...pads, ...real], hasData: true };
  }, [remoteLoaded]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!hasData) return null;

  return (
    <div className={styles.section}>
      <div className={styles.sectionTitle}>🗓️ Eficiência anual (365 dias)</div>
      <div className={styles.effYearGrid}>
        {cells.map((c) => {
          if (c.isPad)
            return <div key={c.iso} className={styles.effYearCell} style={{ opacity: 0 }} />;
          if (c.eff === null)
            return <div key={c.iso} className={styles.effYearCell} title={c.iso} />;
          const alpha = Math.max(0, Math.min(1, (c.eff - 20) / 80));
          const bg = `rgba(76,175,130,${(0.15 + alpha * 0.85).toFixed(2)})`;
          return (
            <div
              key={c.iso}
              className={styles.effYearCell}
              style={{ background: bg }}
              title={`${c.iso} — ${c.eff}% eficiência`}
            />
          );
        })}
      </div>
      <div className={styles.effYearLegend}>
        <span>Menos eficiente</span>
        <div className={styles.effYearGradientBar} />
        <span>Mais eficiente</span>
      </div>
    </div>
  );
}

function DayOfWeekEfficiencyPanel({ remoteLoaded }: { remoteLoaded: boolean }): JSX.Element | null {
  const data = useMemo(() => getEfficiencyByDayOfWeek(), [remoteLoaded]); // eslint-disable-line react-hooks/exhaustive-deps

  const withData = data.filter((d) => d.sessions > 0);
  if (withData.length < 2) return null;

  const maxEff = Math.max(...withData.map((d) => d.avgEff), 1);
  const best   = withData.reduce((a, b) => (b.avgEff > a.avgEff ? b : a));
  const worst  = withData.reduce((a, b) => (b.avgEff < a.avgEff ? b : a));
  const delta  = best.avgEff - worst.avgEff;

  return (
    <div className={styles.section}>
      <div className={styles.sectionTitle}>📅 Eficiência por dia da semana</div>

      {delta >= 5 && (
        <div style={{
          fontSize: 12,
          color: "var(--text-muted)",
          background: "var(--surface-2)",
          border: "1px solid var(--border)",
          borderRadius: "var(--radius-sm)",
          padding: "8px 12px",
          marginBottom: 14,
          lineHeight: 1.5,
        }}>
          Suas <strong style={{ color: "var(--text)" }}>{best.dayLabel}s</strong> são{" "}
          <strong style={{ color: "#4caf82" }}>{delta}%</strong> mais eficientes que suas{" "}
          <strong style={{ color: "var(--text)" }}>{worst.dayLabel}s</strong>.
        </div>
      )}

      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        {data.map((d) => {
          const barPct  = maxEff > 0 ? (d.avgEff / maxEff) * 100 : 0;
          const color   = d.avgEff >= 70 ? "#4caf82" : d.avgEff >= 40 ? "var(--accent)" : "#e05252";
          const isBest  = d.sessions > 0 && d.avgEff === best.avgEff;
          const isWorst = d.sessions > 0 && d.avgEff === worst.avgEff && delta >= 5;
          return (
            <div key={d.day} style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <span style={{
                fontSize: 12,
                color: "var(--text)",
                width: 30,
                flexShrink: 0,
                fontWeight: isBest || isWorst ? 700 : 400,
              }}>
                {d.dayLabel}
              </span>
              <div style={{ flex: 1, background: "var(--surface-2)", borderRadius: 4, height: 8, overflow: "hidden" }}>
                {d.sessions > 0 && (
                  <div style={{ height: "100%", width: `${barPct}%`, background: color, borderRadius: 4, transition: "width 0.4s" }} />
                )}
              </div>
              <span style={{ fontSize: 11, color: "var(--text-muted)", width: 68, textAlign: "right", flexShrink: 0 }}>
                {d.sessions > 0 ? `${d.avgEff}% · ${d.sessions}x` : "sem dados"}
              </span>
              {isBest  && <span style={{ fontSize: 10, color: "#4caf82", width: 10 }}>★</span>}
              {isWorst && <span style={{ fontSize: 10, color: "#e05252", width: 10 }}>▼</span>}
              {!isBest && !isWorst && <span style={{ width: 10 }} />}
            </div>
          );
        })}
      </div>
    </div>
  );
}

interface SessionsBarChartProps {
  history: HistoryEntry[];
  days: number;
}

function SessionsBarChart({ history, days }: SessionsBarChartProps): JSX.Element {
  const data = useMemo(() => {
    const map: Record<string, number> = {};
    history.forEach((e) => {
      const iso = toIso(e.date);
      map[iso] = (map[iso] || 0) + 1;
    });

    const result: { label: string; sessões: number }[] = [];
    const n = Math.min(days, 30);
    for (let i = n - 1; i >= 0; i--) {
      const iso = daysAgoIso(i);
      const d = new Date(iso + "T00:00:00");
      const label = d.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" });
      result.push({ label, sessões: map[iso] || 0 });
    }
    return result;
  }, [history, days]);

  if (!history.length) return <div className={styles.empty}>Sem dados ainda.</div>;

  return (
    <div className={styles.section}>
      <div className={styles.sectionTitle}>Sessões por dia</div>
      <div className={styles.chartWrap}>
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data} barSize={8}>
            <CartesianGrid strokeDasharray="3 3" stroke="#2e2e3e" />
            <XAxis
              dataKey="label"
              tick={{ fill: "#7a7a9a", fontSize: 10 }}
              tickLine={false}
              interval={Math.floor(data.length / 6)}
            />
            <YAxis tick={{ fill: "#7a7a9a", fontSize: 10 }} tickLine={false} allowDecimals={false} />
            <Tooltip contentStyle={TOOLTIP_STYLE} />
            <Bar dataKey="sessões" fill="#7c6ef5" radius={[4, 4, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}

interface FocusedMinutesChartProps {
  days: number;
  remoteLoaded: boolean;
}

function FocusedMinutesChart({ days, remoteLoaded }: FocusedMinutesChartProps): JSX.Element {
  const [localDays, setLocalDays] = useState<number>(14);
  const periodOptions: { label: string; days: number }[] = [
    { label: "7d",  days: 7  },
    { label: "14d", days: 14 },
    { label: "30d", days: 30 },
  ];
  const effectiveDays = days >= 9999 ? localDays : Math.min(days, 30);

  const dailyGoalMin = useMemo(() => {
    const goalHours = storageGet("taskflow.focusBudgetHours", 0);
    return goalHours > 0 ? Math.round((goalHours * 60) / 7) : null;
  }, []);

  const rawData = useMemo(() => getFocusedMinutesByDay(effectiveDays), [effectiveDays, remoteLoaded]); // eslint-disable-line react-hooks/exhaustive-deps

  const data = useMemo(() => rawData.map((d: { focusedMinutes: number; idleMinutes: number; label: string }, i: number) => {
    const window = rawData.slice(Math.max(0, i - 2), i + 1);
    const avg = Math.round(window.reduce((s: number, x: { focusedMinutes: number }) => s + x.focusedMinutes, 0) / window.length);
    return { ...d, média3d: avg };
  }), [rawData]);

  const hasData = data.some((d: { focusedMinutes: number; idleMinutes: number }) => d.focusedMinutes > 0 || d.idleMinutes > 0);

  const CustomTooltip = ({ active, payload, label }: { active?: boolean; payload?: any[]; label?: string }): JSX.Element | null => {
    if (!active || !payload || !payload.length) return null;
    const focused = payload.find((p) => p.dataKey === "focusedMinutes")?.value || 0;
    const idle    = payload.find((p) => p.dataKey === "idleMinutes")?.value    || 0;
    const avg     = payload.find((p) => p.dataKey === "média3d")?.value;
    return (
      <div style={TOOLTIP_STYLE}>
        <div style={{ marginBottom: 4, fontWeight: 600 }}>{label}</div>
        {focused > 0 && <div style={{ color: "#4ade80" }}>✅ Foco: {formatMinutes(focused)}</div>}
        {idle > 0    && <div style={{ color: "#f87171" }}>💤 Idle: {formatMinutes(idle)}</div>}
        {avg != null && <div style={{ color: "#a78bfa", marginTop: 2 }}>〰 Média 3d: {formatMinutes(avg)}</div>}
        {focused === 0 && idle === 0 && <div style={{ color: "#7a7a9a" }}>Sem registro</div>}
      </div>
    );
  };

  return (
    <div className={styles.section}>
      <div className={styles.sectionHeader}>
        <div className={styles.sectionTitle}>⏱️ Minutos focados por dia</div>
        {days >= 9999 && (
          <div className={styles.viewToggle}>
            {periodOptions.map((opt) => (
              <button
                key={opt.label}
                className={`${styles.viewBtn} ${localDays === opt.days ? styles.viewBtnActive : ""}`}
                onClick={() => setLocalDays(opt.days)}
              >
                {opt.label}
              </button>
            ))}
          </div>
        )}
      </div>
      {!hasData ? (
        <div className={styles.empty}>
          Ainda sem registros de tempo focado. Ao finalizar uma sessão de modo, preencha o campo de minutos para aparecer aqui.
        </div>
      ) : (
        <div className={styles.chartWrap}>
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={data} barSize={8}>
              <CartesianGrid strokeDasharray="3 3" stroke="#2e2e3e" />
              <XAxis
                dataKey="label"
                tick={{ fill: "#7a7a9a", fontSize: 10 }}
                tickLine={false}
                interval={Math.floor(data.length / 6)}
              />
              <YAxis
                tick={{ fill: "#7a7a9a", fontSize: 10 }}
                tickLine={false}
                tickFormatter={(v: number) => `${v}min`}
                allowDecimals={false}
              />
              <Tooltip content={<CustomTooltip />} />
              <Legend
                wrapperStyle={{ fontSize: 11, color: "#7a7a9a" }}
                formatter={(value: string) => ({ focusedMinutes: "🟢 Foco", idleMinutes: "🔴 Idle", média3d: "〰 Média 3d" }[value] || value)}
              />
              {dailyGoalMin && (
                <ReferenceLine y={dailyGoalMin} stroke="#7c6ef5" strokeDasharray="4 4" label={{ value: `meta ${dailyGoalMin}min`, position: "right", fill: "#7c6ef5", fontSize: 10 }} />
              )}
              <Bar dataKey="focusedMinutes" name="focusedMinutes" stackId="a" fill="#4ade80" radius={[0, 0, 0, 0]} />
              <Bar dataKey="idleMinutes"    name="idleMinutes"    stackId="a" fill="#f87171" radius={[4, 4, 0, 0]} />
              <Line type="monotone" dataKey="média3d" name="média3d" stroke="#a78bfa" strokeWidth={1.5} dot={false} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}
    </div>
  );
}

interface FocusedMinutesByModeChartProps {
  days: number;
  remoteLoaded: boolean;
}

function FocusedMinutesByModeChart({ days, remoteLoaded }: FocusedMinutesByModeChartProps): JSX.Element {
  const data = useMemo(() => {
    const effectiveDays = days >= 9999 ? 365 : days;
    return getFocusedMinutesByMode(effectiveDays).slice(0, 10).map((m: { modeId: string; totalFocusMin: number; totalIdleMin: number; sessions: number }) => {
      const mode = MODES.find((x) => x.id === m.modeId);
      return {
        name: `${mode?.emoji || ""} ${mode?.name || m.modeId}`,
        foco: m.totalFocusMin,
        idle: m.totalIdleMin,
        sessions: m.sessions,
      };
    });
  }, [days, remoteLoaded]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!data.length || !data.some((d: { foco: number }) => d.foco > 0)) {
    return (
      <div className={styles.section}>
        <div className={styles.sectionTitle}>📊 Foco total por modo</div>
        <div className={styles.empty}>Sem registros de tempo por modo ainda.</div>
      </div>
    );
  }

  const CustomTooltip = ({ active, payload, label }: { active?: boolean; payload?: any[]; label?: string }): JSX.Element | null => {
    if (!active || !payload?.length) return null;
    const foco = payload.find((p) => p.dataKey === "foco")?.value || 0;
    const idle = payload.find((p) => p.dataKey === "idle")?.value || 0;
    const sessions = payload[0]?.payload?.sessions || 0;
    const total = foco + idle;
    const pct = total > 0 ? Math.round((foco / total) * 100) : 0;
    return (
      <div style={TOOLTIP_STYLE}>
        <div style={{ fontWeight: 600, marginBottom: 4 }}>{label}</div>
        <div style={{ color: "#4ade80" }}>✅ Foco: {formatMinutes(foco)}</div>
        {idle > 0 && <div style={{ color: "#f87171" }}>💤 Idle: {formatMinutes(idle)}</div>}
        <div style={{ color: "#7a7a9a", marginTop: 2 }}>{sessions} sessão{sessions !== 1 ? "ões" : ""} · {pct}% aproveitamento</div>
      </div>
    );
  };

  const maxVal = useMemo(
    () => Math.max(...data.map((d: { foco: number; idle: number }) => d.foco + d.idle), 1),
    [data]
  );

  return (
    <div className={styles.section}>
      <div className={styles.sectionTitle}>📊 Foco total por modo</div>
      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        {data.map((d: { name: string; foco: number; idle: number; sessions: number }) => {
          const total = d.foco + d.idle;
          const focoPct = total > 0 ? (d.foco / maxVal) * 100 : 0;
          const idlePct = total > 0 ? (d.idle / maxVal) * 100 : 0;
          const aprovPct = total > 0 ? Math.round((d.foco / total) * 100) : 0;
          return (
            <div key={d.name}>
              <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12, marginBottom: 3 }}>
                <span style={{ color: "var(--text)" }}>{d.name}</span>
                <span style={{ color: "var(--text-muted)" }}>
                  {formatMinutes(d.foco)} foco · <span style={{ color: aprovPct >= 70 ? "var(--success)" : aprovPct >= 40 ? "var(--accent)" : "var(--danger)" }}>{aprovPct}% aproveit.</span>
                </span>
              </div>
              <div style={{ background: "var(--surface-2)", borderRadius: 4, height: 8, overflow: "hidden", display: "flex" }}>
                <div style={{ width: `${focoPct}%`, background: "#4ade80", borderRadius: "4px 0 0 4px", transition: "width 0.4s" }} />
                <div style={{ width: `${idlePct}%`, background: "#f87171", transition: "width 0.4s" }} />
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// Fix #2: linha fantasma do período anterior
interface LevelLineChartProps {
  history: HistoryEntry[];
  days: number;
  allHistory: HistoryEntry[];
}

function LevelLineChart({ history, days, allHistory }: LevelLineChartProps): JSX.Element | null {
  const { current, previous, avgCurrent, avgPrevious } = useMemo(() => {
    const cutoff = daysAgoIso(days);
    const prevCutoff = daysAgoIso(days * 2);

    const current = [...allHistory]
      .filter((e) => toIso(e.date) >= cutoff)
      .reverse()
      .map((e, i) => ({ idx: i + 1, nível: e.level, data: e.date }));

    const previous = [...allHistory]
      .filter((e) => {
        const iso = toIso(e.date);
        return iso >= prevCutoff && iso < cutoff;
      })
      .reverse()
      .map((e, i) => ({ idx: i + 1, anterior: e.level }));

    const avg = (arr: HistoryEntry[]): number | null => arr.length ? Math.round(arr.reduce((s, e) => s + e.level, 0) / arr.length * 10) / 10 : null;
    const currentFiltered = allHistory.filter((e) => toIso(e.date) >= cutoff);
    const prevFiltered = allHistory.filter((e) => { const iso = toIso(e.date); return iso >= prevCutoff && iso < cutoff; });

    return {
      current,
      previous,
      avgCurrent: avg(currentFiltered),
      avgPrevious: avg(prevFiltered),
    };
  }, [history, days, allHistory]);

  if (current.length < 2) return null;

  const maxLen = Math.max(current.length, previous.length);
  const merged = Array.from({ length: maxLen }, (_, i) => ({
    idx: i + 1,
    ...(current[i] || {}),
    ...(previous[i] || {}),
  }));

  const delta = avgCurrent !== null && avgPrevious !== null
    ? Math.round((avgCurrent - avgPrevious) * 10) / 10
    : null;

  return (
    <div className={styles.section}>
      <div className={styles.sectionHeader}>
        <div className={styles.sectionTitle}>Evolução de nível</div>
        {delta !== null && (
          <div className={delta >= 0 ? styles.deltaPositive : styles.deltaNegative}>
            {delta >= 0 ? "▲" : "▼"} {Math.abs(delta)} vs período anterior
          </div>
        )}
      </div>
      <div className={styles.chartWrap}>
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={merged}>
            <CartesianGrid strokeDasharray="3 3" stroke="#2e2e3e" />
            <XAxis dataKey="idx" tick={{ fill: "#7a7a9a", fontSize: 10 }} tickLine={false} />
            <YAxis tick={{ fill: "#7a7a9a", fontSize: 10 }} tickLine={false} allowDecimals={false} domain={[1, "dataMax"]} />
            <Tooltip contentStyle={TOOLTIP_STYLE} labelFormatter={(v: number) => `Sessão ${v}`} />
            <Legend wrapperStyle={{ fontSize: 11, color: "#7a7a9a" }} />
            <Line type="monotone" dataKey="nível" stroke="#7c6ef5" strokeWidth={2} dot={false} name="Período atual" />
            <Line type="monotone" dataKey="anterior" stroke="#7a7a9a" strokeWidth={1.5} strokeDasharray="4 4" dot={false} name="Período anterior" />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}

// Fix #3: modo mais eficaz (cruzar feedback com uso)
interface TopModesProps {
  days: number;
  remoteLoaded: boolean;
}

function TopModes({ days, remoteLoaded }: TopModesProps): JSX.Element {
  const [view, setView] = useState<"usado" | "eficaz">("usado");

  const { byUsage, byEfficacy } = useMemo(() => {
    const cutoff = daysAgoIso(days === 9999 ? 365 : days);
    const stats = usageStats(days === 9999 ? 365 : days);

    const feedback = getSessionFeedback().filter((e: { date: string }) => e.date >= cutoff);
    const pos: Record<string, number> = {};
    const total: Record<string, number> = {};
    for (const f of feedback) {
      if (!f.modeId) continue;
      total[f.modeId] = (total[f.modeId] || 0) + 1;
      if (f.rating === 1) pos[f.modeId] = (pos[f.modeId] || 0) + 1;
    }

    const byEfficacy = Object.entries(total)
      .filter(([, t]) => t >= 2)
      .map(([modeId, t]) => ({
        modeId,
        count: Math.round(((pos[modeId] || 0) / t) * 100),
        total: t,
      }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 8);

    return { byUsage: stats.slice(0, 8), byEfficacy };
  }, [days, remoteLoaded]); // eslint-disable-line react-hooks/exhaustive-deps

  const activeList = view === "usado" ? byUsage : byEfficacy;
  const max = view === "usado"
    ? (byUsage[0]?.count || 1)
    : 100;

  const isEmpty = activeList.length === 0;

  return (
    <div className={styles.section}>
      <div className={styles.sectionHeader}>
        <div className={styles.sectionTitle}>Modos</div>
        <div className={styles.viewToggle}>
          <button className={`${styles.viewBtn} ${view === "usado" ? styles.viewBtnActive : ""}`} onClick={() => setView("usado")}>Mais usados</button>
          <button className={`${styles.viewBtn} ${view === "eficaz" ? styles.viewBtnActive : ""}`} onClick={() => setView("eficaz")}>Mais eficazes</button>
        </div>
      </div>
      {isEmpty ? (
        <div className={styles.empty}>
          {view === "eficaz" ? "Dê feedbacks (👍/👎) ao final das sessões para ver aqui." : "Nenhum modo usado ainda."}
        </div>
      ) : (
        activeList.map(({ modeId, count }: { modeId: string; count: number }) => {
          const mode = MODES.find((m) => m.id === modeId);
          const label = mode ? `${mode.emoji} ${mode.name}` : modeId;
          const pct = Math.round((count / max) * 100);
          return (
            <div key={modeId} className={styles.modeBar}>
              <div className={styles.modeBarLabel} title={label}>{label}</div>
              <div className={styles.modeBarTrack}>
                <div className={styles.modeBarFill} style={{ width: `${pct}%` }} />
              </div>
              <div className={styles.modeBarCount}>
                {view === "eficaz" ? `${count}%` : count}
              </div>
            </div>
          );
        })
      )}
    </div>
  );
}

interface EstadosSectionProps {
  days: number;
}

function EstadosSection({ days }: EstadosSectionProps): JSX.Element {
  const { freq, best } = useMemo(() => {
    const cutoff = daysAgoIso(days === 9999 ? 3650 : days);
    const log = getCheckinLog().filter((e: { date: string }) => e.date >= cutoff);
    const feedback = getSessionFeedback().filter((e: { date: string }) => e.date >= cutoff);

    const freq: Record<string, number> = {};
    for (const e of log) {
      freq[e.estadoId] = (freq[e.estadoId] || 0) + 1;
    }

    const pos: Record<string, number> = {};
    for (const f of feedback) {
      if (f.rating === 1 && f.estadoId) {
        pos[f.estadoId] = (pos[f.estadoId] || 0) + 1;
      }
    }
    const bestId = Object.entries(pos).sort((a, b) => b[1] - a[1])[0]?.[0];
    const bestEstado = bestId ? ESTADOS_DEFAULT.find((e: { id: string }) => e.id === bestId) : null;

    return { freq, best: bestEstado };
  }, [days]);

  const { maxFreq, sorted } = useMemo(() => {
    const maxFreq = Math.max(...Object.values(freq), 1);
    const sorted = ESTADOS_DEFAULT
      .map((e: { id: string; emoji: string; label: string }) => ({ ...e, count: freq[e.id] || 0 }))
      .filter((e: { count: number }) => e.count > 0)
      .sort((a: { count: number }, b: { count: number }) => b.count - a.count);
    return { maxFreq, sorted };
  }, [freq]);

  return (
    <div className={styles.section}>
      <div className={styles.sectionTitle}>Estados emocionais</div>
      {!sorted.length ? (
        <div className={styles.empty}>Nenhum check-in registrado ainda.</div>
      ) : (
        <>
          {sorted.map((e: { id: string; emoji: string; label: string; count: number }) => (
            <div key={e.id} className={styles.estadoRow}>
              <span className={styles.estadoEmoji}>{e.emoji}</span>
              <span className={styles.estadoLabel}>{e.label}</span>
              <div className={styles.estadoTrack}>
                <div className={styles.estadoFill} style={{ width: `${(e.count / maxFreq) * 100}%` }} />
              </div>
              <span className={styles.estadoCount}>{e.count}</span>
            </div>
          ))}
          {best && (
            <div className={styles.bestEstado}>
              {(best as { emoji: string; label: string }).emoji} Você performa melhor quando está <strong>{(best as { label: string }).label.toLowerCase()}</strong>
            </div>
          )}
        </>
      )}
    </div>
  );
}

// ── Usage Insights (post-session logs) ───────────────────────────────────────

const FEELING_LABELS: Record<string, string> = {
  flow:       "⚡ No flow",
  thinking:   "💭 Pensando em algo",
  tired:      "😓 Cansado",
  sleepy:     "😴 Com sono",
  anxious:    "😬 Ansioso",
  good:       "😊 Bem",
  distracted: "🌀 Distraído",
};

const HOUR_BLOCKS: { label: string; range: [number, number]; emoji: string }[] = [
  { label: "Madrugada", range: [0, 5],   emoji: "🌙" },
  { label: "Manhã",     range: [6, 11],  emoji: "🌅" },
  { label: "Tarde",     range: [12, 17], emoji: "☀️" },
  { label: "Noite",     range: [18, 23], emoji: "🌆" },
];

interface UsageInsightsProps {
  remoteLoaded: boolean;
}

function UsageInsights({ remoteLoaded }: UsageInsightsProps): JSX.Element {
  const logs = useMemo(() => getUsageLogs(), [remoteLoaded]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!logs.length) {
    return (
      <div className={styles.section}>
        <div className={styles.sectionTitle}>⏰ Melhor momento para cada modo</div>
        <div className={styles.empty}>
          Registre suas sessões com "📝 Registrar uso" para ver insights aqui.
        </div>
      </div>
    );
  }

  // ── Estatísticas por modo ──────────────────────────────────────────────────
  const modeStats = useMemo(() => {
    const byMode: Record<string, { total: number; worked: number; focusSum: number }> = {};
    for (const log of logs) {
      if (!byMode[log.modeId]) byMode[log.modeId] = { total: 0, worked: 0, focusSum: 0 };
      byMode[log.modeId].total++;
      if (log.worked) byMode[log.modeId].worked++;
      byMode[log.modeId].focusSum += log.focusedMinutes || 0;
    }
    return Object.entries(byMode)
      .map(([modeId, s]) => {
        const mode = MODES.find((m) => m.id === modeId);
        return {
          modeId,
          name: mode ? `${mode.emoji} ${mode.name}` : modeId,
          total: s.total,
          successRate: Math.round((s.worked / s.total) * 100),
          avgFocus: Math.round(s.focusSum / s.total),
        };
      })
      .sort((a, b) => b.total - a.total)
      .slice(0, 6);
  }, [logs]);

  // ── Melhor horário geral (por bloco de dia) ───────────────────────────────
  const { blockStats, bestBlock } = useMemo(() => {
    const stats = HOUR_BLOCKS.map((block) => {
      const blockLogs = logs.filter((l: { hour: number }) => l.hour >= block.range[0] && l.hour <= block.range[1]);
      if (!blockLogs.length) return { ...block, total: 0, successRate: 0 };
      const worked = blockLogs.filter((l: { worked: boolean }) => l.worked).length;
      return { ...block, total: blockLogs.length, successRate: Math.round((worked / blockLogs.length) * 100) };
    });
    const best = [...stats].sort(
      (a, b) => (b.total > 0 ? b.successRate : -1) - (a.total > 0 ? a.successRate : -1)
    )[0];
    return { blockStats: stats, bestBlock: best };
  }, [logs]);

  // ── Sentimentos ───────────────────────────────────────────────────────────
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const feelingStats = useMemo(() => getFeelingStats().slice(0, 5), [remoteLoaded]);

  // ── Feature 2: Tendência temporal ────────────────────────────────────────
  const trend = useMemo(() => getTemporalTrend(), [remoteLoaded]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Feature 4: Correlação estado × modo ──────────────────────────────────
  const correlation = useMemo(() => {
    const raw = getCorrelationByEstado();
    return Object.entries(raw)
      .filter(([, estados]) => (estados as unknown[]).length >= 2)
      .map(([modeId, estados]) => {
        const estadosArr = estados as any[];
        const mode = MODES.find((m) => m.id === modeId);
        return {
          modeId,
          name: mode ? `${mode.emoji} ${mode.name}` : modeId,
          best: estadosArr[0],
          worst: estadosArr[estadosArr.length - 1],
          all: estadosArr,
        };
      })
      .slice(0, 4);
  }, [remoteLoaded]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <>
      {/* Bloco: taxa de sucesso por modo */}
      <div className={styles.section}>
        <div className={styles.sectionTitle}>📝 Registros de uso dos modos</div>
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {modeStats.map((m) => (
            <div key={m.modeId} style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <span style={{ fontSize: 12, color: "var(--text)", minWidth: 120, flex: 1 }}>{m.name}</span>
              <div style={{ flex: 2, background: "var(--surface-2)", borderRadius: 4, height: 8, overflow: "hidden" }}>
                <div style={{ height: "100%", background: m.successRate >= 70 ? "var(--success)" : m.successRate >= 40 ? "var(--accent)" : "#e05252", width: `${m.successRate}%`, borderRadius: 4, transition: "width 0.4s" }} />
              </div>
              <span style={{ fontSize: 11, color: "var(--text-muted)", minWidth: 60, textAlign: "right" }}>
                {m.successRate}% · {m.total}x
              </span>
            </div>
          ))}
        </div>
        <div style={{ fontSize: 12, color: "var(--text-muted)", marginTop: 4 }}>
          Verde ≥ 70% sucesso · Roxo ≥ 40% · Vermelho &lt; 40%
        </div>
      </div>

      {/* Bloco: melhor horário */}
      <div className={styles.section}>
        <div className={styles.sectionTitle}>⏰ Melhor momento do dia</div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: 8 }}>
          {blockStats.map((b) => (
            <div
              key={b.label}
              style={{
                padding: "12px 14px",
                background: bestBlock?.label === b.label && b.total > 0 ? "rgba(78,204,163,0.10)" : "var(--surface-2)",
                border: `1px solid ${bestBlock?.label === b.label && b.total > 0 ? "rgba(78,204,163,0.35)" : "var(--border)"}`,
                borderRadius: "var(--radius)",
                display: "flex", flexDirection: "column", gap: 4,
              }}
            >
              <div style={{ fontSize: 18 }}>{b.emoji}</div>
              <div style={{ fontSize: 13, fontWeight: 600, color: "var(--text)" }}>{b.label}</div>
              {b.total > 0 ? (
                <>
                  <div style={{ fontSize: 20, fontWeight: 700, color: b.successRate >= 70 ? "var(--success)" : "var(--accent)" }}>
                    {b.successRate}%
                  </div>
                  <div style={{ fontSize: 11, color: "var(--text-muted)" }}>{b.total} sessão(ões)</div>
                </>
              ) : (
                <div style={{ fontSize: 11, color: "var(--text-muted)" }}>Sem dados</div>
              )}
              {bestBlock?.label === b.label && b.total > 0 && (
                <div style={{ fontSize: 11, color: "var(--success)", fontWeight: 600 }}>✨ Seu melhor horário</div>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Bloco: sentimentos que funcionam */}
      {feelingStats.length > 0 && (
        <div className={styles.section}>
          <div className={styles.sectionTitle}>💆 Como você estava quando funcionou</div>
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {feelingStats.map((f: { feeling: string; successRate: number; workedCount: number; notWorkedCount: number }) => (
              <div key={f.feeling} style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <span style={{ fontSize: 12, color: "var(--text)", flex: 1 }}>
                  {FEELING_LABELS[f.feeling] || f.feeling}
                </span>
                <div style={{ flex: 2, background: "var(--surface-2)", borderRadius: 4, height: 8, overflow: "hidden" }}>
                  <div style={{ height: "100%", background: f.successRate >= 70 ? "var(--success)" : "var(--accent)", width: `${f.successRate}%`, borderRadius: 4 }} />
                </div>
                <span style={{ fontSize: 11, color: "var(--text-muted)", minWidth: 60, textAlign: "right" }}>
                  {f.successRate}% · {f.workedCount + f.notWorkedCount}x
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Feature 2: Tendência temporal — últimos 14d vs 14d anteriores */}
      {trend && trend.length > 0 && (() => {
        const ups   = trend.filter((t: { trend: string }) => t.trend === "up");
        const downs = trend.filter((t: { trend: string }) => t.trend === "down");
        const best  = [...trend].sort((a: { recentRate: number }, b: { recentRate: number }) => b.recentRate - a.recentRate)[0];
        const msg = ups.length && downs.length
          ? `Você estava funcionando melhor à${downs[0].block.label === "manhã" ? " " : "s "}${downs[0].block.emoji} ${downs[0].block.label}, mas nas últimas 2 semanas rendeu mais à${ups[0].block.label === "manhã" ? " " : "s "}${ups[0].block.emoji} ${ups[0].block.label}.`
          : ups.length
          ? `Nas últimas 2 semanas você melhorou à${ups[0].block.label === "manhã" ? " " : "s "}${ups[0].block.emoji} ${ups[0].block.label} (+${ups[0].delta}pp).`
          : downs.length
          ? `Seu rendimento à${downs[0].block.label === "manhã" ? " " : "s "}${downs[0].block.emoji} ${downs[0].block.label} caiu nas últimas 2 semanas (${downs[0].delta}pp).`
          : null;
        if (!msg) return null;
        return (
          <div className={styles.section}>
            <div className={styles.sectionTitle}>📈 Tendência das últimas 2 semanas</div>
            <div style={{
              padding: "14px 16px",
              background: "var(--surface-2)",
              border: "1px solid var(--border)",
              borderRadius: "var(--radius)",
              fontSize: 13,
              color: "var(--text-muted)",
              lineHeight: 1.6,
            }}>
              {msg}
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 6, marginTop: 8 }}>
              {trend.map((t: any) => (
                <div key={t.block.id} style={{ display: "flex", alignItems: "center", gap: 10 }}>
                  <span style={{ fontSize: 12, minWidth: 80 }}>{t.block.emoji} {t.block.label}</span>
                  <div style={{ flex: 1, display: "flex", gap: 6, alignItems: "center" }}>
                    {t.prevRate !== null && (
                      <div style={{ position: "relative", flex: 1, background: "var(--surface-2)", borderRadius: 4, height: 6, overflow: "hidden" }}>
                        <div style={{ height: "100%", background: "var(--border)", width: `${t.prevRate}%`, borderRadius: 4 }} />
                      </div>
                    )}
                    <div style={{ position: "relative", flex: 1, background: "var(--surface-2)", borderRadius: 4, height: 6, overflow: "hidden" }}>
                      <div style={{ height: "100%", background: t.trend === "up" ? "var(--success)" : t.trend === "down" ? "#e05252" : "var(--accent)", width: `${t.recentRate}%`, borderRadius: 4 }} />
                    </div>
                  </div>
                  <span style={{ fontSize: 11, color: t.trend === "up" ? "var(--success)" : t.trend === "down" ? "#e05252" : "var(--text-muted)", minWidth: 40, textAlign: "right", fontWeight: 600 }}>
                    {t.trend === "up" ? "↑" : t.trend === "down" ? "↓" : "→"} {t.recentRate}%
                  </span>
                </div>
              ))}
            </div>
            <div style={{ fontSize: 11, color: "var(--text-muted)", marginTop: 4 }}>
              Barra cinza = período anterior · colorida = últimos 14 dias
            </div>
          </div>
        );
      })()}

      {/* Feature 4: Correlação estado emocional × modo */}
      {correlation.length > 0 && (
        <div className={styles.section}>
          <div className={styles.sectionTitle}>🔗 Estado emocional × modo</div>
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {correlation.map((c) => {
              const bestEstado  = ESTADOS_DEFAULT.find((e: { id: string }) => e.id === c.best.estadoId);
              const worstEstado = ESTADOS_DEFAULT.find((e: { id: string }) => e.id === c.worst.estadoId);
              return (
                <div key={c.modeId} style={{
                  padding: "12px 14px",
                  background: "var(--surface-2)",
                  border: "1px solid var(--border)",
                  borderRadius: "var(--radius)",
                  display: "flex", flexDirection: "column", gap: 6,
                }}>
                  <div style={{ fontSize: 13, fontWeight: 700, color: "var(--text)" }}>{c.name}</div>
                  {bestEstado && c.best.successRate > 0 && (
                    <div style={{ fontSize: 12, color: "var(--success)" }}>
                      ✅ Funciona melhor quando <strong>{(bestEstado as any).emoji} {(bestEstado as any).label}</strong> — {c.best.successRate}% ({c.best.total}×)
                    </div>
                  )}
                  {worstEstado && c.worst.estadoId !== c.best.estadoId && c.worst.successRate < c.best.successRate && (
                    <div style={{ fontSize: 12, color: "var(--text-muted)" }}>
                      ⚠️ Menos eficaz quando <strong>{(worstEstado as any).emoji} {(worstEstado as any).label}</strong> — {c.worst.successRate}% ({c.worst.total}×)
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}
    </>
  );
}

function Achievements(): JSX.Element {
  const all = useMemo(() => getAllWithStatus(), []);
  const unlocked = all.filter((a: { unlocked: boolean }) => a.unlocked).length;

  return (
    <div className={styles.section}>
      <div className={styles.sectionTitle}>Conquistas — {unlocked}/{all.length} desbloqueadas</div>
      <div className={styles.achGrid}>
        {all.map((a: { id: string; emoji: string; name: string; desc: string; unlocked: boolean }) => (
          <div key={a.id} className={`${styles.achCard} ${a.unlocked ? "" : styles.locked}`} title={a.desc}>
            <span className={styles.achEmoji}>{a.emoji}</span>
            <div className={styles.achName}>{a.name}</div>
            <div className={styles.achDesc}>{a.desc}</div>
          </div>
        ))}
      </div>
    </div>
  );
}

interface AvgTimeProps {
  history: HistoryEntry[];
}

function AvgTime({ history }: AvgTimeProps): JSX.Element {
  const { avg, total } = useMemo(() => {
    const allTimings = history.flatMap((e) => e.timings || []);
    const used = allTimings.filter((t) => t.used > 0).map((t) => t.used);
    if (!used.length) return { avg: null, total: 0 };
    const avgMs = used.reduce((s, v) => s + v, 0) / used.length;
    return { avg: Math.round(avgMs / 60), total: used.length };
  }, [history]);

  return (
    <div className={styles.section}>
      <div className={styles.sectionTitle}>Tempo médio por tarefa</div>
      {avg === null ? (
        <EmptyState title="Sem dados de tempo ainda." />
      ) : (
        <div className={styles.avgRow}>
          <div className={styles.avgBig}>{avg}min</div>
          <div className={styles.avgDetail}>
            Baseado em {total} tarefa{total !== 1 ? "s" : ""}<br />
            no período selecionado
          </div>
        </div>
      )}
    </div>
  );
}

// Fix #8: Histórico de sessões com link para navegar ao dashboard
interface SessionHistoryProps {
  history: HistoryEntry[];
}

function SessionHistory({ history }: SessionHistoryProps): JSX.Element | null {
  if (!history.length) return null;
  return (
    <div className={styles.section}>
      <div className={styles.sectionTitle}>Sessões recentes</div>
      <div className={styles.sessionList}>
        {history.slice(0, 10).map((entry, i) => {
          const estado = ESTADOS_DEFAULT.find((e: { id: string }) => e.id === entry.estadoId);
          return (
            <div key={i} className={styles.sessionRow}>
              <div className={styles.sessionLevel}>Nv.{entry.level}</div>
              <div className={styles.sessionInfo}>
                <div className={styles.sessionDate}>
                  {entry.date} · {entry.completedAt}
                  {entry.rushMode && <span className={styles.sessionTag}>🚀 Rush</span>}
                  {estado && <span className={styles.sessionTag}>{(estado as any).emoji} {(estado as any).label}</span>}
                </div>
                <div className={styles.sessionTasks}>
                  {entry.tasks.slice(0, 2).join(" · ")}
                  {entry.tasks.length > 2 && ` +${entry.tasks.length - 2}`}
                </div>
              </div>
            </div>
          );
        })}
      </div>
      {history.length > 10 && (
        <div className={styles.sessionMore}>+{history.length - 10} sessões mais antigas</div>
      )}
    </div>
  );
}

// ── SemanaComparativo ─────────────────────────────────────────────────────────

interface SemanaComparativoProps {
  allHistory: HistoryEntry[];
}

function SemanaComparativo({ allHistory }: SemanaComparativoProps): JSX.Element | null {
  const { thisWeek, lastWeek } = useMemo(() => {
    const now = new Date();
    const dayOfWeek = now.getDay();

    const startOfThisWeek = new Date(now);
    startOfThisWeek.setHours(0, 0, 0, 0);
    startOfThisWeek.setDate(now.getDate() - dayOfWeek);

    const startOfLastWeek = new Date(startOfThisWeek);
    startOfLastWeek.setDate(startOfThisWeek.getDate() - 7);

    const pad = (n: number): string => String(n).padStart(2, "0");
    const toIsoLocal = (d: Date): string =>
      `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;

    const thisWeekStart = toIsoLocal(startOfThisWeek);
    const lastWeekStart = toIsoLocal(startOfLastWeek);
    const lastWeekEnd   = thisWeekStart;

    const thisWeek = allHistory.filter((e) => toIso(e.date) >= thisWeekStart);
    const lastWeek = allHistory.filter((e) => {
      const iso = toIso(e.date);
      return iso >= lastWeekStart && iso < lastWeekEnd;
    });
    return { thisWeek, lastWeek };
  }, [allHistory]);

  const focusComp  = useMemo(() => getWeeklyFocusComparison(), []);
  const bestDay    = useMemo(() => getBestDayOfWeek(), []);

  if (!thisWeek.length && !lastWeek.length && !focusComp.thisWeekMin) return null;

  const thisSessions = thisWeek.length;
  const lastSessions = lastWeek.length;
  const thisTasks    = thisWeek.reduce((s, e) => s + e.tasks.length, 0);
  const lastTasks    = lastWeek.reduce((s, e) => s + e.tasks.length, 0);

  function DiffBadge({ current, previous, formatter }: { current: number; previous: number; formatter?: (v: number) => string }): JSX.Element {
    const diff = current - previous;
    if (diff === 0) return <span style={{ color: "var(--text-muted)", fontSize: 12 }}>= igual à semana passada</span>;
    const color = diff > 0 ? "var(--success)" : "var(--danger)";
    const arrow = diff > 0 ? "▲" : "▼";
    const display = formatter ? formatter(Math.abs(diff)) : Math.abs(diff);
    return (
      <span style={{ color, fontSize: 12, fontWeight: 600 }}>
        {arrow} {display} vs semana passada
      </span>
    );
  }

  const cardStyle: React.CSSProperties = { background: "var(--surface-2)", borderRadius: "var(--radius-sm)", padding: "14px 16px" };
  const labelStyle: React.CSSProperties = { fontSize: 11, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 8 };
  const valStyle = (color: string): React.CSSProperties => ({ fontSize: 28, fontWeight: 700, color, lineHeight: 1, marginBottom: 6 });

  return (
    <div className={styles.section}>
      <div className={styles.sectionTitle}>Semana atual vs anterior</div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))", gap: 12 }}>
        <div style={cardStyle}>
          <div style={labelStyle}>Sessões</div>
          <div style={valStyle("var(--accent)")}>{thisSessions}</div>
          <DiffBadge current={thisSessions} previous={lastSessions} />
        </div>
        <div style={cardStyle}>
          <div style={labelStyle}>Tarefas</div>
          <div style={valStyle("var(--success)")}>{thisTasks}</div>
          <DiffBadge current={thisTasks} previous={lastTasks} />
        </div>
        <div style={cardStyle}>
          <div style={labelStyle}>⏱ Foco</div>
          <div style={valStyle("#4ade80")}>{focusComp.thisWeekMin > 0 ? formatMinutes(focusComp.thisWeekMin) : "—"}</div>
          {focusComp.lastWeekMin > 0
            ? <DiffBadge current={focusComp.thisWeekMin} previous={focusComp.lastWeekMin} formatter={formatMinutes} />
            : <span style={{ color: "var(--text-muted)", fontSize: 12 }}>sem dados anteriores</span>}
        </div>
        {bestDay && (
          <div style={cardStyle}>
            <div style={labelStyle}>🗓 Melhor dia</div>
            <div style={valStyle("var(--accent)")}>{(bestDay as any).dayName}</div>
            <span style={{ color: "var(--text-muted)", fontSize: 12 }}>~{formatMinutes((bestDay as any).avgFocusMin)}/sessão</span>
          </div>
        )}
      </div>
    </div>
  );
}

// ── Humor × Modo chart ───────────────────────────────────────────────────────

const ESTADO_COLORS: Record<string, string> = {
  travado:         "#4ea8cc",
  cansado:         "#7c6ef5",
  ansioso:         "#f0a540",
  sem_foco:        "#4ecca3",
  disperso:        "#e05252",
  energizado:      "#b06ef5",
  sobrecarregado:  "#2d9bf0",
  procrastinando:  "#e1306c",
};

interface MoodModeChartProps {
  remoteLoaded: boolean;
}

function MoodModeChart({ remoteLoaded }: MoodModeChartProps): JSX.Element {
  const moodModeData = useMemo(() => getMoodModeStats(), [remoteLoaded]); // eslint-disable-line react-hooks/exhaustive-deps

  if (moodModeData.length < 3) {
    return (
      <div className={styles.section}>
        <div className={styles.sectionTitle}>🧠 Humor × Modo Eficaz</div>
        <EmptyState icon="📊" title="Dados insuficientes ainda — use mais modos após seus check-ins para ver correlações aqui." />
      </div>
    );
  }

  const { estados, chartData } = useMemo(() => {
    const topModes = [...new Set(moodModeData.map((d: { modeId: string }) => d.modeId))].slice(0, 8);
    const estados = [...new Set(moodModeData.map((d: { estado: string }) => d.estado))];
    const chartData = topModes.map((modeId) => {
      const entry: Record<string, unknown> = {
        modeId,
        modeName: moodModeData.find((d: { modeId: string }) => d.modeId === modeId)?.modeName || modeId,
      };
      for (const estado of estados) {
        const match = moodModeData.find((d: { modeId: string; estado: string }) => d.modeId === modeId && d.estado === estado);
        entry[estado as string] = match?.successRate || 0;
      }
      return entry;
    });
    return { estados, chartData };
  }, [moodModeData]);

  return (
    <div className={styles.section}>
      <div className={styles.sectionTitle}>🧠 Humor × Modo Eficaz</div>
      <div className={styles.chartWrap}>
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={chartData} margin={{ top: 5, right: 20, left: 0, bottom: 60 }}>
            <XAxis dataKey="modeName" angle={-35} textAnchor="end" tick={{ fill: "#7a7a9a", fontSize: 11 }} />
            <YAxis tickFormatter={(v: number) => v + "%"} domain={[0, 100]} tick={{ fill: "#7a7a9a", fontSize: 10 }} tickLine={false} />
            <Tooltip contentStyle={TOOLTIP_STYLE} formatter={(v: number, name: string) => [v + "%", name]} />
            <Legend wrapperStyle={{ fontSize: 11, color: "#7a7a9a" }} />
            {(estados as string[]).map((e) => (
              <Bar key={e} dataKey={e} name={e} fill={ESTADO_COLORS[e] || "#7c6ef5"} radius={[3, 3, 0, 0]} />
            ))}
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}

// ── Emotion Transform Chart ───────────────────────────────────────────────────

type FeedbackEntry = {
  estadoId?: string;
  modeId?: string;
  estadoAfter?: string;
  rating?: number;
  date?: string;
};

function EmotionTransformChart(): JSX.Element {
  const data = useMemo((): { modeId: string; transitions: { before: string; after: string; count: number }[] }[] => {
    const feedbacks = (getSessionFeedback() as FeedbackEntry[]).filter(
      (f) => f.estadoId && f.modeId && f.estadoAfter
    );
    if (!feedbacks.length) return [];

    const byMode: Record<string, Record<string, number>> = {};
    for (const f of feedbacks) {
      const key = `${f.estadoId}→${f.estadoAfter}`;
      if (!byMode[f.modeId!]) byMode[f.modeId!] = {};
      byMode[f.modeId!][key] = (byMode[f.modeId!][key] || 0) + 1;
    }

    return Object.entries(byMode)
      .filter(([, pairs]) => Object.values(pairs).reduce((s, v) => s + v, 0) >= 2)
      .map(([modeId, pairs]) => ({
        modeId,
        transitions: Object.entries(pairs)
          .map(([key, count]) => {
            const [before, after] = key.split("→");
            return { before, after, count };
          })
          .sort((a, b) => b.count - a.count)
          .slice(0, 3),
      }))
      .sort((a, b) => {
        const totalA = a.transitions.reduce((s, t) => s + t.count, 0);
        const totalB = b.transitions.reduce((s, t) => s + t.count, 0);
        return totalB - totalA;
      });
  }, []);

  if (!data.length) {
    return (
      <div className={styles.section}>
        <div className={styles.sectionTitle}>🔄 Transformações emocionais por modo</div>
        <EmptyState icon="💡" title="Complete sessões no Daily Focus e registre como você se sente depois para ver como cada modo transforma seu estado emocional." />
      </div>
    );
  }

  return (
    <div className={styles.section}>
      <div className={styles.sectionTitle}>🔄 Transformações emocionais por modo</div>
      <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
        {data.map(({ modeId, transitions }) => {
          const modeName = modeId;
          return (
            <div key={modeId} style={{
              background: "var(--surface)",
              border: "1px solid var(--border)",
              borderRadius: "var(--radius-sm)",
              padding: "10px 14px",
            }}>
              <div style={{ fontSize: 13, fontWeight: 600, color: "var(--text)", marginBottom: 8 }}>
                {modeName}
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                {transitions.map(({ before, after, count }) => {
                  const beforeEstado = ESTADOS_DEFAULT.find((e: { id: string }) => e.id === before);
                  const afterEstado = ESTADOS_DEFAULT.find((e: { id: string }) => e.id === after);
                  return (
                    <div key={`${before}→${after}`} style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13 }}>
                      <span title={beforeEstado?.label || before}>
                        {beforeEstado?.emoji || before}
                      </span>
                      <span style={{ color: "var(--text-muted)", fontSize: 11 }}>→</span>
                      <span title={afterEstado?.label || after}>
                        {afterEstado?.emoji || after}
                      </span>
                      <span style={{ fontSize: 11, color: "var(--text-muted)", marginLeft: "auto" }}>
                        {count}×
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ── Focus Budget ──────────────────────────────────────────────────────────────

interface FocusBudgetProps {
  remoteLoaded: boolean;
}

function FocusBudget({ remoteLoaded }: FocusBudgetProps): JSX.Element {
  const [goalHours, setGoalHours] = useState<number>(() => storageGet("taskflow.focusBudgetHours", 0));
  const [editing, setEditing] = useState<boolean>(false);
  const [inputVal, setInputVal] = useState<string>(String(goalHours || ""));

  const weeklyMinutes = useMemo(() => {
    const cutoff = daysAgoIso(7);
    return getUsageLogs()
      .filter((l: { date: string }) => l.date >= cutoff)
      .reduce((s: number, l: { focusedMinutes?: number }) => s + (l.focusedMinutes || 0), 0);
  }, [remoteLoaded]); // eslint-disable-line react-hooks/exhaustive-deps

  const weeklyHours = Math.round(weeklyMinutes / 6) / 10;
  const pct = goalHours > 0 ? Math.min(Math.round((weeklyHours / goalHours) * 100), 100) : 0;
  const color = pct >= 100 ? "var(--success)" : pct >= 60 ? "var(--accent)" : "var(--high)";

  const handleSave = (): void => {
    const val = parseFloat(inputVal);
    const hours = isNaN(val) || val < 0 ? 0 : val;
    setGoalHours(hours);
    storageSet("taskflow.focusBudgetHours", hours);
    setEditing(false);
  };

  return (
    <div className={styles.section}>
      <div className={styles.sectionHeader}>
        <div className={styles.sectionTitle}>🎯 Orçamento de foco semanal</div>
        <button className={styles.viewBtn} onClick={() => setEditing((v) => !v)}>
          {editing ? "Cancelar" : "Editar meta"}
        </button>
      </div>

      {editing ? (
        <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
          <input
            type="number"
            value={inputVal}
            onChange={(e) => setInputVal(e.target.value)}
            placeholder="Ex: 15"
            min="0"
            step="0.5"
            style={{ background: "var(--surface-2)", border: "1px solid var(--border)", color: "var(--text)", padding: "8px 12px", borderRadius: "var(--radius-sm)", fontSize: 14, width: 100, outline: "none" }}
            autoFocus
            onKeyDown={(e) => { if (e.key === "Enter") handleSave(); if (e.key === "Escape") setEditing(false); }}
          />
          <span style={{ fontSize: 13, color: "var(--text-muted)" }}>horas por semana</span>
          <button onClick={handleSave} style={{ background: "var(--accent)", color: "#fff", padding: "8px 14px", borderRadius: "var(--radius-sm)", fontSize: 13, fontWeight: 600 }}>
            Salvar
          </button>
        </div>
      ) : goalHours > 0 ? (
        <>
          <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13, color: "var(--text-muted)", marginBottom: 4 }}>
            <span>{weeklyHours}h focadas essa semana</span>
            <span style={{ fontWeight: 600, color }}>{pct}% da meta ({goalHours}h)</span>
          </div>
          <div style={{ background: "var(--surface-2)", borderRadius: 99, height: 10, overflow: "hidden" }}>
            <div style={{ height: "100%", background: color, width: `${pct}%`, borderRadius: 99, transition: "width 0.5s" }} />
          </div>
          {pct >= 100 && (
            <div style={{ fontSize: 12, color: "var(--success)", fontWeight: 600, marginTop: 4 }}>
              🎉 Meta da semana atingida!
            </div>
          )}
        </>
      ) : (
        <EmptyState title="Defina uma meta semanal de horas de foco para acompanhar seu progresso." />
      )}
    </div>
  );
}

// ── Distraction Insights ──────────────────────────────────────────────────────

interface DistractionInsightsProps {
  remoteLoaded: boolean;
}

function DistractionInsights({ remoteLoaded }: DistractionInsightsProps): JSX.Element {
  const insights = useMemo(() => getDistractionInsights(), [remoteLoaded]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!insights) {
    return (
      <div className={styles.section}>
        <div className={styles.sectionTitle}>📱 Padrões de distração</div>
        <EmptyState title="Registre ao menos 5 sessões com tempo ocioso para ver padrões aqui." />
      </div>
    );
  }

  const { topReasons, worstHourBlock, mostIdleModeEntry } = insights as {
    topReasons: { id: string; label: string; count: number; avgIdleMin: number }[];
    worstHourBlock?: { block: { emoji: string; label: string }; avgIdle: number };
    mostIdleModeEntry?: { name: string; avgIdle: number; total: number };
  };

  return (
    <div className={styles.section}>
      <div className={styles.sectionTitle}>📱 Padrões de distração</div>

      {topReasons.length > 0 && (
        <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
          {topReasons.map((r) => (
            <div key={r.id} style={{
              padding: "8px 12px",
              background: "var(--surface-2)",
              border: "1px solid var(--border)",
              borderRadius: "var(--radius-sm)",
              fontSize: 13,
            }}>
              <div style={{ fontWeight: 600, color: "var(--text)" }}>{r.label}</div>
              <div style={{ fontSize: 11, color: "var(--text-muted)", marginTop: 2 }}>
                {r.count}× · ~{r.avgIdleMin}min ocioso
              </div>
            </div>
          ))}
        </div>
      )}

      {worstHourBlock?.block && (
        <div style={{ fontSize: 13, color: "var(--text-muted)", padding: "10px 14px", background: "rgba(224,82,82,0.07)", border: "1px solid rgba(224,82,82,0.18)", borderRadius: "var(--radius-sm)" }}>
          ⚠️ Você se distrai mais {worstHourBlock.block.emoji} <strong>à{worstHourBlock.block.label === "manhã" ? " " : "s "}{worstHourBlock.block.label}</strong> — média de {worstHourBlock.avgIdle}min ocioso por sessão nesse período.
        </div>
      )}

      {mostIdleModeEntry && (
        <div style={{ fontSize: 13, color: "var(--text-muted)", padding: "10px 14px", background: "var(--surface-2)", border: "1px solid var(--border)", borderRadius: "var(--radius-sm)" }}>
          😴 <strong>{mostIdleModeEntry.name}</strong> tem o maior tempo ocioso médio ({mostIdleModeEntry.avgIdle}min por sessão, {mostIdleModeEntry.total}×).
        </div>
      )}
    </div>
  );
}

// ── Dashboard de eficiência consolidado ──────────────────────────────────────

function EfficiencyHeroRow({ remoteLoaded }: { remoteLoaded: boolean }): JSX.Element | null {
  const { globalAvg, bestModeEntry, bestBlock } = useMemo(() => {
    const logs = getUsageLogs().filter((e: any) => e.efficiencyPct !== undefined);
    if (!logs.length) return { globalAvg: null, bestModeEntry: null, bestBlock: null };

    const globalAvg = Math.round(logs.reduce((s: number, e: any) => s + e.efficiencyPct, 0) / logs.length);

    const avgByMode = getAvgEfficiencyByMode(90, 2);
    const bestModeId = Object.entries(avgByMode).sort(([, a], [, b]) => b - a)[0]?.[0] ?? null;
    const bestModeEntry = bestModeId
      ? { mode: MODES.find((m: any) => m.id === bestModeId), avg: avgByMode[bestModeId] }
      : null;

    const blocks = getTwoHourBlockEfficiency().filter((b) => b.sessions > 0);
    const bestBlock = blocks.sort((a, b) => b.avgEfficiency - a.avgEfficiency)[0] ?? null;

    return { globalAvg, bestModeEntry, bestBlock };
  }, [remoteLoaded]); // eslint-disable-line react-hooks/exhaustive-deps

  if (globalAvg === null) return null;

  const effColor = globalAvg >= 70 ? "#4caf82" : globalAvg >= 40 ? "#f5c542" : "#e05c5c";

  return (
    <div className={styles.section}>
      <div className={styles.sectionTitle}>⚡ Eficiência pessoal</div>
      <div className={styles.heroGrid}>
        <div className={styles.statCard}>
          <div className={styles.statValue} style={{ color: effColor }}>{globalAvg}%</div>
          <div className={styles.statLabel}>Média geral</div>
        </div>
        {bestModeEntry?.mode && (
          <div className={styles.statCard}>
            <div className={styles.statValue} style={{ fontSize: 22 }}>
              {(bestModeEntry.mode as any).emoji}
            </div>
            <div className={styles.statLabel}>
              🏆 {(bestModeEntry.mode as any).name}
              <br />
              <span style={{ color: "#4caf82", fontWeight: 700 }}>{bestModeEntry.avg}% avg</span>
            </div>
          </div>
        )}
        {bestBlock && bestBlock.sessions > 0 && (
          <div className={styles.statCard}>
            <div className={styles.statValue} style={{ fontSize: 16, color: "#4caf82" }}>
              {bestBlock.blockLabel}
            </div>
            <div className={styles.statLabel}>
              🕐 Melhor horário
              <br />
              <span style={{ color: "#4caf82", fontWeight: 700 }}>{bestBlock.avgEfficiency}% avg</span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function WeeklyEfficiencyTrendChart({ remoteLoaded }: { remoteLoaded: boolean }): JSX.Element | null {
  const data = useMemo(() => getWeeklyEfficiencyTrend(10), [remoteLoaded]); // eslint-disable-line react-hooks/exhaustive-deps
  if (data.length < 2) return null;

  return (
    <div className={styles.section}>
      <div className={styles.sectionTitle}>📈 Tendência semanal de eficiência</div>
      <div className={styles.chartWrap}>
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={data}>
            <CartesianGrid strokeDasharray="3 3" stroke="#2e2e3e" />
            <XAxis dataKey="weekLabel" tick={{ fill: "#7a7a9a", fontSize: 10 }} tickLine={false} />
            <YAxis
              tick={{ fill: "#7a7a9a", fontSize: 10 }}
              tickLine={false}
              domain={[0, 100]}
              tickFormatter={(v: number) => `${v}%`}
            />
            <Tooltip
              contentStyle={TOOLTIP_STYLE}
              formatter={(value: number, _: string, entry: any) =>
                [`${value}% (${entry.payload.sessions} sessões)`, "Eficiência média"]
              }
            />
            <ReferenceLine
              y={70}
              stroke="rgba(76,175,130,0.4)"
              strokeDasharray="4 4"
              label={{ value: "70%", position: "right", fill: "#4caf82", fontSize: 10 }}
            />
            <Line
              type="monotone"
              dataKey="avgEfficiency"
              stroke="#7c6ef5"
              strokeWidth={2.5}
              dot={{ fill: "#7c6ef5", r: 4 }}
              activeDot={{ r: 6 }}
              name="Eficiência média"
            />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}

function ModeEfficiencyRanking({ remoteLoaded }: { remoteLoaded: boolean }): JSX.Element | null {
  const ranked = useMemo(() => {
    const avgByMode = getAvgEfficiencyByMode(90, 2);
    return Object.entries(avgByMode)
      .sort(([, a], [, b]) => b - a)
      .slice(0, 8)
      .map(([modeId, avg]) => {
        const mode = MODES.find((m: any) => m.id === modeId);
        return { modeId, avg, mode };
      });
  }, [remoteLoaded]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!ranked.length) return null;

  return (
    <div className={styles.section}>
      <div className={styles.sectionTitle}>🏅 Ranking de modos por eficiência</div>
      <div className={styles.effRankingList}>
        {ranked.map(({ modeId, avg, mode }, i) => {
          const label = mode ? `${(mode as any).emoji} ${(mode as any).name}` : modeId;
          const color = avg >= 70 ? "#4caf82" : avg >= 40 ? "#f5c542" : "#e05c5c";
          return (
            <div key={modeId} className={styles.effRankRow}>
              <span className={styles.effRankPos}>#{i + 1}</span>
              <span className={styles.effRankLabel}>{label}</span>
              <div className={styles.effRankTrack}>
                <div className={styles.effRankFill} style={{ width: `${avg}%`, background: color }} />
              </div>
              <span className={styles.effRankPct} style={{ color }}>{avg}%</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ── Eficiência por sessão ─────────────────────────────────────────────────────

function SessionEfficiencyChart({ days, remoteLoaded }: { days: number; remoteLoaded: boolean }): JSX.Element {
  const data = useMemo(() => {
    const list = getSessionEfficiencyList(days);
    if (!list.length) return [];
    return list.slice(0, 30).reverse().map((e) => ({
      label:      `${e.date.slice(5).replace("-", "/")} ${e.hour}h`,
      duração:    e.sessionDurationMinutes,
      focado:     e.focusedMinutes,
      eficiência: e.efficiencyPct,
    }));
  }, [days, remoteLoaded]); // eslint-disable-line react-hooks/exhaustive-deps

  const lastItem = data[data.length - 1];

  return (
    <div className={styles.section}>
      <div className={styles.sectionTitle}>⚡ Eficiência por sessão</div>
      {lastItem && (
        <div style={{ fontSize: 12, color: "var(--text-muted)", marginBottom: 10, padding: "8px 12px", background: "var(--surface-2)", borderRadius: "var(--radius-sm)", border: "1px solid var(--border)", display: "flex", gap: 16, flexWrap: "wrap" }}>
          <span>Última sessão:</span>
          <span>🕐 Duração: <strong style={{ color: "var(--text)" }}>{lastItem.duração}min</strong></span>
          <span>⚡ Focado: <strong style={{ color: "#7c6ef5" }}>{lastItem.focado}min</strong></span>
          <span>🎯 Eficiência: <strong style={{ color: lastItem.eficiência >= 70 ? "#4caf82" : lastItem.eficiência >= 40 ? "#f5c542" : "#e05c5c" }}>{lastItem.eficiência}%</strong></span>
        </div>
      )}
      {data.length === 0 ? (
        <EmptyState title="Sem dados de eficiência ainda." description="Finalize uma sessão para ver o rastreamento automático." />
      ) : (
        <div className={styles.chartWrap}>
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={data} barSize={10} barCategoryGap="30%">
              <CartesianGrid strokeDasharray="3 3" stroke="#2e2e3e" />
              <XAxis dataKey="label" tick={{ fill: "#7a7a9a", fontSize: 10 }} tickLine={false} />
              <YAxis tick={{ fill: "#7a7a9a", fontSize: 10 }} tickLine={false} />
              <Tooltip contentStyle={TOOLTIP_STYLE} formatter={(v: number, n: string) => [`${v}${n === "eficiência" ? "%" : "min"}`, n]} />
              <Legend />
              <Bar dataKey="duração"    name="duração"    fill="#3a3a5e" radius={[4, 4, 0, 0]} />
              <Bar dataKey="focado"     name="focado"     fill="#7c6ef5" radius={[4, 4, 0, 0]} />
              <Bar dataKey="eficiência" name="eficiência%" fill="#4caf82" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}
    </div>
  );
}

// ── Heatmap de blocos de 2h ───────────────────────────────────────────────────

function TimeBlockEfficiencyHeatmap({ remoteLoaded }: { remoteLoaded: boolean }): JSX.Element {
  const blocks = useMemo(() => getTwoHourBlockEfficiency(), [remoteLoaded]); // eslint-disable-line react-hooks/exhaustive-deps
  const hasData = blocks.some((b) => b.sessions > 0);

  return (
    <div className={styles.section}>
      <div className={styles.sectionTitle}>🕐 Em que horário você é mais eficiente?</div>
      <div style={{ fontSize: 12, color: "var(--text-muted)", marginBottom: 12 }}>
        Blocos de 2h — média de eficiência (tempo focado ÷ duração total da sessão)
      </div>
      {!hasData ? (
        <EmptyState title="Sem dados de blocos ainda." description="Os horários aparecerão conforme você usar o app." />
      ) : (
        <div className={styles.blockGrid}>
          {blocks.map((b) => {
            const level = b.sessions === 0 ? "none" : b.avgEfficiency >= 70 ? "high" : b.avgEfficiency >= 40 ? "mid" : "low";
            return (
              <div
                key={b.startHour}
                className={styles.blockCell}
                data-efficiency={level}
                title={b.sessions > 0 ? `${b.blockLabel}: ${b.avgEfficiency}% de eficiência (${b.sessions} sessão${b.sessions > 1 ? "ões" : ""})` : `${b.blockLabel}: sem dados`}
              >
                <span className={styles.blockHour}>{b.blockLabel}</span>
                {b.sessions > 0 && <span className={styles.blockPct}>{b.avgEfficiency}%</span>}
                {b.sessions === 0 && <span className={styles.blockPct} style={{ opacity: 0.3 }}>—</span>}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ── TasksTrendChart ───────────────────────────────────────────────────────────

interface RawTask {
  id: string;
  created_at?: string | null;
  completed_at?: string | null;
  done?: boolean;
  completed?: boolean;
}

interface DayPoint {
  label: string;
  criadas: number;
  concluídas: number;
}

function TasksTrendChart({ days }: { days: number }): JSX.Element | null {
  const [data, setData] = useState<DayPoint[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    tasksApi.list({}).then((res) => {
      const tasks = (res as RawTask[]) ?? [];
      const n = Math.min(days >= 9999 ? 90 : days, 90);
      const points: DayPoint[] = [];

      for (let i = n - 1; i >= 0; i--) {
        const iso = daysAgoIso(i);
        const label = formatIsoToPtBR(iso);
        const criadas = tasks.filter((t) => t.created_at?.slice(0, 10) === iso).length;
        const concluídas = tasks.filter((t) => t.completed_at?.slice(0, 10) === iso).length;
        points.push({ label, criadas, concluídas });
      }

      setData(points);
    }).catch(() => setData([])).finally(() => setLoading(false));
  }, [days]);

  if (loading) return <EmptyState icon="⏳" title="Carregando…" />;
  const hasData = data.some((d) => d.criadas > 0 || d.concluídas > 0);
  if (!hasData) return <EmptyState title="Nenhuma tarefa encontrada no período." />;

  return (
    <ResponsiveContainer width="100%" height={200}>
      <BarChart data={data} margin={{ top: 4, right: 4, left: -20, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#2e2e3e" vertical={false} />
        <XAxis dataKey="label" tick={{ fill: "#7a7a9a", fontSize: 10 }} interval="preserveStartEnd" />
        <YAxis allowDecimals={false} tick={{ fill: "#7a7a9a", fontSize: 10 }} />
        <Tooltip contentStyle={TOOLTIP_STYLE} />
        <Legend wrapperStyle={{ fontSize: 11, color: "#7a7a9a" }} />
        <Bar dataKey="criadas" name="Criadas" fill="#4a4a70" radius={[3, 3, 0, 0]} maxBarSize={24} />
        <Bar dataKey="concluídas" name="Concluídas" fill="#4ecca3" radius={[3, 3, 0, 0]} maxBarSize={24} />
      </BarChart>
    </ResponsiveContainer>
  );
}

// ── RoutinesAdherenceChart ────────────────────────────────────────────────────

interface RawRoutine {
  id: string;
  completion_history?: string[];
}

interface AdherencePoint {
  label: string;
  adesao: number;
}

function RoutinesAdherenceChart({ days }: { days: number }): JSX.Element | null {
  const [data, setData] = useState<AdherencePoint[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    routinesApi.list({}).then((res) => {
      const routines = (res as RawRoutine[]) ?? [];
      if (!routines.length) { setData([]); setLoading(false); return; }

      const n = Math.min(days >= 9999 ? 90 : days, 90);
      const points: AdherencePoint[] = [];

      for (let i = n - 1; i >= 0; i--) {
        const iso = daysAgoIso(i);
        const label = formatIsoToPtBR(iso);
        const completed = routines.filter((r) => (r.completion_history ?? []).includes(iso)).length;
        const adesao = Math.round((completed / routines.length) * 100);
        points.push({ label, adesao });
      }

      setData(points);
    }).catch(() => setData([])).finally(() => setLoading(false));
  }, [days]);

  if (loading) return <EmptyState icon="⏳" title="Carregando…" />;
  if (!data.length) return null; // sem rotinas cadastradas

  return (
    <ResponsiveContainer width="100%" height={180}>
      <LineChart data={data} margin={{ top: 4, right: 4, left: -20, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#2e2e3e" vertical={false} />
        <XAxis dataKey="label" tick={{ fill: "#7a7a9a", fontSize: 10 }} interval="preserveStartEnd" />
        <YAxis domain={[0, 100]} tickFormatter={(v) => `${v}%`} tick={{ fill: "#7a7a9a", fontSize: 10 }} />
        <Tooltip contentStyle={TOOLTIP_STYLE} formatter={(v: number) => [`${v}%`, "Adesão"]} />
        <Line
          type="monotone"
          dataKey="adesao"
          stroke="var(--accent)"
          strokeWidth={2}
          dot={false}
          activeDot={{ r: 4, fill: "var(--accent)" }}
        />
      </LineChart>
    </ResponsiveContainer>
  );
}

// ── Main ──────────────────────────────────────────────────────────────────────

const REVIEW_AUTO_KEY = "taskflow.weeklyReviewLastShown";

export default function DashboardPage(): JSX.Element {
  const [periodIdx, setPeriodIdx] = useState<number>(1); // 30d default
  const [loaded, setLoaded] = useState<boolean>(false);
  const [showReview, setShowReview] = useState<boolean>(false);
  const [remoteLoaded, setRemoteLoaded] = useState<boolean>(false);

  // Auto-abrir revisão semanal na primeira visita de cada semana
  useEffect(() => {
    const lastShown = localStorage.getItem(REVIEW_AUTO_KEY) ?? "";
    const today = new Date();
    const dayOfWeek = today.getDay(); // 0=Dom, 1=Seg…
    const daysToMonday = dayOfWeek === 0 ? -6 : 1 - dayOfWeek;
    const monday = new Date(today);
    monday.setDate(today.getDate() + daysToMonday);
    const mondayISO = monday.toISOString().split("T")[0];
    if (lastShown < mondayISO) {
      const t = setTimeout(() => setShowReview(true), 1200);
      return () => clearTimeout(t);
    }
  }, []);

  useEffect(() => {
    let cancelled = false;
    Promise.all([loadRemoteUsageLogs(), loadRemoteModeLog()]).finally(() => {
      if (!cancelled) setRemoteLoaded(true);
    });

    const handleStorage = (e: StorageEvent): void => {
      if (e.key && (e.key.includes("sessionUsageLog") || e.key.includes("modeLog"))) {
        setRemoteLoaded((prev) => !prev);
      }
    };
    window.addEventListener("storage", handleStorage);
    return () => {
      cancelled = true;
      window.removeEventListener("storage", handleStorage);
    };
  }, []);

  useEffect(() => {
    const handle = setTimeout(() => setLoaded(true), 400);
    return () => clearTimeout(handle);
  }, []);

  const days = PERIOD_OPTS[periodIdx].days;

  const allHistory = useMemo(() => getHistory(), [remoteLoaded]); // eslint-disable-line react-hooks/exhaustive-deps

  const history = useMemo(() => {
    if (days >= 9999) return allHistory;
    const cutoff = daysAgoIso(days);
    return allHistory.filter((e: HistoryEntry) => toIso(e.date) >= cutoff);
  }, [days, allHistory]);

  const streak = getStreak();

  if (!loaded) {
    return (
      <div className={styles.page}>
        <div className={styles.pageTitle}>Dashboard</div>
        <div className={styles.pageSubtitle}>Carregando…</div>
        <style>{`
          @keyframes dashPulse {
            0%, 100% { opacity: 0.5; }
            50%       { opacity: 1;   }
          }
        `}</style>
        {[0, 1, 2].map((i) => (
          <div
            key={i}
            style={{
              height: 80,
              borderRadius: 10,
              background: "var(--surface-2, #2a2a38)",
              marginBottom: 16,
              animation: `dashPulse 1.4s ease-in-out ${i * 0.2}s infinite`,
            }}
          />
        ))}
      </div>
    );
  }

  return (
    <div className={styles.page}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
        <div>
          <div className={styles.pageTitle}>📊 Dashboard</div>
          <div className={styles.pageSubtitle} style={{ display: "flex", alignItems: "center", gap: 6 }}>
            Seu desempenho no Daily Focus
            {!remoteLoaded && (
              <span style={{ fontSize: 11, color: "var(--text-muted)", display: "flex", alignItems: "center", gap: 4 }}>
                <span style={{ display: "inline-block", width: 8, height: 8, borderRadius: "50%", background: "var(--accent)", animation: "dashPulse 1.2s ease-in-out infinite" }} />
                Sincronizando…
              </span>
            )}
          </div>
        </div>
        <button
          onClick={() => setShowReview(true)}
          style={{ background: "rgba(124,110,245,0.12)", border: "1px solid rgba(124,110,245,0.30)", color: "var(--accent)", padding: "8px 14px", borderRadius: "var(--radius-sm)", fontSize: 13, fontWeight: 600, transition: "all 0.15s" }}
        >
          📅 Revisão Semanal
        </button>
      </div>

      {showReview && <WeeklyReview onClose={() => {
        localStorage.setItem(REVIEW_AUTO_KEY, localIsoDate());
        setShowReview(false);
      }} />}

      <div className={styles.periodRow}>
        {PERIOD_OPTS.map((opt, i) => (
          <button
            key={opt.label}
            className={`${styles.periodBtn} ${i === periodIdx ? styles.active : ""}`}
            onClick={() => setPeriodIdx(i)}
          >
            {opt.label}
          </button>
        ))}
      </div>

      <HeroStats history={history} streak={streak} />
      <EfficiencyHeroRow remoteLoaded={remoteLoaded} />
      <EfficiencyYearHeatmap remoteLoaded={remoteLoaded} />
      <DayOfWeekEfficiencyPanel remoteLoaded={remoteLoaded} />
      <WeeklyEfficiencyTrendChart remoteLoaded={remoteLoaded} />
      <ModeEfficiencyRanking remoteLoaded={remoteLoaded} />
      <SemanaComparativo allHistory={allHistory} />

      {/* ── Tarefas & Rotinas ── */}
      <div className={styles.section}>
        <div className={styles.sectionTitle}>📋 Tarefas & Rotinas</div>
        <div style={{ marginBottom: 20 }}>
          <div style={{ fontSize: 12, fontWeight: 600, color: "var(--text-muted)", marginBottom: 10 }}>
            Tarefas criadas vs. concluídas por dia
          </div>
          <TasksTrendChart days={days} />
        </div>
        <div>
          <div style={{ fontSize: 12, fontWeight: 600, color: "var(--text-muted)", marginBottom: 10 }}>
            Adesão às rotinas (%)
          </div>
          <RoutinesAdherenceChart days={days} />
        </div>
      </div>

      <ActivityHeatmap history={history} days={days} />
      <SessionsBarChart history={history} days={days} />
      <FocusedMinutesChart days={days} remoteLoaded={remoteLoaded} />
      <SessionEfficiencyChart days={days} remoteLoaded={remoteLoaded} />
      <TimeBlockEfficiencyHeatmap remoteLoaded={remoteLoaded} />
      <FocusedMinutesByModeChart days={days} remoteLoaded={remoteLoaded} />
      <LevelLineChart history={history} days={days} allHistory={allHistory} />
      <TopModes days={days} remoteLoaded={remoteLoaded} />
      <EstadosSection days={days} />
      <FocusBudget remoteLoaded={remoteLoaded} />
      <MoodModeChart remoteLoaded={remoteLoaded} />
      <EmotionTransformChart />
      <UsageInsights remoteLoaded={remoteLoaded} />
      <DistractionInsights remoteLoaded={remoteLoaded} />
      <Achievements />
      <AvgTime history={history} />
      <SessionHistory history={history} />
    </div>
  );
}
