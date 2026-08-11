import { useState, useMemo, useEffect } from "react";
import {
  BarChart, Bar, LineChart, Line, ReferenceLine,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend,
} from "recharts";
import { getHistory, getStats, getStreak, getMaxLevel } from "../../lib/dailyFocusHistory";
import { usageStats } from "../../lib/modeLog";
import { getCheckinLog, getSessionFeedback } from "../../lib/checkinLog";
import { getAllWithStatus } from "../../lib/dailyFocusAchievements";
import { getUsageLogs, getFeelingStats, getTemporalTrend, getCorrelationByEstado } from "../../lib/sessionUsageLog";
import { getMoodModeStats } from "../../lib/moodModeCorrelation";
import { MODES } from "../../data/modes";
import { ESTADOS_DEFAULT } from "../daily-focus/stateToMode";
import styles from "./Dashboard.module.css";

// ── helpers ──────────────────────────────────────────────────────────────────

function parsePtBR(str) {
  const [d, m, y] = (str || "").split("/");
  return new Date(Number(y), Number(m) - 1, Number(d));
}

function toIso(ptbrStr) {
  const d = parsePtBR(ptbrStr);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${dd}`;
}

// Fix #11: usa data local, não UTC
function localIsoDate() {
  const d = new Date();
  return [d.getFullYear(), String(d.getMonth() + 1).padStart(2, "0"), String(d.getDate()).padStart(2, "0")].join("-");
}

function daysAgo(n) {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return d;
}

function daysAgoIso(n) {
  const d = daysAgo(n);
  return [d.getFullYear(), String(d.getMonth() + 1).padStart(2, "0"), String(d.getDate()).padStart(2, "0")].join("-");
}

// Fix #1: tooltip com data formatada em pt-BR
function formatIsoToPtBR(iso) {
  const [y, m, d] = iso.split("-");
  const date = new Date(Number(y), Number(m) - 1, Number(d));
  return date.toLocaleDateString("pt-BR", { weekday: "short", day: "2-digit", month: "short" });
}

const PERIOD_OPTS = [
  { label: "7d", days: 7 },
  { label: "30d", days: 30 },
  { label: "90d", days: 90 },
  { label: "Tudo", days: 9999 },
];

const TOOLTIP_STYLE = {
  backgroundColor: "#1a1a22",
  border: "1px solid #2e2e3e",
  borderRadius: 8,
  color: "#e8e8f0",
  fontSize: 12,
};

// ── Fix #4: Exportar dados ────────────────────────────────────────────────────
function handleExport() {
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

function HeroStats({ history, streak }) {
  const totalSessions = history.length;
  const totalTasks = history.reduce((s, e) => s + e.tasks.length, 0);
  const maxLevel = history.length ? Math.max(...history.map((e) => e.level)) : 0;
  const rushCount = history.filter((e) => e.rushMode).length;

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
      </div>
    </div>
  );
}

// Fix #1: tooltip com data legível
function HeatmapTooltip({ iso, count }) {
  return `${formatIsoToPtBR(iso)}: ${count} sessão${count !== 1 ? "ões" : ""}`;
}

function ActivityHeatmap({ history, days }) {
  const cells = useMemo(() => {
    const map = {};
    history.forEach((e) => {
      const iso = toIso(e.date);
      map[iso] = (map[iso] || 0) + 1;
    });

    const result = [];
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
            title={HeatmapTooltip(c)}  // Fix #1: data formatada
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

function SessionsBarChart({ history, days }) {
  const data = useMemo(() => {
    const map = {};
    history.forEach((e) => {
      const iso = toIso(e.date);
      map[iso] = (map[iso] || 0) + 1;
    });

    const result = [];
    const n = Math.min(days, 30);
    for (let i = n - 1; i >= 0; i--) {
      const iso = daysAgoIso(i);
      const d = daysAgo(i);
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

// Fix #2: linha fantasma do período anterior
function LevelLineChart({ history, days, allHistory }) {
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

    const avg = (arr) => arr.length ? Math.round(arr.reduce((s, e) => s + e.level, 0) / arr.length * 10) / 10 : null;
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

  // Mescla atual + anterior por índice
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
            <Tooltip contentStyle={TOOLTIP_STYLE} labelFormatter={(v) => `Sessão ${v}`} />
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
function TopModes({ days }) {
  const [view, setView] = useState("usado"); // "usado" | "eficaz"

  const { byUsage, byEfficacy } = useMemo(() => {
    const cutoff = daysAgoIso(days === 9999 ? 365 : days);
    const stats = usageStats(days === 9999 ? 365 : days);

    const feedback = getSessionFeedback().filter((e) => e.date >= cutoff);
    const pos = {};
    const total = {};
    for (const f of feedback) {
      if (!f.modeId) continue;
      total[f.modeId] = (total[f.modeId] || 0) + 1;
      if (f.rating === 1) pos[f.modeId] = (pos[f.modeId] || 0) + 1;
    }

    const byEfficacy = Object.entries(total)
      .filter(([, t]) => t >= 2) // mínimo 2 feedbacks para ser relevante
      .map(([modeId, t]) => ({
        modeId,
        count: Math.round(((pos[modeId] || 0) / t) * 100),
        total: t,
      }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 8);

    return { byUsage: stats.slice(0, 8), byEfficacy };
  }, [days]);

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
        activeList.map(({ modeId, count }) => {
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

function EstadosSection({ days }) {
  const { freq, best } = useMemo(() => {
    const cutoff = daysAgoIso(days === 9999 ? 3650 : days);
    const log = getCheckinLog().filter((e) => e.date >= cutoff);
    const feedback = getSessionFeedback().filter((e) => e.date >= cutoff);

    const freq = {};
    for (const e of log) {
      freq[e.estadoId] = (freq[e.estadoId] || 0) + 1;
    }

    const pos = {};
    for (const f of feedback) {
      if (f.rating === 1 && f.estadoId) {
        pos[f.estadoId] = (pos[f.estadoId] || 0) + 1;
      }
    }
    const bestId = Object.entries(pos).sort((a, b) => b[1] - a[1])[0]?.[0];
    const bestEstado = bestId ? ESTADOS_DEFAULT.find((e) => e.id === bestId) : null;

    return { freq, best: bestEstado };
  }, [days]);

  const maxFreq = Math.max(...Object.values(freq), 1);
  const sorted = ESTADOS_DEFAULT
    .map((e) => ({ ...e, count: freq[e.id] || 0 }))
    .filter((e) => e.count > 0)
    .sort((a, b) => b.count - a.count);

  return (
    <div className={styles.section}>
      <div className={styles.sectionTitle}>Estados emocionais</div>
      {!sorted.length ? (
        <div className={styles.empty}>Nenhum check-in registrado ainda.</div>
      ) : (
        <>
          {sorted.map((e) => (
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
              {best.emoji} Você performa melhor quando está <strong>{best.label.toLowerCase()}</strong>
            </div>
          )}
        </>
      )}
    </div>
  );
}

// ── Usage Insights (post-session logs) ───────────────────────────────────────

const FEELING_LABELS = {
  flow:       "⚡ No flow",
  thinking:   "💭 Pensando em algo",
  tired:      "😓 Cansado",
  sleepy:     "😴 Com sono",
  anxious:    "😬 Ansioso",
  good:       "😊 Bem",
  distracted: "🌀 Distraído",
};

const HOUR_BLOCKS = [
  { label: "Madrugada", range: [0, 5],   emoji: "🌙" },
  { label: "Manhã",     range: [6, 11],  emoji: "🌅" },
  { label: "Tarde",     range: [12, 17], emoji: "☀️" },
  { label: "Noite",     range: [18, 23], emoji: "🌆" },
];

function UsageInsights() {
  const logs = useMemo(() => getUsageLogs(), []);

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
  const byMode = {};
  for (const log of logs) {
    if (!byMode[log.modeId]) byMode[log.modeId] = { total: 0, worked: 0, focusSum: 0 };
    byMode[log.modeId].total++;
    if (log.worked) byMode[log.modeId].worked++;
    byMode[log.modeId].focusSum += log.focusedMinutes || 0;
  }
  const modeStats = Object.entries(byMode)
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

  // ── Melhor horário geral (por bloco de dia) ───────────────────────────────
  const blockStats = HOUR_BLOCKS.map((block) => {
    const blockLogs = logs.filter((l) => l.hour >= block.range[0] && l.hour <= block.range[1]);
    if (!blockLogs.length) return { ...block, total: 0, successRate: 0 };
    const worked = blockLogs.filter((l) => l.worked).length;
    return {
      ...block,
      total: blockLogs.length,
      successRate: Math.round((worked / blockLogs.length) * 100),
    };
  });
  const bestBlock = [...blockStats].sort((a, b) => (b.total > 0 ? b.successRate : -1) - (a.total > 0 ? a.successRate : -1))[0];

  // ── Sentimentos ───────────────────────────────────────────────────────────
  const feelingStats = getFeelingStats().slice(0, 5);

  // ── Feature 2: Tendência temporal ────────────────────────────────────────
  const trend = useMemo(() => getTemporalTrend(), []);

  // ── Feature 4: Correlação estado × modo ──────────────────────────────────
  const correlation = useMemo(() => {
    const raw = getCorrelationByEstado();
    // Para cada modo, pega o melhor e pior estado (com ≥2 registros)
    return Object.entries(raw)
      .filter(([, estados]) => estados.length >= 2)
      .map(([modeId, estados]) => {
        const mode = MODES.find((m) => m.id === modeId);
        return {
          modeId,
          name: mode ? `${mode.emoji} ${mode.name}` : modeId,
          best: estados[0],
          worst: estados[estados.length - 1],
          all: estados,
        };
      })
      .slice(0, 4);
  }, []);

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
            {feelingStats.map((f) => (
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
        const ups   = trend.filter((t) => t.trend === "up");
        const downs = trend.filter((t) => t.trend === "down");
        const best  = [...trend].sort((a, b) => b.recentRate - a.recentRate)[0];
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
              {trend.map((t) => (
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
              const bestEstado  = ESTADOS_DEFAULT.find((e) => e.id === c.best.estadoId);
              const worstEstado = ESTADOS_DEFAULT.find((e) => e.id === c.worst.estadoId);
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
                      ✅ Funciona melhor quando <strong>{bestEstado.emoji} {bestEstado.label}</strong> — {c.best.successRate}% ({c.best.total}×)
                    </div>
                  )}
                  {worstEstado && c.worst.estadoId !== c.best.estadoId && c.worst.successRate < c.best.successRate && (
                    <div style={{ fontSize: 12, color: "var(--text-muted)" }}>
                      ⚠️ Menos eficaz quando <strong>{worstEstado.emoji} {worstEstado.label}</strong> — {c.worst.successRate}% ({c.worst.total}×)
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

function Achievements() {
  const all = useMemo(() => getAllWithStatus(), []);
  const unlocked = all.filter((a) => a.unlocked).length;

  return (
    <div className={styles.section}>
      <div className={styles.sectionTitle}>Conquistas — {unlocked}/{all.length} desbloqueadas</div>
      <div className={styles.achGrid}>
        {all.map((a) => (
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

function AvgTime({ history }) {
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
        <div className={styles.empty}>Sem dados de tempo ainda.</div>
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
function SessionHistory({ history }) {
  if (!history.length) return null;
  return (
    <div className={styles.section}>
      <div className={styles.sectionTitle}>Sessões recentes</div>
      <div className={styles.sessionList}>
        {history.slice(0, 10).map((entry, i) => {
          const estado = ESTADOS_DEFAULT.find((e) => e.id === entry.estadoId);
          return (
            <div key={i} className={styles.sessionRow}>
              <div className={styles.sessionLevel}>Nv.{entry.level}</div>
              <div className={styles.sessionInfo}>
                <div className={styles.sessionDate}>
                  {entry.date} · {entry.completedAt}
                  {entry.rushMode && <span className={styles.sessionTag}>🚀 Rush</span>}
                  {estado && <span className={styles.sessionTag}>{estado.emoji} {estado.label}</span>}
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

function SemanaComparativo({ allHistory }) {
  const { thisWeek, lastWeek } = useMemo(() => {
    const now = new Date();
    const dayOfWeek = now.getDay(); // 0 = Sunday

    const startOfThisWeek = new Date(now);
    startOfThisWeek.setHours(0, 0, 0, 0);
    startOfThisWeek.setDate(now.getDate() - dayOfWeek);

    const startOfLastWeek = new Date(startOfThisWeek);
    startOfLastWeek.setDate(startOfThisWeek.getDate() - 7);

    const pad = (n) => String(n).padStart(2, "0");
    const toIsoLocal = (d) =>
      `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;

    const thisWeekStart = toIsoLocal(startOfThisWeek);
    const lastWeekStart = toIsoLocal(startOfLastWeek);
    const lastWeekEnd   = thisWeekStart; // exclusive

    const thisWeek = allHistory.filter((e) => {
      const iso = toIso(e.date);
      return iso >= thisWeekStart;
    });

    const lastWeek = allHistory.filter((e) => {
      const iso = toIso(e.date);
      return iso >= lastWeekStart && iso < lastWeekEnd;
    });

    return { thisWeek, lastWeek };
  }, [allHistory]);

  if (!thisWeek.length && !lastWeek.length) return null;

  const thisSessions = thisWeek.length;
  const lastSessions = lastWeek.length;
  const thisTasks    = thisWeek.reduce((s, e) => s + e.tasks.length, 0);
  const lastTasks    = lastWeek.reduce((s, e) => s + e.tasks.length, 0);

  function DiffBadge({ current, previous }) {
    const diff = current - previous;
    if (diff === 0) return <span style={{ color: "var(--text-muted)", fontSize: 12 }}>= igual à semana passada</span>;
    const color = diff > 0 ? "var(--success)" : "var(--danger)";
    const arrow = diff > 0 ? "▲" : "▼";
    return (
      <span style={{ color, fontSize: 12, fontWeight: 600 }}>
        {arrow} {Math.abs(diff)} vs semana passada
      </span>
    );
  }

  return (
    <div className={styles.section}>
      <div className={styles.sectionTitle}>Semana atual vs anterior</div>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
        <div style={{ background: "var(--surface-2)", borderRadius: "var(--radius-sm)", padding: "14px 16px" }}>
          <div style={{ fontSize: 11, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 8 }}>Sessões</div>
          <div style={{ fontSize: 30, fontWeight: 700, color: "var(--accent)", lineHeight: 1, marginBottom: 6 }}>{thisSessions}</div>
          <DiffBadge current={thisSessions} previous={lastSessions} />
        </div>
        <div style={{ background: "var(--surface-2)", borderRadius: "var(--radius-sm)", padding: "14px 16px" }}>
          <div style={{ fontSize: 11, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 8 }}>Tarefas</div>
          <div style={{ fontSize: 30, fontWeight: 700, color: "var(--success)", lineHeight: 1, marginBottom: 6 }}>{thisTasks}</div>
          <DiffBadge current={thisTasks} previous={lastTasks} />
        </div>
      </div>
    </div>
  );
}

// ── Humor × Modo chart ───────────────────────────────────────────────────────

const ESTADO_COLORS = {
  travado:         "#4ea8cc",
  cansado:         "#7c6ef5",
  ansioso:         "#f0a540",
  sem_foco:        "#4ecca3",
  disperso:        "#e05252",
  energizado:      "#b06ef5",
  sobrecarregado:  "#2d9bf0",
  procrastinando:  "#e1306c",
};

function MoodModeChart() {
  const moodModeData = useMemo(() => getMoodModeStats(), []);

  if (moodModeData.length < 3) {
    return (
      <div className={styles.section}>
        <div className={styles.sectionTitle}>🧠 Humor × Modo Eficaz</div>
        <div className={styles.empty}>
          📊 Dados insuficientes ainda — use mais modos após seus check-ins para ver correlações aqui.
        </div>
      </div>
    );
  }

  const topModes = [...new Set(moodModeData.map((d) => d.modeId))].slice(0, 8);
  const estados = [...new Set(moodModeData.map((d) => d.estado))];
  const chartData = topModes.map((modeId) => {
    const entry = {
      modeId,
      modeName: moodModeData.find((d) => d.modeId === modeId)?.modeName || modeId,
    };
    for (const estado of estados) {
      const match = moodModeData.find((d) => d.modeId === modeId && d.estado === estado);
      entry[estado] = match?.successRate || 0;
    }
    return entry;
  });

  return (
    <div className={styles.section}>
      <div className={styles.sectionTitle}>🧠 Humor × Modo Eficaz</div>
      <div className={styles.chartWrap}>
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={chartData} margin={{ top: 5, right: 20, left: 0, bottom: 60 }}>
            <XAxis dataKey="modeName" angle={-35} textAnchor="end" tick={{ fill: "#7a7a9a", fontSize: 11 }} />
            <YAxis tickFormatter={(v) => v + "%"} domain={[0, 100]} tick={{ fill: "#7a7a9a", fontSize: 10 }} tickLine={false} />
            <Tooltip contentStyle={TOOLTIP_STYLE} formatter={(v, name) => [v + "%", name]} />
            <Legend wrapperStyle={{ fontSize: 11, color: "#7a7a9a" }} />
            {estados.map((e) => (
              <Bar key={e} dataKey={e} name={e} fill={ESTADO_COLORS[e] || "#7c6ef5"} radius={[3, 3, 0, 0]} />
            ))}
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}

// ── Main ──────────────────────────────────────────────────────────────────────

export default function DashboardPage() {
  const [periodIdx, setPeriodIdx] = useState(1); // 30d default
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    const handle = setTimeout(() => setLoaded(true), 400);
    return () => clearTimeout(handle);
  }, []);

  const days = PERIOD_OPTS[periodIdx].days;

  const allHistory = useMemo(() => getHistory(), []);

  const history = useMemo(() => {
    if (days >= 9999) return allHistory;
    const cutoff = daysAgoIso(days);
    return allHistory.filter((e) => toIso(e.date) >= cutoff);
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
      <div className={styles.pageTitle}>📊 Dashboard</div>
      <div className={styles.pageSubtitle}>Seu desempenho no Daily Focus</div>

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
      <SemanaComparativo allHistory={allHistory} />
      <ActivityHeatmap history={history} days={days} />
      <SessionsBarChart history={history} days={days} />
      <LevelLineChart history={history} days={days} allHistory={allHistory} />
      <TopModes days={days} />
      <EstadosSection days={days} />
      <MoodModeChart />
      <UsageInsights />
      <Achievements />
      <AvgTime history={history} />
      <SessionHistory history={history} />
    </div>
  );
}
