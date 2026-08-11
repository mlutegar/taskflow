import { useState, useMemo, useEffect } from "react";
import { getHistory } from "../../lib/dailyFocusHistory";
import { getAllLogs } from "../../lib/modeLog";
import { getUsageLogs } from "../../lib/sessionUsageLog";
import { getCheckinLog } from "../../lib/checkinLog";
import { MODES } from "../../data/modes";
import { api } from "../../lib/apiClient";
import { mergeLocal } from "../../lib/mergeLocal";
import { cacheGet, cacheSet } from "../../lib/historyCache";
import styles from "./HistoryPage.module.css";

// ── helpers ──────────────────────────────────────────────────────────────────

function getModeLabel(modeId) {
  const m = MODES.find((m) => m.id === modeId);
  return m ? `${m.emoji} ${m.name}` : modeId;
}

function formatDate(isoOrPtBR) {
  if (!isoOrPtBR) return "—";
  // Detecta formato DD/MM/YYYY
  if (isoOrPtBR.includes("/")) {
    const [d, m, y] = isoOrPtBR.split("/");
    return new Date(+y, +m - 1, +d).toLocaleDateString("pt-BR", {
      weekday: "short", day: "2-digit", month: "short", year: "numeric",
    });
  }
  const [y, m, d] = isoOrPtBR.split("-");
  return new Date(+y, +m - 1, +d).toLocaleDateString("pt-BR", {
    weekday: "short", day: "2-digit", month: "short", year: "numeric",
  });
}

function downloadCSV(filename, headers, rows) {
  const esc = v => { const s = v == null ? "" : String(v); return /[,"\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s; };
  const csv = [headers, ...rows].map(r => r.map(esc).join(",")).join("\n");
  const b = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const u = URL.createObjectURL(b);
  const a = document.createElement("a");
  a.href = u; a.download = filename; a.click();
  URL.revokeObjectURL(u);
}

function EmptyState({ label }) {
  return (
    <div className={styles.empty}>
      <span className={styles.emptyIcon}>📭</span>
      <span>Nenhum registro de {label} ainda.</span>
    </div>
  );
}

// ── Abas ─────────────────────────────────────────────────────────────────────

function SessionsTab({ sessions }) {
  function handleExport() {
    const headers = ["data", "nivel", "tarefas", "rush"];
    const rows = sessions.map(s => [
      s.date,
      s.level,
      (s.tasks || []).join("; "),
      s.rushMode ? "sim" : "nao",
    ]);
    downloadCSV("sessoes.csv", headers, rows);
  }

  if (!sessions.length) return <EmptyState label="sessões" />;
  return (
    <>
      <div style={{ display: "flex", justifyContent: "flex-end", marginBottom: 8 }}>
        <button className={styles.exportBtn} onClick={handleExport}>⬇ CSV</button>
      </div>
      <div className={styles.list}>
        {sessions.map((s, i) => (
          <div key={i} className={styles.card}>
            <div className={styles.cardHeader}>
              <span className={styles.cardDate}>{formatDate(s.date)}</span>
              <span className={styles.badge}>Nível {s.level}</span>
            </div>
            {s.tasks && s.tasks.length > 0 && (
              <ul className={styles.taskList}>
                {s.tasks.map((t, j) => <li key={j}>{t}</li>)}
              </ul>
            )}
            <div className={styles.cardMeta}>
              {s.rushMode && <span className={styles.tag}>⚡ Rush</span>}
              {s.tabMode && <span className={styles.tag}>🌐 Tab Mode</span>}
              {s.completedAt && <span className={styles.tagMuted}>concluído às {s.completedAt}</span>}
              {s.cycleCount > 0 && <span className={styles.tagMuted}>{s.cycleCount} ciclo{s.cycleCount !== 1 ? "s" : ""}</span>}
            </div>
          </div>
        ))}
      </div>
    </>
  );
}

function ModesTab({ logs }) {
  function handleExport() {
    const headers = ["data", "modo"];
    const rows = logs.map(l => [l.date, getModeLabel(l.modeId)]);
    downloadCSV("modos.csv", headers, rows);
  }

  if (!logs.length) return <EmptyState label="modos" />;
  return (
    <>
      <div style={{ display: "flex", justifyContent: "flex-end", marginBottom: 8 }}>
        <button className={styles.exportBtn} onClick={handleExport}>⬇ CSV</button>
      </div>
      <div className={styles.list}>
        {logs.map((l, i) => (
          <div key={i} className={styles.cardRow}>
            <span className={styles.cardMode}>
              {getModeLabel(l.modeId)}
              {l._local && (
                <span
                  title="Salvo localmente — sincronizará em breve"
                  style={{ marginLeft: 6, fontSize: 11, opacity: 0.6 }}
                >
                  🔄
                </span>
              )}
            </span>
            <span className={styles.cardDate}>
              {formatDate(l.date)}{l.hour !== undefined ? ` · ${l.hour}h` : ""}
            </span>
          </div>
        ))}
      </div>
    </>
  );
}

function UsageLogsTab({ logs }) {
  function handleExport() {
    const headers = ["data", "hora", "modo", "funcionou", "foco_min", "idle_min", "sentimento"];
    const sorted = [...logs].sort((a, b) => (a.date < b.date ? 1 : -1));
    const rows = sorted.map(l => [
      l.date,
      l.hour ?? "",
      getModeLabel(l.modeId),
      l.worked ? "sim" : "nao",
      l.focusedMinutes ?? "",
      l.idleMinutes ?? "",
      (l.feeling || []).join("; "),
    ]);
    downloadCSV("uso.csv", headers, rows);
  }

  if (!logs.length) return <EmptyState label="sessões de uso" />;
  const sorted = [...logs].sort((a, b) => (a.date < b.date ? 1 : -1));
  return (
    <>
      <div style={{ display: "flex", justifyContent: "flex-end", marginBottom: 8 }}>
        <button className={styles.exportBtn} onClick={handleExport}>⬇ CSV</button>
      </div>
      <div className={styles.list}>
        {sorted.map((l, i) => (
          <div key={i} className={styles.card}>
            <div className={styles.cardHeader}>
              <span className={styles.cardMode}>
                {getModeLabel(l.modeId)}
                {l._local && (
                  <span
                    title="Salvo localmente — sincronizará em breve"
                    style={{ marginLeft: 6, fontSize: 11, opacity: 0.6 }}
                  >
                    🔄
                  </span>
                )}
              </span>
              <span className={styles.cardDate}>{formatDate(l.date)}{l.hour !== undefined ? ` · ${l.hour}h` : ""}</span>
            </div>
            <div className={styles.cardMeta}>
              <span className={l.worked ? styles.tagGreen : styles.tagRed}>
                {l.worked ? "✅ Funcionou" : "❌ Não funcionou"}
              </span>
              {l.focusedMinutes > 0 && <span className={styles.tagMuted}>🎯 {l.focusedMinutes}min focado</span>}
              {l.idleMinutes > 0 && <span className={styles.tagMuted}>💤 {l.idleMinutes}min ocioso</span>}
              {l.feeling && l.feeling.length > 0 && (
                <span className={styles.tagMuted}>
                  {l.feeling.map((f) => `${f}`).join(", ")}
                </span>
              )}
            </div>
          </div>
        ))}
      </div>
    </>
  );
}

function CheckinsTab({ logs }) {
  function handleExport() {
    const headers = ["data", "hora", "estado", "modo"];
    const sorted = [...logs].sort((a, b) => (a.date < b.date ? 1 : -1));
    const rows = sorted.map(l => [
      l.date,
      l.hour ?? "",
      l.estadoId ?? "",
      getModeLabel(l.modeId),
    ]);
    downloadCSV("checkins.csv", headers, rows);
  }

  if (!logs.length) return <EmptyState label="check-ins" />;
  const sorted = [...logs].sort((a, b) => (a.date < b.date ? 1 : -1));
  return (
    <>
      <div style={{ display: "flex", justifyContent: "flex-end", marginBottom: 8 }}>
        <button className={styles.exportBtn} onClick={handleExport}>⬇ CSV</button>
      </div>
      <div className={styles.list}>
        {sorted.map((l, i) => (
          <div key={i} className={styles.cardRow}>
            <div className={styles.cardRowLeft}>
              <span className={styles.cardMode}>{getModeLabel(l.modeId)}</span>
              <span className={styles.tagMuted}>estado: {l.estadoId}</span>
            </div>
            <span className={styles.cardDate}>{formatDate(l.date)}{l.hour !== undefined ? ` · ${l.hour}h` : ""}</span>
          </div>
        ))}
      </div>
    </>
  );
}

// ── Page ─────────────────────────────────────────────────────────────────────

const TABS = [
  { key: "sessions", label: "📅 Sessões" },
  { key: "modes",    label: "🎯 Modos" },
  { key: "usage",    label: "📈 Uso" },
  { key: "checkins", label: "💭 Check-ins" },
];

export default function HistoryPage() {
  const [tab, setTab] = useState("sessions");
  const [modeFilter, setModeFilter] = useState("all");

  // Remote state (null = loading)
  const [remoteSessions, setRemoteSessions] = useState(null);
  const [remoteModes, setRemoteModes] = useState(null);
  const [remoteUsage, setRemoteUsage] = useState(null);
  const [remoteCheckins, setRemoteCheckins] = useState(null);

  useEffect(() => {
    // Fetch sessions (com cache de 1 min)
    const cachedSessions = cacheGet("sessions");
    if (cachedSessions) {
      setRemoteSessions(cachedSessions);
    } else {
      api.get("/daily-focus/sessions").then(data => {
        const parsed = Array.isArray(data)
          ? data.map(r => ({
              date:        r.date,
              level:       r.level,
              tasks:       r.tasks,
              completedAt: r.completed_at,
              rushMode:    r.rush_mode,
              tabMode:     r.tab_mode,
              cycleCount:  r.cycle_count,
            }))
          : [];
        cacheSet("sessions", parsed);
        setRemoteSessions(parsed);
      }).catch(() => setRemoteSessions([]));
    }

    // Fetch mode logs (com cache)
    const cachedModes = cacheGet("modes");
    if (cachedModes) {
      setRemoteModes(cachedModes);
    } else {
      api.get("/mode-log").then(data => {
        const parsed = Array.isArray(data) ? data : [];
        cacheSet("modes", parsed);
        setRemoteModes(parsed);
      }).catch(() => setRemoteModes([]));
    }

    // Fetch usage logs (com cache)
    const cachedUsage = cacheGet("usage");
    if (cachedUsage) {
      setRemoteUsage(cachedUsage);
    } else {
      api.get("/session-usage-logs").then(data => {
        const parsed = Array.isArray(data)
          ? data.map(r => ({
              modeId:         r.mode_id,
              date:           r.date,
              hour:           r.hour,
              worked:         r.worked,
              focusedMinutes: r.focused_minutes,
              idleMinutes:    r.idle_minutes,
              idleReason:     r.idle_reason || [],
              feeling:        r.feeling || [],
            }))
          : [];
        cacheSet("usage", parsed);
        setRemoteUsage(parsed);
      }).catch(() => setRemoteUsage([]));
    }

    // Fetch checkins (com cache)
    const cachedCheckins = cacheGet("checkins");
    if (cachedCheckins) {
      setRemoteCheckins(cachedCheckins);
    } else {
      api.get("/daily-focus/checkins").then(data => {
        const raw = Array.isArray(data) ? data : (Array.isArray(data?.checkins) ? data.checkins : []);
        const parsed = raw.map(r => ({
          estadoId: r.estado_id,
          modeId:   r.mode_id,
          date:     r.date,
          hour:     r.hour,
        }));
        cacheSet("checkins", parsed);
        setRemoteCheckins(parsed);
      }).catch(() => setRemoteCheckins([]));
    }
  }, []);

  const isLoading = remoteSessions === null || remoteModes === null || remoteUsage === null || remoteCheckins === null;

  // Local fallbacks
  const localSessions = useMemo(() => getHistory(), []);
  const localModes    = useMemo(() => getAllLogs(), []);
  const localUsage    = useMemo(() => getUsageLogs(), []);
  const localCheckins = useMemo(() => getCheckinLog(), []);

  // Mescla remoto + local para não perder entradas ainda não sincronizadas.
  // Itens só locais recebem _local: true para indicação visual na UI.
  const sessions = useMemo(
    () => mergeLocal(remoteSessions, localSessions, s => `${s.date}|${s.completedAt}`),
    [remoteSessions, localSessions]
  );

  const modeLogs = useMemo(
    () => mergeLocal(remoteModes, localModes, e => `${e.modeId}|${e.date}|${e.hour ?? ""}`),
    [remoteModes, localModes]
  );

  const usageLogs = useMemo(
    () => mergeLocal(remoteUsage, localUsage, e => `${e.modeId}|${e.date}|${e.hour ?? ""}`),
    [remoteUsage, localUsage]
  );

  const checkins = useMemo(
    () => mergeLocal(remoteCheckins, localCheckins, c => `${c.modeId}|${c.date}|${c.hour ?? ""}`),
    [remoteCheckins, localCheckins]
  );

  const counts = {
    sessions: sessions.length,
    modes: modeLogs.length,
    usage: usageLogs.length,
    checkins: checkins.length,
  };

  // Mode filter
  const allModeIds = useMemo(
    () => [...new Set([...modeLogs.map(l => l.modeId), ...usageLogs.map(l => l.modeId)])].sort(),
    [modeLogs, usageLogs]
  );

  const filteredModes = modeFilter === "all" ? modeLogs : modeLogs.filter(l => l.modeId === modeFilter);
  const filteredUsage = modeFilter === "all" ? usageLogs : usageLogs.filter(l => l.modeId === modeFilter);

  const showFilterPills = (tab === "modes" || tab === "usage") && allModeIds.length > 1;

  return (
    <div className={styles.page}>
      <h1 className={styles.pageTitle}>Histórico</h1>
      <p className={styles.pageSubtitle}>Todos os seus registros, em ordem cronológica.</p>

      <div className={styles.tabs}>
        {TABS.map((t) => (
          <button
            key={t.key}
            className={`${styles.tabBtn} ${tab === t.key ? styles.tabBtnActive : ""}`}
            onClick={() => setTab(t.key)}
          >
            {t.label}
            {counts[t.key] > 0 && (
              <span className={styles.tabCount}>{counts[t.key]}</span>
            )}
          </button>
        ))}
      </div>

      {isLoading && (
        <p style={{ fontSize: 12, color: "var(--text-muted)", marginBottom: 12 }}>
          🔄 buscando histórico completo…
        </p>
      )}

      {showFilterPills && (
        <div className={styles.filterRow}>
          <button
            className={`${styles.filterPill} ${modeFilter === "all" ? styles.filterPillActive : ""}`}
            onClick={() => setModeFilter("all")}
          >
            Todos
          </button>
          {allModeIds.map(id => (
            <button
              key={id}
              className={`${styles.filterPill} ${modeFilter === id ? styles.filterPillActive : ""}`}
              onClick={() => setModeFilter(id)}
            >
              {getModeLabel(id)}
            </button>
          ))}
        </div>
      )}

      <div className={styles.content}>
        {tab === "sessions" && <SessionsTab sessions={sessions} />}
        {tab === "modes"    && <ModesTab logs={filteredModes} />}
        {tab === "usage"    && <UsageLogsTab logs={filteredUsage} />}
        {tab === "checkins" && <CheckinsTab logs={checkins} />}
      </div>
    </div>
  );
}
