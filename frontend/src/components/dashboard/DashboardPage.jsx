import { useState, useMemo } from "react";
import {
  BarChart, Bar, LineChart, Line,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
} from "recharts";
import { getHistory, getStats, getStreak, getMaxLevel } from "../../lib/dailyFocusHistory";
import { usageStats } from "../../lib/modeLog";
import { getCheckinLog, getSessionFeedback } from "../../lib/checkinLog";
import { getAllWithStatus } from "../../lib/dailyFocusAchievements";
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
  return d.toISOString().slice(0, 10);
}

function daysAgo(n) {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return d;
}

function isoToday() {
  return new Date().toISOString().slice(0, 10);
}

const PERIOD_OPTS = [
  { label: "7d", days: 7 },
  { label: "30d", days: 30 },
  { label: "90d", days: 90 },
  { label: "Tudo", days: 9999 },
];

const TOOLTIP_STYLE = {
  backgroundColor: "var(--surface)",
  border: "1px solid var(--border)",
  borderRadius: 8,
  color: "var(--text)",
  fontSize: 12,
};

// ── subcomponents ─────────────────────────────────────────────────────────────

function HeroStats({ history, streak }) {
  const totalSessions = history.length;
  const totalTasks = history.reduce((s, e) => s + e.tasks.length, 0);
  const maxLevel = history.length ? Math.max(...history.map((e) => e.level)) : 0;
  const rushCount = history.filter((e) => e.rushMode).length;

  return (
    <div className={styles.section}>
      <div className={styles.sectionTitle}>Visão geral</div>
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
      const d = daysAgo(i);
      const iso = d.toISOString().slice(0, 10);
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
            title={`${c.iso}: ${c.count} sessão${c.count !== 1 ? "ões" : ""}`}
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
      const d = daysAgo(i);
      const iso = d.toISOString().slice(0, 10);
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
            <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
            <XAxis
              dataKey="label"
              tick={{ fill: "var(--text-muted)", fontSize: 10 }}
              tickLine={false}
              interval={Math.floor(data.length / 6)}
            />
            <YAxis tick={{ fill: "var(--text-muted)", fontSize: 10 }} tickLine={false} allowDecimals={false} />
            <Tooltip contentStyle={TOOLTIP_STYLE} />
            <Bar dataKey="sessões" fill="var(--accent)" radius={[4, 4, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}

function LevelLineChart({ history, days }) {
  const data = useMemo(() => {
    const cutoff = daysAgo(days).toISOString().slice(0, 10);
    return [...history]
      .filter((e) => toIso(e.date) >= cutoff)
      .reverse()
      .map((e, i) => ({
        idx: i + 1,
        nível: e.level,
        data: e.date,
      }));
  }, [history, days]);

  if (data.length < 2) return null;

  return (
    <div className={styles.section}>
      <div className={styles.sectionTitle}>Evolução de nível</div>
      <div className={styles.chartWrap}>
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={data}>
            <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
            <XAxis dataKey="idx" tick={{ fill: "var(--text-muted)", fontSize: 10 }} tickLine={false} label={{ value: "sessão", position: "insideBottomRight", fill: "var(--text-muted)", fontSize: 10, offset: -4 }} />
            <YAxis tick={{ fill: "var(--text-muted)", fontSize: 10 }} tickLine={false} allowDecimals={false} domain={[1, "dataMax"]} />
            <Tooltip contentStyle={TOOLTIP_STYLE} labelFormatter={(v) => `Sessão ${v}`} />
            <Line type="monotone" dataKey="nível" stroke="var(--accent)" strokeWidth={2} dot={false} />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}

function TopModes({ days }) {
  const stats = useMemo(() => usageStats(days === 9999 ? 365 : days), [days]);
  const max = stats[0]?.count || 1;
  const top = stats.slice(0, 8);

  if (!top.length) return (
    <div className={styles.section}>
      <div className={styles.sectionTitle}>Modos mais usados</div>
      <div className={styles.empty}>Nenhum modo usado ainda.</div>
    </div>
  );

  return (
    <div className={styles.section}>
      <div className={styles.sectionTitle}>Modos mais usados</div>
      {top.map(({ modeId, count }) => {
        const mode = MODES.find((m) => m.id === modeId);
        const label = mode ? `${mode.emoji} ${mode.name}` : modeId;
        return (
          <div key={modeId} className={styles.modeBar}>
            <div className={styles.modeBarLabel} title={label}>{label}</div>
            <div className={styles.modeBarTrack}>
              <div className={styles.modeBarFill} style={{ width: `${(count / max) * 100}%` }} />
            </div>
            <div className={styles.modeBarCount}>{count}</div>
          </div>
        );
      })}
    </div>
  );
}

function EstadosSection({ days }) {
  const { freq, best } = useMemo(() => {
    const cutoff = daysAgo(days).toISOString().slice(0, 10);
    const log = getCheckinLog().filter((e) => e.date >= cutoff);
    const feedback = getSessionFeedback().filter((e) => e.date >= cutoff);

    const freq = {};
    for (const e of log) {
      freq[e.estadoId] = (freq[e.estadoId] || 0) + 1;
    }

    // best = estado com mais feedbacks positivos
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

function Achievements() {
  const all = useMemo(() => getAllWithStatus(), []);
  const unlocked = all.filter((a) => a.unlocked).length;

  return (
    <div className={styles.section}>
      <div className={styles.sectionTitle}>Conquistas — {unlocked}/{all.length} desbloqueadas</div>
      <div className={styles.achGrid}>
        {all.map((a) => (
          <div key={a.id} className={`${styles.achCard} ${a.unlocked ? "" : styles.locked}`}>
            <span className={styles.achEmoji}>{a.emoji}</span>
            <div className={styles.achName}>{a.name}</div>
            <div className={styles.achDesc}>{a.desc}</div>
          </div>
        ))}
      </div>
    </div>
  );
}

function AvgTime({ history, days }) {
  const { avg, total } = useMemo(() => {
    const cutoff = daysAgo(days).toISOString().slice(0, 10);
    const filtered = history.filter((e) => toIso(e.date) >= cutoff);
    const allTimings = filtered.flatMap((e) => e.timings || []);
    const used = allTimings.filter((t) => t.used > 0).map((t) => t.used);
    if (!used.length) return { avg: null, total: 0 };
    const avgMs = used.reduce((s, v) => s + v, 0) / used.length;
    return { avg: Math.round(avgMs / 60), total: used.length };
  }, [history, days]);

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

// ── Main ──────────────────────────────────────────────────────────────────────

export default function DashboardPage() {
  const [periodIdx, setPeriodIdx] = useState(1); // 30d default
  const days = PERIOD_OPTS[periodIdx].days;

  const history = useMemo(() => {
    const all = getHistory();
    if (days >= 9999) return all;
    const cutoff = daysAgo(days).toISOString().slice(0, 10);
    return all.filter((e) => toIso(e.date) >= cutoff);
  }, [days]);

  const streak = getStreak();

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
      <ActivityHeatmap history={history} days={days} />
      <SessionsBarChart history={history} days={days} />
      <LevelLineChart history={history} days={days} />
      <TopModes days={days} />
      <EstadosSection days={days} />
      <Achievements />
      <AvgTime history={history} days={days} />
    </div>
  );
}
