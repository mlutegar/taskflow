import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { getHistory } from "../../lib/dailyFocusHistory";
import { getAllLogs } from "../../lib/modeLog";
import { getUsageLogs } from "../../lib/sessionUsageLog";
import { getCheckinLog } from "../../lib/checkinLog";
import { MODES } from "../../data/modes";
import { api } from "../../lib/apiClient";
import { mergeLocal } from "../../lib/mergeLocal";
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
              <span className={l.worked === true ? styles.tagGreen : l.worked === null ? styles.tagYellow : styles.tagRed}>
                {l.worked === true ? "✅ Funcionou" : l.worked === null ? "🤔 Mais ou menos" : "❌ Não funcionou"}
              </span>
              {l.comboWith && (
                <span className={styles.tagBlue}>🔀 com {getModeLabel(l.comboWith)}</span>
              )}
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

const SESSION_LIMIT = 50;

export default function HistoryPage() {
  const [tab, setTab] = useState("sessions");
  const [modeFilter, setModeFilter] = useState("all");
  const [sessionPage, setSessionPage] = useState(1);

  // ── React Query: busca remota com cache automático ────────────────────────

  const { data: sessionsData, isLoading: sessionsLoading } = useQuery({
    queryKey: ["history", "sessions", sessionPage],
    queryFn: () => api.get(`/daily-focus/sessions?page=${sessionPage}&limit=${SESSION_LIMIT}`),
    staleTime: 60_000,
    placeholderData: (prev) => prev, // mantém dados anteriores ao paginar
  });

  const { data: remoteModes = [] } = useQuery({
    queryKey: ["history", "modes"],
    queryFn:  () => api.get("/mode-log").then(d => Array.isArray(d) ? d : []),
    staleTime: 60_000,
  });

  const { data: remoteUsageRaw = [] } = useQuery({
    queryKey: ["history", "usage"],
    queryFn:  () => api.get("/session-usage-logs").then(d => Array.isArray(d)
      ? d.map(r => ({
          modeId: r.mode_id, date: r.date, hour: r.hour,
          worked: r.worked, focusedMinutes: r.focused_minutes,
          idleMinutes: r.idle_minutes, idleReason: r.idle_reason || [],
          feeling: r.feeling || [], comboWith: r.combo_with ?? null,
        }))
      : []),
    staleTime: 60_000,
  });

  const { data: checkinsData } = useQuery({
    queryKey: ["history", "checkins"],
    queryFn:  () => api.get("/daily-focus/checkins").then(d => {
      const raw = Array.isArray(d) ? d : (Array.isArray(d?.checkins) ? d.checkins : []);
      return raw.map(r => ({ estadoId: r.estado_id, modeId: r.mode_id, date: r.date, hour: r.hour }));
    }),
    staleTime: 60_000,
  });

  const isLoading = sessionsLoading;
  const pagination = sessionsData?.pagination ?? { page: 1, totalPages: 1, total: 0 };

  // Local fallbacks (não sincronizados ainda)
  const localSessions = useMemo(() => getHistory(), []);
  const localModes    = useMemo(() => getAllLogs(), []);
  const localUsage    = useMemo(() => getUsageLogs(), []);
  const localCheckins = useMemo(() => getCheckinLog(), []);

  // Mescla remoto + local para não perder entradas ainda não sincronizadas.
  // Itens só locais recebem _local: true para indicação visual na UI.
  const remoteSessions = sessionsData?.data ?? null;
  const remoteCheckins = checkinsData ?? null;

  const sessions = useMemo(
    () => mergeLocal(remoteSessions, sessionPage === 1 ? localSessions : [], s => `${s.date}|${s.completedAt}`),
    [remoteSessions, localSessions, sessionPage]
  );

  const modeLogs = useMemo(
    () => mergeLocal(remoteModes.length ? remoteModes : null, localModes, e => `${e.modeId}|${e.date}|${e.hour ?? ""}`),
    [remoteModes, localModes]
  );

  const usageLogs = useMemo(
    () => mergeLocal(remoteUsageRaw.length ? remoteUsageRaw : null, localUsage, e => `${e.modeId}|${e.date}|${e.hour ?? ""}`),
    [remoteUsageRaw, localUsage]
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
        {tab === "sessions" && (
          <>
            <SessionsTab sessions={sessions} />
            {pagination.totalPages > 1 && (
              <div style={{ display: "flex", justifyContent: "center", alignItems: "center", gap: 12, marginTop: 16 }}>
                <button
                  className={styles.exportBtn}
                  disabled={sessionPage <= 1}
                  onClick={() => setSessionPage((p) => Math.max(1, p - 1))}
                >
                  ← Anterior
                </button>
                <span style={{ fontSize: 12, color: "var(--text-muted)" }}>
                  Página {pagination.page} de {pagination.totalPages}
                  <span style={{ marginLeft: 6, opacity: 0.6 }}>({pagination.total} sessões)</span>
                </span>
                <button
                  className={styles.exportBtn}
                  disabled={sessionPage >= pagination.totalPages}
                  onClick={() => setSessionPage((p) => Math.min(pagination.totalPages, p + 1))}
                >
                  Próxima →
                </button>
              </div>
            )}
          </>
        )}
        {tab === "modes"    && <ModesTab logs={filteredModes} />}
        {tab === "usage"    && <UsageLogsTab logs={filteredUsage} />}
        {tab === "checkins" && <CheckinsTab logs={checkins} />}
      </div>
    </div>
  );
}
