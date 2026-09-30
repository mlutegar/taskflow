import { useState, useMemo, useRef, useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { getHistory, clearSessionHistory, getPendingCount, retrySessionsNow } from "../../lib/dailyFocusHistory";
import { getUsageLogs, clearUsageLog } from "../../lib/sessionUsageLog";
import { getCheckinLog, clearCheckinLog } from "../../lib/checkinLog";
import { MODES } from "../../data/modes";
import { api } from "../../lib/apiClient";
import { mergeLocal } from "../../lib/mergeLocal";
import { useToast } from "../shared/Toast";
import ModalOverlay from "../shared/ModalOverlay";
import styles from "./HistoryPage.module.css";
import EmptyState from "../shared/EmptyState";
import { formatPtBR, parsePtBR } from "../../lib/dateUtils";

// ── Apagar histórico: tipos e helpers de escopo ───────────────────────────────

interface ClearScope {
  modeId?: string;   // undefined = todos os modos
  days?: number;     // undefined = todo o período
}

function isoCutoff(days: number): string {
  const d = new Date();
  d.setDate(d.getDate() - days);
  return [d.getFullYear(), String(d.getMonth() + 1).padStart(2, "0"), String(d.getDate()).padStart(2, "0")].join("-");
}

function toIsoDate(d: string): string {
  if (/^\d{4}-\d{2}-\d{2}/.test(d)) return d.slice(0, 10);
  const m = d.match(/^(\d{2})\/(\d{2})\/(\d{4})/);
  return m ? `${m[3]}-${m[2]}-${m[1]}` : d;
}

/** Um registro (com modeId/date) cai no escopo de exclusão? */
function entryInScope(e: { modeId?: string; date?: string }, scope: ClearScope): boolean {
  const matchesMode = !scope.modeId || e.modeId === scope.modeId;
  const matchesDays = !scope.days || (e.date ? toIsoDate(e.date) >= isoCutoff(scope.days) : true);
  return matchesMode && matchesDays;
}

function scopeToQuery(scope: ClearScope): string {
  const p = new URLSearchParams();
  if (scope.modeId) p.set("modeId", scope.modeId);
  if (scope.days) p.set("days", String(scope.days));
  const s = p.toString();
  return s ? `?${s}` : "";
}

// ── helpers ──────────────────────────────────────────────────────────────────

function getModeLabel(modeId: string): string {
  const m = MODES.find((m) => m.id === modeId);
  return m ? `${m.emoji} ${m.name}` : modeId;
}

const formatDate = formatPtBR;

function downloadCSV(filename: string, headers: string[], rows: (string | number | boolean | null | undefined)[][]): void {
  const esc = (v: unknown): string => { const s = v == null ? "" : String(v); return /[,"\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s; };
  const csv = [headers, ...rows].map(r => r.map(esc).join(",")).join("\n");
  const b = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const u = URL.createObjectURL(b);
  const a = document.createElement("a");
  a.href = u; a.download = filename; a.click();
  URL.revokeObjectURL(u);
}



// ── Abas ─────────────────────────────────────────────────────────────────────

interface Session {
  date: string;
  level?: number | string;
  tasks?: string[];
  rushMode?: boolean;
  tabMode?: boolean;
  completedAt?: string;
  cycleCount?: number;
  clientId?: string;
  synced?: boolean;
  _local?: boolean;
}

interface SessionsTabProps {
  sessions: Session[];
  onClear: () => void;
  pendingCount: number;
  onRetry: () => void;
}

function SessionsTab({ sessions, onClear, pendingCount, onRetry }: SessionsTabProps): JSX.Element {
  function handleExport(): void {
    const headers = ["data", "nivel", "tarefas", "rush"];
    const rows = sessions.map(s => [
      s.date,
      s.level,
      (s.tasks || []).join("; "),
      s.rushMode ? "sim" : "nao",
    ]);
    downloadCSV("sessoes.csv", headers, rows);
  }

  if (!sessions.length) return <EmptyState title="Nenhum registro de sessões ainda." />;
  return (
    <>
      {pendingCount > 0 && (
        <div
          style={{
            display: "flex", alignItems: "center", justifyContent: "space-between",
            gap: 8, marginBottom: 8, padding: "8px 12px",
            border: "1px solid rgba(255,255,255,0.12)", borderRadius: 8,
            background: "rgba(124,92,255,0.10)", fontSize: 13,
          }}
        >
          <span>🔄 {pendingCount} {pendingCount === 1 ? "sessão aguardando" : "sessões aguardando"} sincronização.</span>
          <button className={styles.exportBtn} onClick={onRetry}>Tentar agora</button>
        </div>
      )}
      <div style={{ display: "flex", justifyContent: "flex-end", gap: 8, marginBottom: 8 }}>
        <button className={styles.exportBtn} onClick={handleExport}>⬇ CSV</button>
        <button className={styles.dangerBtn} onClick={onClear}>🗑 Apagar histórico</button>
      </div>
      <div className={styles.list}>
        {sessions.map((s, i) => (
          <div key={i} className={styles.card}>
            <div className={styles.cardHeader}>
              <span className={styles.cardDate}>
                {formatDate(s.date)}
                {(s._local || s.synced === false) && (
                  <span
                    title="Salvo localmente — sincronizará em breve"
                    style={{ marginLeft: 6, fontSize: 11, opacity: 0.6 }}
                  >
                    🔄
                  </span>
                )}
              </span>
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
              {s.cycleCount != null && s.cycleCount > 0 && <span className={styles.tagMuted}>{s.cycleCount} ciclo{s.cycleCount !== 1 ? "s" : ""}</span>}
            </div>
          </div>
        ))}
      </div>
    </>
  );
}

interface UsageLog {
  modeId: string;
  date: string;
  hour?: number;
  worked?: boolean | null;
  focusedMinutes?: number;
  idleMinutes?: number;
  feeling?: string[];
  comboWith?: string | null;
  sessionDurationMinutes?: number | null;
  efficiencyPct?: number | null;
  tasksCompleted?: number | null;
  note?: string | null;
  _local?: boolean;
}

const PERIOD_OPTIONS: { label: string; days: number | null }[] = [
  { label: "7 dias",  days: 7  },
  { label: "30 dias", days: 30 },
  { label: "90 dias", days: 90 },
  { label: "Tudo",    days: null },
];

interface UsageSummary {
  total: number;
  tasks: number;
  focusedMin: number;
  avgEff: number | null;
}

interface UsageLogsTabProps {
  logs: UsageLog[];
  period: number | null;
  onPeriodChange: (d: number | null) => void;
  summary: UsageSummary;
  onClear: () => void;
}

function UsageLogsTab({ logs, period, onPeriodChange, summary, onClear }: UsageLogsTabProps): JSX.Element {
  function handleExport(): void {
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

  const periodPills = (
    <div className={styles.periodRow}>
      {PERIOD_OPTIONS.map((opt) => (
        <button
          key={String(opt.days)}
          type="button"
          className={`${styles.periodPill} ${period === opt.days ? styles.periodPillActive : ""}`}
          onClick={() => onPeriodChange(opt.days)}
        >
          {opt.label}
        </button>
      ))}
    </div>
  );

  if (!logs.length) return (
    <>
      {periodPills}
      <EmptyState title={period != null ? `Nenhuma sessão nos últimos ${period} dias.` : "Nenhum registro de sessões de uso ainda."} />
    </>
  );

  const sorted = [...logs].sort((a, b) => (a.date < b.date ? 1 : -1));

  const focusedMinLabel = summary.focusedMin >= 60
    ? `${Math.floor(summary.focusedMin / 60)}h${summary.focusedMin % 60 > 0 ? ` ${summary.focusedMin % 60}min` : ""}`
    : `${summary.focusedMin}min`;

  return (
    <>
      {periodPills}

      {/* Resumo do período */}
      {summary.total > 0 && (
        <div className={styles.usageSummary}>
          <div className={styles.usageSummaryItem}>
            <span className={styles.usageSummaryValue}>{summary.total}</span>
            <span className={styles.usageSummaryLabel}>sessões</span>
          </div>
          {summary.tasks > 0 && (
            <div className={styles.usageSummaryItem}>
              <span className={styles.usageSummaryValue}>{summary.tasks}</span>
              <span className={styles.usageSummaryLabel}>tarefas</span>
            </div>
          )}
          {summary.focusedMin > 0 && (
            <div className={styles.usageSummaryItem}>
              <span className={styles.usageSummaryValue}>{focusedMinLabel}</span>
              <span className={styles.usageSummaryLabel}>focado</span>
            </div>
          )}
          {summary.avgEff !== null && (
            <div className={styles.usageSummaryItem}>
              <span
                className={styles.usageSummaryValue}
                style={{ color: summary.avgEff >= 70 ? "#4caf82" : summary.avgEff >= 40 ? "#f5c542" : "#e05c5c" }}
              >
                {summary.avgEff}%
              </span>
              <span className={styles.usageSummaryLabel}>eficiência média</span>
            </div>
          )}
        </div>
      )}

      <div style={{ display: "flex", justifyContent: "flex-end", gap: 8, marginBottom: 8 }}>
        <button className={styles.exportBtn} onClick={handleExport}>⬇ CSV</button>
        <button className={styles.dangerBtn} onClick={onClear}>🗑 Apagar histórico</button>
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
              {l.sessionDurationMinutes != null && l.sessionDurationMinutes > 0 && (
                <span className={styles.tagMuted}>🕐 {l.sessionDurationMinutes}min total</span>
              )}
              {l.focusedMinutes != null && l.focusedMinutes > 0 && <span className={styles.tagMuted}>🎯 {l.focusedMinutes}min focado</span>}
              {l.idleMinutes != null && l.idleMinutes > 0 && <span className={styles.tagMuted}>💤 {l.idleMinutes}min ocioso</span>}
              {l.efficiencyPct != null && (
                <span className={`${styles.efficiencyBadge} ${l.efficiencyPct >= 70 ? styles.efficiencyHigh : l.efficiencyPct >= 40 ? styles.efficiencyMid : styles.efficiencyLow}`}>
                  ⚡ {l.efficiencyPct}% eficiência
                </span>
              )}
              {l.feeling && l.feeling.length > 0 && (
                <span className={styles.tagMuted}>
                  {l.feeling.map((f) => `${f}`).join(", ")}
                </span>
              )}
            </div>
            {l.note && (
              <p className={styles.noteText}>📝 {l.note}</p>
            )}
          </div>
        ))}
      </div>
    </>
  );
}

interface CheckinLog {
  modeId: string;
  date: string;
  hour?: number;
  estadoId?: string;
  _local?: boolean;
}

interface CheckinsTabProps {
  logs: CheckinLog[];
  onClear: () => void;
}

function CheckinsTab({ logs, onClear }: CheckinsTabProps): JSX.Element {
  function handleExport(): void {
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

  if (!logs.length) return <EmptyState title="Nenhum registro de check-ins ainda." />;
  const sorted = [...logs].sort((a, b) => (a.date < b.date ? 1 : -1));
  return (
    <>
      <div style={{ display: "flex", justifyContent: "flex-end", gap: 8, marginBottom: 8 }}>
        <button className={styles.exportBtn} onClick={handleExport}>⬇ CSV</button>
        <button className={styles.dangerBtn} onClick={onClear}>🗑 Apagar histórico</button>
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

// ── Modal: apagar histórico com escopo ───────────────────────────────────────

type TabKey = "sessions" | "usage" | "checkins";

interface ClearDialogProps {
  tabLabel: string;
  supportsMode: boolean;             // Uso/Check-ins têm modeId
  modeGroups: { category: string; ids: string[] }[];
  defaultModeId: string;             // "all" ou um modeId (do filtro atual)
  busy: boolean;
  onConfirm: (scope: ClearScope) => void;
  onClose: () => void;
}

const CLEAR_PERIODS: { label: string; days: number | undefined }[] = [
  { label: "Tudo",    days: undefined },
  { label: "7 dias",  days: 7 },
  { label: "30 dias", days: 30 },
  { label: "90 dias", days: 90 },
];

function ClearHistoryDialog({ tabLabel, supportsMode, modeGroups, defaultModeId, busy, onConfirm, onClose }: ClearDialogProps): JSX.Element {
  const [days, setDays] = useState<number | undefined>(undefined);
  const [modeId, setModeId] = useState<string>(supportsMode ? defaultModeId : "all");

  const scope: ClearScope = {
    ...(supportsMode && modeId !== "all" ? { modeId } : {}),
    ...(days ? { days } : {}),
  };

  const scopeLabel = (() => {
    const parts: string[] = [];
    parts.push(modeId !== "all" && supportsMode ? `modo ${getModeLabel(modeId)}` : "todos os modos");
    parts.push(days ? `últimos ${days} dias` : "todo o período");
    return parts.join(" · ");
  })();

  return (
    <ModalOverlay onClose={onClose}>
      <div className={styles.clearModal} role="document">
        <h2 className={styles.clearTitle}>🗑 Apagar histórico — {tabLabel}</h2>
        <p className={styles.clearSubtitle}>
          Escolha o que apagar. Esta ação remove os registros do dispositivo e do servidor.
        </p>

        <div className={styles.clearField}>
          <label className={styles.clearLabel}>Período</label>
          <div className={styles.periodRow}>
            {CLEAR_PERIODS.map((p) => (
              <button
                key={p.label}
                type="button"
                className={`${styles.periodPill} ${days === p.days ? styles.periodPillActive : ""}`}
                onClick={() => setDays(p.days)}
              >
                {p.label}
              </button>
            ))}
          </div>
        </div>

        {supportsMode && (
          <div className={styles.clearField}>
            <label className={styles.clearLabel} htmlFor="clearModeSelect">Modo</label>
            <select
              id="clearModeSelect"
              className={styles.filterSelect}
              value={modeId}
              onChange={(e) => setModeId(e.target.value)}
            >
              <option value="all">Todos os modos</option>
              {modeGroups.map((g) => (
                <optgroup key={g.category} label={g.category}>
                  {g.ids.map((id) => (
                    <option key={id} value={id}>{getModeLabel(id)}</option>
                  ))}
                </optgroup>
              ))}
            </select>
          </div>
        )}

        <p className={styles.clearScopeHint}>Será apagado: <strong>{scopeLabel}</strong>.</p>

        <div className={styles.clearActions}>
          <button type="button" className={styles.exportBtn} onClick={onClose} disabled={busy}>Cancelar</button>
          <button type="button" className={styles.dangerBtnSolid} onClick={() => onConfirm(scope)} disabled={busy}>
            {busy ? "Apagando…" : "Apagar"}
          </button>
        </div>
      </div>
    </ModalOverlay>
  );
}

// ── Filtro por modo: combobox com busca + multi-seleção + contagem ─────────────

interface ModeGroupWithCount {
  category: string;
  ids: string[];
  count: number;
}

interface ModeFilterComboboxProps {
  groups: ModeGroupWithCount[];
  selected: Set<string>;
  onChange: (next: Set<string>) => void;
  countByMode: Map<string, number>;
  resultCount: number;
}

function ModeFilterCombobox({ groups, selected, onChange, countByMode, resultCount }: ModeFilterComboboxProps): JSX.Element {
  const [open, setOpen] = useState<boolean>(false);
  const [query, setQuery] = useState<string>("");
  const rootRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!open) return;
    function onDocClick(e: MouseEvent): void {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) setOpen(false);
    }
    function onKey(e: KeyboardEvent): void {
      if (e.key === "Escape") { setOpen(false); triggerRef.current?.focus(); }
    }
    document.addEventListener("mousedown", onDocClick);
    document.addEventListener("keydown", onKey);
    inputRef.current?.focus();
    return () => {
      document.removeEventListener("mousedown", onDocClick);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const q = query.trim().toLowerCase();
  const filteredGroups = useMemo<ModeGroupWithCount[]>(() => {
    if (!q) return groups;
    return groups
      .map(g => ({ ...g, ids: g.ids.filter(id => getModeLabel(id).toLowerCase().includes(q)) }))
      .filter(g => g.ids.length > 0);
  }, [groups, q]);

  function toggleMode(id: string): void {
    const next = new Set(selected);
    if (next.has(id)) next.delete(id); else next.add(id);
    onChange(next);
  }

  function toggleCategory(ids: string[]): void {
    const allSel = ids.every(id => selected.has(id));
    const next = new Set(selected);
    if (allSel) ids.forEach(id => next.delete(id));
    else ids.forEach(id => next.add(id));
    onChange(next);
  }

  const summary = selected.size === 0
    ? "Todos os modos"
    : selected.size === 1
      ? getModeLabel([...selected][0])
      : `${selected.size} modos selecionados`;

  return (
    <div className={styles.combo} ref={rootRef}>
      <button
        type="button"
        ref={triggerRef}
        className={styles.comboTrigger}
        aria-haspopup="listbox"
        aria-expanded={open}
        onClick={() => setOpen(o => !o)}
      >
        <span className={styles.comboSummary}>{summary}</span>
        <span className={styles.comboChevron} aria-hidden>▾</span>
      </button>

      {selected.size > 0 && (
        <button
          type="button"
          className={styles.filterClear}
          aria-label="Limpar filtro de modos"
          onClick={() => onChange(new Set())}
        >
          Limpar
        </button>
      )}

      <span className={styles.resultCount} aria-live="polite">
        {resultCount} {resultCount === 1 ? "registro" : "registros"}
      </span>

      {open && (
        <div className={styles.comboPanel}>
          <input
            ref={inputRef}
            type="text"
            className={styles.comboSearch}
            placeholder="Buscar modo…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            aria-label="Buscar modo"
          />
          <div className={styles.comboList} role="listbox" aria-label="Modos" aria-multiselectable="true">
            {filteredGroups.length === 0 && (
              <p className={styles.comboEmpty}>Nenhum modo encontrado.</p>
            )}
            {filteredGroups.map(g => {
              const allSel = g.ids.every(id => selected.has(id));
              return (
                <div key={g.category} className={styles.comboGroup}>
                  <button
                    type="button"
                    className={styles.comboGroupHeader}
                    onClick={() => toggleCategory(g.ids)}
                  >
                    <span>{g.category}</span>
                    <span className={styles.comboGroupToggle}>{allSel ? "Remover todos" : "Selecionar todos"}</span>
                  </button>
                  {g.ids.map(id => {
                    const isSel = selected.has(id);
                    return (
                      <button
                        key={id}
                        type="button"
                        role="option"
                        aria-selected={isSel}
                        className={`${styles.comboOption} ${isSel ? styles.comboOptionActive : ""}`}
                        onClick={() => toggleMode(id)}
                      >
                        <span className={styles.comboCheck} aria-hidden>{isSel ? "☑" : "☐"}</span>
                        <span className={styles.comboLabel}>{getModeLabel(id)}</span>
                        <span className={styles.comboCount}>{countByMode.get(id) ?? 0}</span>
                      </button>
                    );
                  })}
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

// Persistência de filtros do Histórico (localStorage)
const MODE_FILTER_KEY = "history.modeFilter";
const PERIOD_KEY = "history.usagePeriodDays";

function loadSelectedModes(): Set<string> {
  try {
    const raw = localStorage.getItem(MODE_FILTER_KEY);
    if (!raw) return new Set();
    const arr: unknown = JSON.parse(raw);
    return Array.isArray(arr) ? new Set(arr.filter((x): x is string => typeof x === "string")) : new Set();
  } catch { return new Set(); }
}

function loadPeriod(): number | null {
  try {
    const raw = localStorage.getItem(PERIOD_KEY);
    if (raw === null) return 30;
    if (raw === "null") return null;
    const n = Number(raw);
    return Number.isFinite(n) ? n : 30;
  } catch { return 30; }
}

// ── Page ─────────────────────────────────────────────────────────────────────

interface Tab {
  key: TabKey;
  label: string;
}

const TABS: Tab[] = [
  { key: "sessions", label: "📅 Sessões" },
  { key: "usage",    label: "🎯 Uso" },
  { key: "checkins", label: "💭 Check-ins" },
];

const SESSION_LIMIT = 50;

export default function HistoryPage(): JSX.Element {
  const [tab, setTab] = useState<TabKey>("sessions");
  const [selectedModes, setSelectedModes] = useState<Set<string>>(() => loadSelectedModes());
  const [sessionPage, setSessionPage] = useState<number>(1);
  const [usagePeriodDays, setUsagePeriodDays] = useState<number | null>(() => loadPeriod());

  // Persiste filtros entre sessões
  useEffect(() => {
    try { localStorage.setItem(MODE_FILTER_KEY, JSON.stringify([...selectedModes])); } catch { /* ignore */ }
  }, [selectedModes]);
  useEffect(() => {
    try { localStorage.setItem(PERIOD_KEY, usagePeriodDays === null ? "null" : String(usagePeriodDays)); } catch { /* ignore */ }
  }, [usagePeriodDays]);
  const [refreshKey, setRefreshKey] = useState<number>(0);
  const [clearDialogTab, setClearDialogTab] = useState<TabKey | null>(null);
  const [busy, setBusy] = useState<boolean>(false);
  // Janela de "Desfazer": enquanto ativa, esconde os itens no escopo e adia a exclusão real.
  const [pendingClear, setPendingClear] = useState<{ tab: TabKey; scope: ClearScope } | null>(null);
  const pendingTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const queryClient = useQueryClient();
  const { showToast } = useToast();

  const CLEAR_CONFIG: Record<TabKey, { endpoint: string; clearLocal: (s: ClearScope) => void; queryKey: string }> = {
    sessions: { endpoint: "/daily-focus/sessions", clearLocal: (s) => clearSessionHistory({ days: s.days }), queryKey: "sessions" },
    usage:    { endpoint: "/session-usage-logs",   clearLocal: (s) => clearUsageLog(s),                      queryKey: "usage" },
    checkins: { endpoint: "/daily-focus/checkins", clearLocal: (s) => clearCheckinLog(s),                   queryKey: "checkins" },
  };

  // Executa de fato a exclusão (remoto + local) após a janela de Desfazer.
  async function finalizeClear(target: TabKey, scope: ClearScope): Promise<void> {
    const cfg = CLEAR_CONFIG[target];
    setBusy(true);
    try {
      await api.delete(cfg.endpoint + scopeToQuery(scope));
      cfg.clearLocal(scope);
      queryClient.invalidateQueries({ queryKey: ["history", cfg.queryKey] });
      setRefreshKey((k) => k + 1);
      showToast("Histórico apagado.", "success");
    } catch {
      // Falha remota: NÃO limpa o local (evita divergência com o servidor).
      showToast("Erro ao apagar. Nada foi removido — tente novamente.", "error");
      setRefreshKey((k) => k + 1); // reexibe os itens ocultados otimisticamente
    } finally {
      setBusy(false);
      setPendingClear(null);
      pendingTimer.current = null;
    }
  }

  // "Tentar agora": força o reenvio das sessões pendentes e recarrega a lista.
  async function handleRetrySessions(): Promise<void> {
    setBusy(true);
    try {
      await retrySessionsNow();
      await queryClient.invalidateQueries({ queryKey: ["history", "sessions"] });
      setRefreshKey((k) => k + 1);
      const left = getPendingCount();
      showToast(left > 0 ? `${left} ainda pendente(s) — tentaremos de novo.` : "Sessões sincronizadas!", left > 0 ? "error" : "success");
    } finally {
      setBusy(false);
    }
  }

  // Confirmação do modal: inicia a janela de Desfazer (5s) sem apagar ainda.
  function handleConfirmClear(scope: ClearScope): void {
    const target = clearDialogTab;
    if (!target) return;
    setClearDialogTab(null);
    setPendingClear({ tab: target, scope });
    pendingTimer.current = setTimeout(() => { void finalizeClear(target, scope); }, 5000);
    showToast("Histórico apagado.", "success", {
      durationMs: 5000,
      action: {
        label: "Desfazer",
        onClick: () => {
          if (pendingTimer.current) clearTimeout(pendingTimer.current);
          pendingTimer.current = null;
          setPendingClear(null); // reexibe os itens; nada foi removido de fato
        },
      },
    });
  }

  // Oculta otimisticamente os itens no escopo durante a janela de Desfazer.
  function hidePending<T extends { modeId?: string; date?: string }>(list: T[], tab: TabKey): T[] {
    if (!pendingClear || pendingClear.tab !== tab) return list;
    return list.filter((e) => !entryInScope(e, pendingClear.scope));
  }

  // ── React Query: busca remota com cache automático ────────────────────────

  const { data: sessionsData, isLoading: sessionsLoading } = useQuery({
    queryKey: ["history", "sessions", sessionPage],
    queryFn: () => api.get(`/daily-focus/sessions?page=${sessionPage}&limit=${SESSION_LIMIT}`),
    staleTime: 60_000,
    placeholderData: (prev: unknown) => prev, // mantém dados anteriores ao paginar
  });

  const { data: remoteUsageRaw = [] } = useQuery<UsageLog[]>({
    queryKey: ["history", "usage"],
    queryFn:  () => api.get("/session-usage-logs").then((d: unknown) => Array.isArray(d)
      ? (d as any[]).map(r => ({
          modeId: r.mode_id, date: r.date, hour: r.hour,
          worked: r.worked, focusedMinutes: r.focused_minutes,
          idleMinutes: r.idle_minutes, idleReason: r.idle_reason || [],
          feeling: r.feeling || [], comboWith: r.combo_with ?? null,
          sessionDurationMinutes: r.session_duration_minutes ?? null,
          efficiencyPct: r.efficiency_pct ?? null,
          tasksCompleted: r.tasks_completed ?? null,
          note: r.note ?? null,
        }))
      : []),
    staleTime: 60_000,
  });

  const { data: checkinsData } = useQuery<CheckinLog[]>({
    queryKey: ["history", "checkins"],
    queryFn:  () => api.get("/daily-focus/checkins").then((d: any) => {
      const raw = Array.isArray(d) ? d : (Array.isArray(d?.checkins) ? d.checkins : []);
      return raw.map((r: any) => ({ estadoId: r.estado_id, modeId: r.mode_id, date: r.date, hour: r.hour }));
    }),
    staleTime: 60_000,
  });

  const isLoading = sessionsLoading;
  const pagination: { page: number; totalPages: number; total: number } = (sessionsData as any)?.pagination ?? { page: 1, totalPages: 1, total: 0 };

  // Local fallbacks (não sincronizados ainda)
  const localSessions = useMemo(() => getHistory(), [refreshKey]);
  const localUsage    = useMemo(() => getUsageLogs(), [refreshKey]);
  const localCheckins = useMemo(() => getCheckinLog(), [refreshKey]);

  // Mescla remoto + local para não perder entradas ainda não sincronizadas.
  // Itens só locais recebem _local: true para indicação visual na UI.
  const remoteSessions: Session[] | null = (sessionsData as any)?.data ?? null;
  const remoteCheckins: CheckinLog[] | null = checkinsData ?? null;

  const sessions = useMemo<Session[]>(
    () => mergeLocal(
      remoteSessions,
      sessionPage === 1 ? localSessions : [],
      // Dedupe por clientId quando existir; senão por data+hora de conclusão.
      (s: any) => (s.clientId ? `cid:${s.clientId}` : `dk:${s.date}|${s.completedAt}`),
      // Ordena por data real (pt-BR), não por string — evita mês fora de ordem.
      (a: Session, b: Session) => parsePtBR(String(b.date)) - parsePtBR(String(a.date)),
    ),
    [remoteSessions, localSessions, sessionPage]
  );

  // Sessões ainda não sincronizadas (fonte de verdade: outbox no localStorage).
  const pendingSessions = useMemo(() => getPendingCount(), [refreshKey, localSessions]);

  const usageLogs = useMemo<UsageLog[]>(
    () => mergeLocal(remoteUsageRaw.length ? remoteUsageRaw : null, localUsage, (e: UsageLog) => `${e.modeId}|${e.date}|${e.hour ?? ""}`),
    [remoteUsageRaw, localUsage]
  );

  const checkins = useMemo<CheckinLog[]>(
    () => mergeLocal(remoteCheckins, localCheckins, (c: CheckinLog) => `${c.modeId}|${c.date}|${c.hour ?? ""}`),
    [remoteCheckins, localCheckins]
  );

  // Aplica a ocultação otimista da janela de "Desfazer".
  const sessionsShown = hidePending(sessions, "sessions");
  const usageShown    = hidePending(usageLogs, "usage");
  const checkinsShown = hidePending(checkins, "checkins");

  const counts: Record<TabKey, number> = {
    sessions: sessionsShown.length,
    usage: usageShown.length,
    checkins: checkinsShown.length,
  };

  // Mode filter
  const allModeIds = useMemo<string[]>(
    () => [...new Set(usageShown.map(l => l.modeId))].sort(),
    [usageShown]
  );

  // Nº de registros por modo (para ordenar e mostrar contagem)
  const usageCountByMode = useMemo<Map<string, number>>(() => {
    const m = new Map<string, number>();
    for (const l of usageShown) m.set(l.modeId, (m.get(l.modeId) ?? 0) + 1);
    return m;
  }, [usageShown]);

  // Agrupa os modos por categoria, ordenados por uso (mais usados no topo)
  const modeGroups = useMemo<ModeGroupWithCount[]>(() => {
    const byCat = new Map<string, string[]>();
    for (const id of allModeIds) {
      const m = MODES.find(mm => mm.id === id);
      const cat = m?.category ?? "Outros";
      const arr = byCat.get(cat) ?? [];
      arr.push(id);
      byCat.set(cat, arr);
    }
    return [...byCat.entries()]
      .map(([category, ids]) => ({
        category,
        ids: [...ids].sort((a, b) =>
          (usageCountByMode.get(b) ?? 0) - (usageCountByMode.get(a) ?? 0) ||
          getModeLabel(a).localeCompare(getModeLabel(b), "pt-BR")),
        count: ids.reduce((s, id) => s + (usageCountByMode.get(id) ?? 0), 0),
      }))
      .sort((a, b) => b.count - a.count || a.category.localeCompare(b.category, "pt-BR"));
  }, [allModeIds, usageCountByMode]);

  const filteredUsageLogs = useMemo<UsageLog[]>(() => {
    let list = selectedModes.size === 0 ? usageShown : usageShown.filter(l => selectedModes.has(l.modeId));
    if (usagePeriodDays !== null) {
      const cutoff = new Date();
      cutoff.setDate(cutoff.getDate() - usagePeriodDays);
      const cutoffStr = cutoff.toISOString().slice(0, 10);
      list = list.filter(l => l.date >= cutoffStr);
    }
    return list;
  }, [usageShown, selectedModes, usagePeriodDays]);

  const usageSummary: UsageSummary = useMemo(() => {
    const total = filteredUsageLogs.length;
    const tasks = filteredUsageLogs.reduce((s, l) => s + (l.tasksCompleted ?? 0), 0);
    const focusedMin = filteredUsageLogs.reduce((s, l) => s + (l.focusedMinutes ?? 0), 0);
    const withEff = filteredUsageLogs.filter(l => l.efficiencyPct != null);
    const avgEff = withEff.length > 0
      ? Math.round(withEff.reduce((s, l) => s + (l.efficiencyPct ?? 0), 0) / withEff.length)
      : null;
    return { total, tasks, focusedMin, avgEff };
  }, [filteredUsageLogs]);

  const showFilterPills = tab === "usage" && allModeIds.length > 1;

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
          <span className={styles.filterLabel}>Modo</span>
          <ModeFilterCombobox
            groups={modeGroups}
            selected={selectedModes}
            onChange={setSelectedModes}
            countByMode={usageCountByMode}
            resultCount={filteredUsageLogs.length}
          />
        </div>
      )}

      <div className={styles.content}>
        {tab === "sessions" && (
          <>
            <SessionsTab
              sessions={sessionsShown}
              onClear={() => setClearDialogTab("sessions")}
              pendingCount={pendingSessions}
              onRetry={() => { void handleRetrySessions(); }}
            />
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
        {tab === "usage"    && (
          <UsageLogsTab
            logs={filteredUsageLogs}
            period={usagePeriodDays}
            onPeriodChange={setUsagePeriodDays}
            summary={usageSummary}
            onClear={() => setClearDialogTab("usage")}
          />
        )}
        {tab === "checkins" && <CheckinsTab logs={checkinsShown} onClear={() => setClearDialogTab("checkins")} />}
      </div>

      {clearDialogTab && (
        <ClearHistoryDialog
          tabLabel={TABS.find((t) => t.key === clearDialogTab)?.label ?? ""}
          supportsMode={clearDialogTab === "usage" || clearDialogTab === "checkins"}
          modeGroups={modeGroups}
          defaultModeId={clearDialogTab === "usage" && selectedModes.size === 1 ? [...selectedModes][0] : "all"}
          busy={busy}
          onConfirm={handleConfirmClear}
          onClose={() => setClearDialogTab(null)}
        />
      )}
    </div>
  );
}
