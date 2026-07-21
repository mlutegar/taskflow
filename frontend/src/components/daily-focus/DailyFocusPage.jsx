import { useState, useEffect, useRef, useCallback, useMemo } from "react";
import { tasksApi } from "../../api/tasks";
import { useSessionPersist } from "../../lib/useSessionPersist";
import { getHelper } from "./helpers/index";
import { addSession, getHistory, getMaxLevel, updateMaxLevel, getStreak, getStats, getMaxLevelByMode, updateMaxLevelByMode, getLastDateByLevel, getWeeklyStats } from "../../lib/dailyFocusHistory";
import { tryUnlock, getAllWithStatus } from "../../lib/dailyFocusAchievements";
import { getDayLevel, setDayLevel, getUsedModes, addUsedModes } from "../../lib/dailyFocusDay";
import { usageStats } from "../../lib/modeLog";
import { logCheckinUsage, getCheckinCount } from "../../lib/checkinLog";
import CheckInScreen from "./CheckInScreen";
import styles from "./DailyFocus.module.css";
import { MODES, HELPER_GROUPS } from "../../data/modes";

// ── utils ────────────────────────────────────────────────
function makeTasks(level) {
  return Array.from({ length: level }, (_, i) => ({
    title: "",
    supabaseId: null,
    durationMin: (level - i) * 15,
    done: false,
    helperModeId: null,
  }));
}

function formatTime(secs) {
  const m = Math.floor(Math.abs(secs) / 60);
  const s = Math.abs(secs) % 60;
  return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

function todayStr() {
  return new Date().toLocaleDateString("pt-BR");
}

function nowTimeStr() {
  return new Date().toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
}

// ── Mode helpers ─────────────────────────────────────────
function getModeById(id) {
  if (!id) return null;
  const custom = JSON.parse(localStorage.getItem("customModes") || "[]");
  return [...MODES, ...custom].find((m) => m.id === id) || null;
}

function getGroupsWithCustom(usageMap = {}) {
  const customModes = JSON.parse(localStorage.getItem("customModes") || "[]")
    .filter((m) => m.prerequisite?.trim() && m.whyItWorks?.trim() && m.whenToUse?.trim());
  const sortByUsage = (modes) =>
    [...modes].sort((a, b) => (usageMap[b.id] || 0) - (usageMap[a.id] || 0));
  return [
    ...HELPER_GROUPS.map((g) => ({
      label: g.label,
      modes: sortByUsage(g.ids.map((id) => MODES.find((m) => m.id === id)).filter(Boolean)),
    })),
    ...(customModes.length > 0 ? [{ label: "Personalizados", modes: sortByUsage(customModes) }] : []),
  ];
}

// ── Notifications ────────────────────────────────────────
function requestNotifPermission() {
  if ("Notification" in window && Notification.permission === "default") {
    Notification.requestPermission();
  }
}

function sendNotif(title, body) {
  if ("Notification" in window && Notification.permission === "granted") {
    try { new Notification(title, { body }); } catch {}
  }
}

// ── Sons ─────────────────────────────────────────────────
function playBeep(freq1 = 523, freq2 = 659, freq3 = 784) {
  try {
    const ctx = new (window.AudioContext || window.webkitAudioContext)();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.type = "sine";
    osc.frequency.setValueAtTime(freq1, ctx.currentTime);
    osc.frequency.setValueAtTime(freq2, ctx.currentTime + 0.12);
    osc.frequency.setValueAtTime(freq3, ctx.currentTime + 0.24);
    gain.gain.setValueAtTime(0.25, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.55);
    osc.start(ctx.currentTime);
    osc.stop(ctx.currentTime + 0.55);
  } catch {}
}

function playTimerDoneSound() {
  // Beep descendente — "tempo esgotou"
  playBeep(784, 659, 523);
}

function playNewRecordSound() {
  // Fanfarra ascendente — novo recorde!
  try {
    const ctx = new (window.AudioContext || window.webkitAudioContext)();
    const notes = [523, 659, 784, 1047]; // C5 E5 G5 C6
    notes.forEach((freq, i) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.type = "sine";
      osc.frequency.value = freq;
      const t = ctx.currentTime + i * 0.13;
      gain.gain.setValueAtTime(0, t);
      gain.gain.linearRampToValueAtTime(0.28, t + 0.04);
      gain.gain.exponentialRampToValueAtTime(0.001, t + 0.35);
      osc.start(t);
      osc.stop(t + 0.35);
    });
  } catch {}
}

// ── Temas por etapa ──────────────────────────────────────
const STAGE_THEMES = [
  { emoji: "🔹", name: "Ignição" },
  { emoji: "🟡", name: "Aquecimento" },
  { emoji: "🟠", name: "Ritmo" },
  { emoji: "🔥", name: "Chama" },
  { emoji: "⚡", name: "Turbina" },
  { emoji: "💜", name: "Máxima" },
  { emoji: "👑", name: "Lenda" },
  { emoji: "🚀", name: "Além" },
];

function getStageTheme(level) {
  return STAGE_THEMES[Math.min(level - 1, STAGE_THEMES.length - 1)] || STAGE_THEMES[0];
}

// ── Sub-components ───────────────────────────────────────

function HelperPickerModal({ current, usedModes = [], suggestedModeId = null, onSelect, onClose, onRemove }) {
  const [preview, setPreview] = useState(null);
  const [search, setSearch] = useState("");
  // "forward" = lista→preview (slide da direita), "back" = preview→lista (slide da esquerda)
  const [animDir, setAnimDir] = useState("forward");

  const usageMap = Object.fromEntries(usageStats(30).map(({ modeId, count }) => [modeId, count]));
  const allGroups = getGroupsWithCustom(usageMap);

  // Filtro de busca aplicado sobre todos os grupos
  const groups = search.trim()
    ? [{
        label: "Resultados",
        modes: allGroups.flatMap((g) => g.modes).filter(
          (m) => m.name.toLowerCase().includes(search.toLowerCase()) ||
                 m.tagline.toLowerCase().includes(search.toLowerCase())
        ),
      }]
    : allGroups;

  const openPreview = (m) => {
    setAnimDir("forward");
    setPreview(m);
  };

  const closePreview = () => {
    setAnimDir("back");
    setPreview(null);
  };

  const handlePickItem = (m, isUsed) => {
    if (isUsed) return;
    openPreview(m);
  };

  const previewAnimClass = animDir === "forward"
    ? styles.modePreviewForward
    : styles.modePreviewBack;

  return (
    <div className={styles.modalOverlay} onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className={styles.modal}>
        <div className={styles.modalHeader}>
          <span className={styles.modalTitle}>
            {preview ? `${preview.emoji} ${preview.name}` : "🎯 Escolher Modo de Apoio"}
          </span>
          <button className={styles.modalClose} onClick={onClose}>×</button>
        </div>
        <div className={styles.modalBody}>
          {preview ? (
            <div
              key={preview.id}
              className={`${styles.modePreview} ${previewAnimClass}`}
              style={{ "--preview-color": preview.color || "var(--accent)" }}
            >
              <button className={styles.previewBack} onClick={closePreview}>
                ← Voltar à lista
              </button>
              <p className={styles.previewTagline}>{preview.tagline}</p>
              <div className={styles.previewField}>
                <span className={styles.previewFieldLabel}>✅ Pré-requisito</span>
                <p className={styles.previewFieldText}>{preview.prerequisite}</p>
              </div>
              <div className={styles.previewField}>
                <span className={styles.previewFieldLabel}>🧠 Por que funciona</span>
                <p className={styles.previewFieldText}>{preview.whyItWorks}</p>
              </div>
              <div className={styles.previewField}>
                <span className={styles.previewFieldLabel}>🕐 Quando usar</span>
                <p className={styles.previewFieldText}>{preview.whenToUse}</p>
              </div>
              {current === preview.id ? (
                <div className={styles.previewActiveNote}>
                  ✓ Este modo já está selecionado para esta tarefa
                </div>
              ) : (
                <button
                  className={styles.previewStartBtn}
                  onClick={() => { onSelect(preview.id); onClose(); }}
                >
                  ▶ Iniciar {preview.name}
                </button>
              )}
            </div>
          ) : (
            <div key="list" className={`${styles.pickerList} ${previewAnimClass}`}>
              {/* Busca */}
              <div className={styles.pickerSearch}>
                <input
                  className={styles.pickerSearchInput}
                  type="text"
                  placeholder="🔍 Buscar modo…"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  autoFocus
                />
                {search && (
                  <button className={styles.pickerSearchClear} onClick={() => setSearch("")}>×</button>
                )}
              </div>

              {onRemove && current && (
                <div style={{ padding: "6px 18px 10px", borderBottom: "1px solid var(--border)" }}>
                  <button
                    className={styles.changeHelperBtn}
                    style={{ width: "100%", padding: "8px" }}
                    onClick={() => { onRemove(); onClose(); }}
                  >
                    × Remover modo de apoio desta tarefa
                  </button>
                </div>
              )}

              {groups.map((g) => (
                <div key={g.label} className={styles.pickerGroup}>
                  <div className={styles.pickerGroupLabel}>{g.label}</div>
                  {g.modes.length === 0 && (
                    <div className={styles.pickerEmpty}>Nenhum modo encontrado</div>
                  )}
                  {g.modes.map((m) => {
                    const isUsed = usedModes.includes(m.id);
                    const isActive = current === m.id;
                    const isSuggested = !isUsed && m.id === suggestedModeId;
                    return (
                      <div
                        key={m.id}
                        className={`${styles.pickerItem} ${isActive ? styles.pickerItemActive : ""} ${isUsed ? styles.pickerItemUsed : ""}`}
                        onClick={() => handlePickItem(m, isUsed)}
                      >
                        <span className={styles.pickerEmoji}>{m.emoji}</span>
                        <div className={styles.pickerInfo}>
                          <div className={styles.pickerName}>
                            {m.name}
                            {isSuggested && <span className={styles.pickerRecommended}>✨ recomendado</span>}
                          </div>
                          <div className={styles.pickerTagline}>
                            {isUsed ? "✓ já testado hoje" : m.tagline}
                          </div>
                        </div>
                        {isUsed
                          ? <span className={styles.pickerLock}>🔒</span>
                          : isActive
                            ? <span className={styles.pickerCheck}>✓</span>
                            : <span className={styles.pickerChevron}>›</span>
                        }
                      </div>
                    );
                  })}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function HistoryPanel({ onClose }) {
  const history = getHistory();
  const maxLevel = getMaxLevel();
  const achievements = getAllWithStatus();
  const stats = getStats();

  return (
    <div className={styles.modalOverlay} onClick={(e) => e.target === e.currentTarget && onClose()}>
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
    </div>
  );
}

function AchievementToast({ achievements, onDismiss }) {
  useEffect(() => {
    const t = setTimeout(onDismiss, 4000);
    return () => clearTimeout(t);
  }, []);

  if (!achievements.length) return null;
  return (
    <div className={styles.achievementToast}>
      {achievements.map((a) => (
        <div key={a.id} className={styles.achievementToastItem}>
          <span className={styles.achievementToastEmoji}>{a.emoji}</span>
          <div>
            <div className={styles.achievementToastTitle}>Conquista desbloqueada!</div>
            <div className={styles.achievementToastName}>{a.name} — {a.desc}</div>
          </div>
        </div>
      ))}
    </div>
  );
}

function StepsLadder({ currentLevel, maxLevel, lastDateByLevel = {}, animating = false }) {
  const totalSteps = Math.min(8, Math.max(currentLevel + 2, (maxLevel || 0) + 1, 5));

  return (
    <div className={styles.stepsLadder}>
      {Array.from({ length: totalSteps }, (_, i) => {
        const step = i + 1;
        const isDone = step < currentLevel;
        const isCurrent = step === currentLevel;
        const isRecord = step === maxLevel && maxLevel > 0;
        const theme = getStageTheme(step);
        const tooltip = isDone && lastDateByLevel[step]
          ? `Etapa ${step} · ${theme.name} · ${lastDateByLevel[step]}`
          : isCurrent
          ? `Etapa ${step} · ${theme.name} · em andamento`
          : `Etapa ${step} · ${theme.name}`;

        return (
          <div
            key={step}
            className={[
              styles.ladderStep,
              isDone ? styles.ladderStepDone : "",
              isCurrent ? styles.ladderStepCurrent : "",
              isCurrent && animating ? styles.ladderStepEnter : "",
              isRecord ? styles.ladderStepRecord : "",
            ].filter(Boolean).join(" ")}
            style={{ height: `${28 + step * 10}px` }}
            title={tooltip}
          >
            <span className={styles.ladderStepEmoji}>{theme.emoji}</span>
            <span className={styles.ladderStepNum}>{step}</span>
            {isDone && <span className={styles.ladderStepCheck}>✓</span>}
            {isRecord && !isCurrent && <span className={styles.ladderStepTrophy}>🏆</span>}
          </div>
        );
      })}
    </div>
  );
}

function WeekHeatmap() {
  const weekData = getWeeklyStats();
  const DAY_LABELS = ["D", "S", "T", "Q", "Q", "S", "S"];

  return (
    <div className={styles.weekHeatmap}>
      {weekData.map((day, i) => {
        const intensity = day.maxLevel === 0 ? "empty"
          : day.maxLevel <= 2 ? "low"
          : day.maxLevel <= 4 ? "mid"
          : "high";
        return (
          <div
            key={i}
            className={styles.heatmapDay}
            title={day.count > 0
              ? `${day.dateStr} · ${day.count} sessão(ões) · Etapa máx: ${day.maxLevel}`
              : day.dateStr}
          >
            <div className={`${styles.heatmapDot} ${styles[`heatmapDot_${intensity}`]}`} />
            <span className={styles.heatmapLabel}>{DAY_LABELS[day.dayOfWeek]}</span>
          </div>
        );
      })}
    </div>
  );
}

function ProgressDots({ total, current, done: _done }) {
  return (
    <div className={styles.progressDots}>
      {Array.from({ length: total }, (_, i) => (
        <div
          key={i}
          className={`${styles.progressDot} ${
            i < current ? styles.progressDotDone : i === current ? styles.progressDotActive : ""
          }`}
          title={`Tarefa ${i + 1}`}
        />
      ))}
    </div>
  );
}

function DailyTimer({ totalSeconds, initialRemaining, running, onTick, onComplete }) {
  const [remaining, setRemaining] = useState(initialRemaining ?? totalSeconds);
  const intervalRef = useRef(null);
  const firedRef = useRef(false);

  useEffect(() => {
    if (initialRemaining != null) setRemaining(initialRemaining);
  }, []);

  useEffect(() => {
    if (!running) { clearInterval(intervalRef.current); return; }
    intervalRef.current = setInterval(() => {
      setRemaining((prev) => {
        const next = prev - 1;
        onTick?.(next);
        if (next <= 0) {
          clearInterval(intervalRef.current);
          if (!firedRef.current) { firedRef.current = true; setTimeout(() => onComplete?.(), 50); }
          return 0;
        }
        return next;
      });
    }, 1000);
    return () => clearInterval(intervalRef.current);
  }, [running]);

  const r = 68;
  const circ = 2 * Math.PI * r;
  const progress = Math.max(0, Math.min(1, (totalSeconds - remaining) / totalSeconds));
  const isLow = remaining <= 60 && remaining > 0;
  const isWarning = progress >= 0.8 && !isLow;

  return (
    <div className={styles.ringWrap}>
      <svg className={styles.ring} viewBox="0 0 160 160">
        <circle cx="80" cy="80" r={r} className={styles.ringBg} />
        <circle
          cx="80" cy="80" r={r}
          className={`${styles.ringProgress} ${isLow ? styles.ringProgressDanger : isWarning ? styles.ringProgressWarning : ""}`}
          strokeDasharray={circ}
          strokeDashoffset={circ * (1 - progress)}
        />
      </svg>
      <div className={styles.timeDisplay}>
        <span className={styles.timeText}>{formatTime(remaining)}</span>
        {!running && remaining < totalSeconds && remaining > 0 && (
          <span className={styles.timePaused}>pausado</span>
        )}
        {remaining === 0 && <span className={styles.timePaused} style={{ color: "var(--success)" }}>pronto!</span>}
      </div>
    </div>
  );
}

function TaskSlot({ slot, index, level, onChange, onMoveUp, onMoveDown, canMoveUp, canMoveDown, allModes: _allModes, usedModes = [], suggestedModeId = null }) {
  const [query, setQuery] = useState(slot.title);
  const [results, setResults] = useState([]);
  const [todayTasks, setTodayTasks] = useState([]);
  const debounce = useRef(null);
  const [showHelperPicker, setShowHelperPicker] = useState(false);
  const [editingDuration, setEditingDuration] = useState(false);
  const [durationInput, setDurationInput] = useState(String(slot.durationMin));

  useEffect(() => { setQuery(slot.title); }, [slot.title]);
  useEffect(() => { setDurationInput(String(slot.durationMin)); }, [slot.durationMin]);

  // Carrega tarefas com vencimento hoje ao montar
  useEffect(() => {
    tasksApi.listDueToday().then(setTodayTasks).catch(() => {});
  }, []);

  const search = (val) => {
    setQuery(val);
    clearTimeout(debounce.current);
    if (!val.trim()) { setResults([]); return; }
    debounce.current = setTimeout(async () => {
      try {
        const tasks = await tasksApi.list({ status: "active" });
        setResults(tasks.filter((t) => t.title.toLowerCase().includes(val.toLowerCase())).slice(0, 6));
      } catch { setResults([]); }
    }, 300);
  };

  const select = (task) => {
    onChange({ ...slot, title: task.title, supabaseId: task.id });
    setResults([]);
    setTodayTasks([]);
    setQuery(task.title);
  };

  const clear = () => {
    onChange({ ...slot, title: "", supabaseId: null });
    setQuery("");
    setResults([]);
  };

  const saveDuration = () => {
    const val = parseInt(durationInput, 10);
    if (!isNaN(val) && val >= 1 && val <= 240) {
      onChange({ ...slot, durationMin: val });
    } else {
      setDurationInput(String(slot.durationMin));
    }
    setEditingDuration(false);
  };

  const helperMode = getModeById(slot.helperModeId);
  const showTodaySuggestions = !query.trim() && todayTasks.length > 0;

  return (
    <div className={styles.taskSlot}>
      <div className={styles.slotHeader}>
        <span className={styles.slotLabel}>Tarefa {index + 1}</span>
        <div style={{ display: "flex", gap: 4, alignItems: "center" }}>
          {editingDuration ? (
            <input
              className={styles.durationInput}
              type="number"
              min={1}
              max={240}
              value={durationInput}
              onChange={(e) => setDurationInput(e.target.value)}
              onBlur={saveDuration}
              onKeyDown={(e) => { if (e.key === "Enter") saveDuration(); if (e.key === "Escape") setEditingDuration(false); }}
              autoFocus
            />
          ) : (
            <span className={styles.slotTime} onClick={() => setEditingDuration(true)} title="Clique para editar duração">{slot.durationMin} min ✏️</span>
          )}
          {level > 1 && (
            <>
              <button className={styles.slotMoveBtn} onClick={onMoveUp} disabled={!canMoveUp} title="Subir">↑</button>
              <button className={styles.slotMoveBtn} onClick={onMoveDown} disabled={!canMoveDown} title="Descer">↓</button>
            </>
          )}
        </div>
      </div>

      <input
        className={styles.slotInput}
        placeholder="Digite qualquer nome ou pesquise nas suas tarefas…"
        value={query}
        onChange={(e) => search(e.target.value)}
        onFocus={() => { if (!query.trim() && todayTasks.length) setResults([]); }}
        onBlur={() => {
          if (query.trim() && query !== slot.title) {
            onChange({ ...slot, title: query.trim(), supabaseId: null });
          }
          setTimeout(() => setResults([]), 200);
        }}
      />

      {showTodaySuggestions && results.length === 0 && (
        <div className={styles.slotResults}>
          <div className={styles.slotResultsLabel}>📅 vence hoje</div>
          {todayTasks.map((t) => (
            <div key={t.id} className={styles.slotResultItem} onMouseDown={() => select(t)}>
              <span className={styles.slotResultIcon}>⚡</span>
              {t.title}
            </div>
          ))}
        </div>
      )}

      {results.length > 0 && (
        <div className={styles.slotResults}>
          {results.map((t) => (
            <div key={t.id} className={styles.slotResultItem} onMouseDown={() => select(t)}>
              <span className={styles.slotResultIcon}>↳</span>
              {t.title}
            </div>
          ))}
        </div>
      )}

      <div className={styles.slotFooter}>
        {slot.title && (
          <span className={styles.slotClear} onClick={clear}>× limpar</span>
        )}
        <button
          className={`${styles.slotHelperBtn} ${helperMode ? styles.slotHelperBtnActive : ""}`}
          onClick={() => setShowHelperPicker(true)}
        >
          {helperMode ? `${helperMode.emoji} ${helperMode.name}` : "+ Modo de apoio"}
        </button>
      </div>

      {showHelperPicker && (
        <HelperPickerModal
          current={slot.helperModeId}
          usedModes={usedModes}
          suggestedModeId={suggestedModeId}
          onSelect={(id) => onChange({ ...slot, helperModeId: id })}
          onRemove={() => onChange({ ...slot, helperModeId: null })}
          onClose={() => setShowHelperPicker(false)}
        />
      )}
    </div>
  );
}

// ── Main Page ────────────────────────────────────────────

export default function DailyFocusPage() {
  const { saved, persist, clearSaved } = useSessionPersist("daily_focus");

  const [level, setLevel]                   = useState(saved?.level ?? getDayLevel());
  const [tasks, setTasks]                   = useState(saved?.tasks ?? makeTasks(1));
  const [currentIdx, setCurrentIdx]         = useState(saved?.currentIdx ?? 0);
  const [helperStates, setHelperStates]     = useState(saved?.helperStates ?? {}); // { modeId: state }
  const [timerRemaining, setTimerRemaining] = useState(saved?.timerRemaining ?? null);
  const [timerRunning, setTimerRunning]     = useState(false);
  const [phase, setPhase]                   = useState(saved?.phase ?? "checkin");
  const [timerDone, setTimerDone]           = useState(false);
  const [rushMode, setRushMode]             = useState(saved?.rushMode ?? false);
  const [taskTimings, setTaskTimings]       = useState(saved?.taskTimings ?? []); // [{used, total}]
  const [_taskStartRemaining, setTaskStartRemaining] = useState(null);

  // Modos usados hoje (bloqueados no picker)
  const [usedModes, setUsedModes] = useState(() => getUsedModes());

  // Recorde pessoal e progresso do dia
  const maxLevel = getMaxLevel();
  const dayLevel = getDayLevel();

  // All modes (built-in + custom)
  const ALL_MODES = useMemo(() => {
    const custom = JSON.parse(localStorage.getItem("customModes") || "[]");
    return [...MODES, ...custom];
  }, []);

  // Streak e modo sugerido (calculados uma vez ao montar)
  const streak = getStreak();
  const suggestedModeId = useMemo(() => {
    const stats = usageStats(30);
    const available = stats.filter((s) => !usedModes.includes(s.modeId));
    return available[0]?.modeId ?? null;
  }, [usedModes]);

  // Check-in: modo pré-selecionado pelo estado emocional (persiste na sessão)
  const [checkinModeId, setCheckinModeId] = useState(saved?.checkinModeId ?? null);

  // UI state (not persisted)
  const [showHelperPicker, setShowHelperPicker]   = useState(false);
  const [pickerForTask, setPickerForTask]         = useState(null); // index | null (null = work-phase global)
  const [showHistory, setShowHistory]             = useState(false);
  const [newAchievements, setNewAchievements]     = useState([]);
  const [editingTitle, setEditingTitle]           = useState(false);
  const [editTitle, setEditTitle]                 = useState("");
  const [copiedShare, setCopiedShare]             = useState(false);
  const [pausedSince, setPausedSince]             = useState(null); // timestamp
  const [longPause, setLongPause]                 = useState(false);
  const [newRecord, setNewRecord]                 = useState(false);
  const [_notifRequested, _setNotifRequested]       = useState(false);
  const [ladderAnimating, setLadderAnimating]     = useState(false);

  // Recordes por modo
  const maxLevelTimer = getMaxLevelByMode(false);
  const maxLevelRush  = getMaxLevelByMode(true);
  const lastDateByLevel = getLastDateByLevel();

  // Meta semanal
  const weeklyStats = getWeeklyStats();
  const weeklyCount = weeklyStats.filter((d) => d.count > 0).length;
  const WEEKLY_GOAL = 5;

  // Persist on state changes
  useEffect(() => {
    persist({ level, tasks, currentIdx, helperStates, timerRemaining, phase, rushMode, taskTimings, checkinModeId });
  }, [level, tasks, currentIdx, helperStates, timerRemaining, phase, rushMode, taskTimings, checkinModeId]);

  // Atualiza document.title conforme a fase
  useEffect(() => {
    if (phase === "work") {
      document.title = `⚡ Nível ${level} — TaskFlow`;
    } else if (phase === "celebrate") {
      document.title = `🎉 Nível ${level} completo! — TaskFlow`;
    } else {
      document.title = "TaskFlow";
    }
    return () => { document.title = "TaskFlow"; };
  }, [phase, level]);

  // Space bar → pause/resume
  useEffect(() => {
    const handler = (e) => {
      if (e.target.tagName === "INPUT" || e.target.tagName === "TEXTAREA") return;
      if (e.code === "Space" && phase === "work" && !rushMode && !timerDone) {
        e.preventDefault();
        setTimerRunning((v) => !v);
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [phase, rushMode, timerDone]);

  // Avisa ao fechar aba com sessão em andamento
  useEffect(() => {
    if (phase !== "work") return;
    const handler = (e) => { e.preventDefault(); e.returnValue = ""; };
    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, [phase]);

  // Long pause detection (after 5 min paused)
  useEffect(() => {
    if (!timerRunning && phase === "work" && !rushMode && timerRemaining != null && timerRemaining > 0 && timerRemaining < (tasks[currentIdx]?.durationMin * 60)) {
      setPausedSince(Date.now());
    } else {
      setPausedSince(null);
      setLongPause(false);
    }
  }, [timerRunning]);

  useEffect(() => {
    if (!pausedSince) return;
    const interval = setInterval(() => {
      if (Date.now() - pausedSince > 5 * 60 * 1000) {
        setLongPause(true);
      }
    }, 30000);
    return () => clearInterval(interval);
  }, [pausedSince]);

  const currentTask = tasks[currentIdx] || {};
  const totalSecs = (currentTask.durationMin || 0) * 60;
  const activeHelperModeId = currentTask.helperModeId;
  const helperEntry = getHelper(activeHelperModeId);
  const helperMode = getModeById(activeHelperModeId);
  const currentHelperState = helperStates[activeHelperModeId] || {};

  // ── helpers ──────────────────────────────────────────
  const updateTask = (i, val) =>
    setTasks((prev) => prev.map((t, idx) => (idx === i ? val : t)));

  const moveTask = (i, dir) => {
    setTasks((prev) => {
      const arr = [...prev];
      const target = i + dir;
      if (target < 0 || target >= arr.length) return arr;
      [arr[i], arr[target]] = [arr[target], arr[i]];
      // Preserve durations (they're positional, not per-task)
      return arr.map((t, j) => ({ ...t, durationMin: (arr.length - j) * 15 }));
    });
  };

  const allFilled = tasks.every((t) => t.title.trim());

  const startSession = () => {
    setTimerRemaining(tasks[0].durationMin * 60);
    setTaskStartRemaining(tasks[0].durationMin * 60);
    setCurrentIdx(0);
    setTimerRunning(false);
    setTimerDone(false);
    setTaskTimings([]);
    setPhase("work");
    requestNotifPermission();
  };

  const handleTimerTick = useCallback((remaining) => {
    setTimerRemaining(remaining);
  }, []);

  const handleTimerDone = useCallback(() => {
    setTimerRunning(false);
    setTimerDone(true);
    playTimerDoneSound();
    sendNotif("⏰ Timer encerrado!", `Tarefa: ${tasks[currentIdx]?.title || ""}`);
  }, [tasks, currentIdx]);

  const handleHelperChange = useCallback((newState) => {
    setHelperStates((prev) => {
      const modeId = tasks[currentIdx]?.helperModeId;
      if (!modeId) return prev;
      const resolved = typeof newState === "function" ? newState(prev[modeId] || {}) : newState;
      return { ...prev, [modeId]: resolved };
    });
  }, [tasks, currentIdx]);

  // When switching to a new task, init helper state if needed
  const initHelperIfNeeded = (modeId) => {
    if (!modeId) return;
    setHelperStates((prev) => {
      if (prev[modeId]) return prev;
      const entry = getHelper(modeId);
      return { ...prev, [modeId]: entry?.defaultState ?? {} };
    });
  };

  const handleSelectHelper = (modeId) => {
    if (pickerForTask !== null) {
      // Slot-level picker (select phase or work-phase per-task)
      updateTask(pickerForTask, { ...tasks[pickerForTask], helperModeId: modeId });
      initHelperIfNeeded(modeId);
    } else {
      // Work-phase "add/change for current task"
      updateTask(currentIdx, { ...tasks[currentIdx], helperModeId: modeId });
      initHelperIfNeeded(modeId);
    }
    setPickerForTask(null);
    setShowHelperPicker(false);
  };

  const handleRemoveHelper = () => {
    if (pickerForTask !== null) {
      updateTask(pickerForTask, { ...tasks[pickerForTask], helperModeId: null });
    } else {
      updateTask(currentIdx, { ...tasks[currentIdx], helperModeId: null });
    }
    setPickerForTask(null);
    setShowHelperPicker(false);
  };

  const handleCompleteTask = () => {
    // Record timing feedback
    const usedSecs = totalSecs - (timerRemaining ?? totalSecs);
    const usedMin = Math.max(0, Math.round(usedSecs / 60));
    const isEarly = !rushMode && timerRemaining > 0 && timerRemaining < totalSecs;
    const newTimings = [...taskTimings, { used: usedMin, total: currentTask.durationMin, early: isEarly }];
    setTaskTimings(newTimings);

    const updated = tasks.map((t, i) => (i === currentIdx ? { ...t, done: true } : t));
    setTasks(updated);

    playBeep(); // som de conclusão de tarefa

    const nextIdx = currentIdx + 1;
    if (nextIdx >= tasks.length) {
      // Session complete
      setTimerRunning(false);
      completeSession(updated, newTimings, isEarly);
    } else {
      setCurrentIdx(nextIdx);
      setTimerRemaining(updated[nextIdx].durationMin * 60);
      setTaskStartRemaining(updated[nextIdx].durationMin * 60);
      setTimerRunning(false);
      setTimerDone(false);
      setLongPause(false);
      setPausedSince(null);
      initHelperIfNeeded(updated[nextIdx].helperModeId);
    }
  };

  const completeSession = (completedTasks, timings, hadEarlyCompletion) => {
    const isNewRecord = updateMaxLevel(level);
    updateMaxLevelByMode(level, rushMode);
    setNewRecord(isNewRecord);
    if (isNewRecord) playNewRecordSound();

    // Save history
    addSession({
      date: todayStr(),
      completedAt: nowTimeStr(),
      level,
      tasks: completedTasks.map((t) => t.title),
      timings,
      rushMode,
    });

    // Check achievements
    const toUnlock = [];
    const totalSessions = getHistory().length; // already saved
    if (totalSessions === 1) toUnlock.push("first_session");
    if (totalSessions >= 5) toUnlock.push("five_sessions");
    if (totalSessions >= 10) toUnlock.push("ten_sessions");
    if (level >= 2) toUnlock.push("level_2");
    if (level >= 3) toUnlock.push("level_3");
    if (level >= 5) toUnlock.push("level_5");
    if (rushMode) toUnlock.push("rush_master");
    if (completedTasks.some((t) => t.helperModeId)) toUnlock.push("helper_user");
    if (hadEarlyCompletion || timings.some((t) => t.early)) toUnlock.push("early_bird");

    const newAch = tryUnlock(toUnlock);
    if (newAch.length) setNewAchievements(newAch);

    // Salva nível do dia e modos usados
    setDayLevel(level);
    const modesUsedThisSession = completedTasks
      .map((t) => t.helperModeId)
      .filter(Boolean);
    addUsedModes(modesUsedThisSession);
    setUsedModes(getUsedModes());

    setPhase("celebrate");
  };

  const handleNextLevel = () => {
    const newLevel = level + 1;
    setLevel(newLevel);
    setTasks(makeTasks(newLevel));
    setCurrentIdx(0);
    setTimerRemaining(null);
    setTimerRunning(false);
    setTimerDone(false);
    setTaskTimings([]);
    setRushMode(false);
    setPhase("select");
    setLadderAnimating(true);
    setTimeout(() => setLadderAnimating(false), 500);
  };

  const handleCheckinSelect = (modeId, estadoId) => {
    setCheckinModeId(modeId);
    logCheckinUsage(estadoId, modeId);
    // Pré-aplica na primeira tarefa se ela ainda não tiver modo selecionado
    setTasks((prev) => {
      if (prev[0]?.helperModeId) return prev;
      return prev.map((t, i) => i === 0 ? { ...t, helperModeId: modeId } : t);
    });
    initHelperIfNeeded(modeId);
    // Conquista "Auto-conhecimento": 5 check-ins
    if (getCheckinCount() >= 5) {
      const newAch = tryUnlock(["self_aware"]);
      if (newAch.length) setNewAchievements((prev) => [...prev, ...newAch]);
    }
    setPhase("select");
  };

  const handleReset = () => {
    if (!window.confirm("Resetar tudo? O nível voltará para 1.")) return;
    clearSaved();
    setLevel(1);
    setTasks(makeTasks(1));
    setCurrentIdx(0);
    setHelperStates({});
    setTimerRemaining(null);
    setTimerRunning(false);
    setTimerDone(false);
    setTaskTimings([]);
    setRushMode(false);
    setCheckinModeId(null);
    setPhase("checkin"); // volta para o check-in ao resetar
  };

  const shareSession = async () => {
    const theme = getStageTheme(level);
    const stairWidth = Math.min(level, 8);
    const stairLines = Array.from({ length: stairWidth }, (_, i) => {
      const step = i + 1;
      const t = getStageTheme(step);
      const bar = "█".repeat(step);
      const pad = " ".repeat(stairWidth - step);
      return `${pad}${bar} ${t.emoji}${step}`;
    });
    const recLine = maxLevel > 0 ? `🏆 Recorde pessoal: Etapa ${maxLevel}` : "";
    const lines = [
      `🎯 Daily Focus · Etapa ${level} · ${theme.emoji} ${theme.name} · ${todayStr()}`,
      "",
      ...stairLines,
      "",
      ...tasks.map((t, i) => {
        const timing = taskTimings[i];
        const timeStr = timing ? ` (${timing.used}/${timing.total}min${timing.early ? " ⚡" : ""})` : ` (${t.durationMin}min)`;
        return `${i + 1}. ${t.title}${timeStr}`;
      }),
      ...(newRecord ? ["", "🏆 Novo recorde pessoal!"] : recLine ? ["", recLine] : []),
    ];
    const text = lines.join("\n");
    try {
      await navigator.clipboard.writeText(text);
      setCopiedShare(true);
      setTimeout(() => setCopiedShare(false), 2000);
    } catch {}
  };

  const startEditTitle = () => {
    setEditTitle(currentTask.title);
    setEditingTitle(true);
  };

  const saveEditTitle = () => {
    if (editTitle.trim()) {
      updateTask(currentIdx, { ...currentTask, title: editTitle.trim() });
    }
    setEditingTitle(false);
  };

  // ── Render ───────────────────────────────────────────
  return (
    <div className={styles.page}>
      {/* Header */}
      <div className={styles.header}>
        <div className={styles.headerTitle}>🎯 Daily Focus</div>
        <div className={styles.headerMeta}>
          <span className={styles.headerLevel}>Nível {level}</span>
          {streak >= 2 && <span className={styles.streakBadge}>🔥 {streak}</span>}
        </div>
        <div className={styles.headerActions}>
          <button className={styles.iconBtn} onClick={() => setShowHistory(true)} title="Histórico">📋</button>
          {phase !== "select" && (
            <button className={styles.iconBtn} onClick={() => { setTimerRunning(false); setPhase("select"); }}>← Voltar</button>
          )}
          <button className={styles.iconBtn} onClick={handleReset}>↺</button>
        </div>
      </div>

      {/* Content */}
      <div className={styles.content}>

        {/* ── CHECK-IN PHASE ── */}
        {phase === "checkin" && (
          <CheckInScreen
            allModes={ALL_MODES}
            onSelect={handleCheckinSelect}
            onSkip={() => setPhase("select")}
          />
        )}

        {/* ── SELECT PHASE ── */}
        {phase === "select" && (
          <div>
            {/* Banner do modo sugerido pelo check-in */}
            {checkinModeId && (() => {
              const m = getModeById(checkinModeId);
              return m ? (
                <div style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "10px",
                  padding: "10px 14px",
                  marginBottom: "16px",
                  background: "rgba(124,110,245,0.08)",
                  border: "1px solid rgba(124,110,245,0.3)",
                  borderRadius: "var(--radius-sm)",
                  fontSize: "13px",
                }}>
                  <span style={{ fontSize: "18px" }}>{m.emoji}</span>
                  <span>
                    <span style={{ fontWeight: 700 }}>{m.name}</span>
                    <span style={{ color: "var(--text-muted)", marginLeft: "6px" }}>sugerido para você</span>
                  </span>
                  <button
                    onClick={() => setCheckinModeId(null)}
                    style={{ marginLeft: "auto", background: "none", border: "none", color: "var(--text-muted)", fontSize: "16px", cursor: "pointer", padding: "0 4px", lineHeight: 1 }}
                    title="Remover sugestão"
                  >×</button>
                </div>
              ) : null;
            })()}

            {/* Heatmap semanal */}
            <WeekHeatmap />

            {/* Meta semanal */}
            <div className={styles.weeklyMeta}>
              <span>Esta semana:</span>
              <span className={weeklyCount >= WEEKLY_GOAL ? styles.weeklyGoalReached : styles.weeklyMetaCount}>
                {weeklyCount}/{WEEKLY_GOAL} dias
              </span>
              {weeklyCount >= WEEKLY_GOAL && <span>✅ Meta atingida!</span>}
            </div>

            {/* Badges de recorde e progresso do dia */}
            {(maxLevel > 0 || dayLevel > 1) && (
              <div className={styles.focusMetaRow}>
                {maxLevel > 0 && (
                  <span className={styles.recordBadge}>
                    🏆 Seu recorde: Etapa {maxLevel}
                  </span>
                )}
                {dayLevel > 1 && dayLevel <= level && (
                  <span className={styles.dayProgressBadge}>
                    Hoje: até Etapa {dayLevel}
                  </span>
                )}
              </div>
            )}

            {/* Recordes separados por modo */}
            {(maxLevelTimer > 0 || maxLevelRush > 0) && (
              <div className={styles.typedRecordsRow}>
                {maxLevelTimer > 0 && <span className={styles.typedRecordBadge}>⏱️ Timer: Etapa {maxLevelTimer}</span>}
                {maxLevelRush > 0 && <span className={styles.typedRecordBadge}>🚀 Rush: Etapa {maxLevelRush}</span>}
              </div>
            )}

            {/* Escada de etapas */}
            <StepsLadder currentLevel={level} maxLevel={maxLevel} lastDateByLevel={lastDateByLevel} animating={ladderAnimating} />

            <div className={styles.selectTitleRow}>
              <div className={styles.selectTitle}>
                Nível {level} — {tasks.length} tarefa{tasks.length !== 1 ? "s" : ""}
              </div>
              {level > 1 && (
                <button className={styles.resetLevelBtn} onClick={() => { setLevel(1); setTasks(makeTasks(1)); }} title="Recomeçar do nível 1">
                  ↩ nível 1
                </button>
              )}
            </div>
            <div className={styles.selectSub}>
              {tasks.length === 1
                ? "Qual é a tarefa mais importante do seu dia?"
                : `Escolha as ${tasks.length} tarefas mais importantes do dia.`}
              {" "}Timers: {tasks.map((t) => `${t.durationMin}min`).join(" → ")}.
            </div>

            {/* Rush mode toggle */}
            <div className={styles.rushToggle}>
              <button
                className={`${styles.rushBtn} ${!rushMode ? styles.rushBtnActive : ""}`}
                onClick={() => setRushMode(false)}
              >
                ⏱️ Com timer
              </button>
              <button
                className={`${styles.rushBtn} ${rushMode ? styles.rushBtnActive : ""}`}
                onClick={() => setRushMode(true)}
              >
                🚀 Modo Rush
              </button>
            </div>

            {/* Task slots */}
            <div className={styles.taskSlots}>
              {tasks.map((slot, i) => (
                <TaskSlot
                  key={i}
                  slot={slot}
                  index={i}
                  level={level}
                  onChange={(val) => updateTask(i, val)}
                  onMoveUp={() => moveTask(i, -1)}
                  onMoveDown={() => moveTask(i, 1)}
                  canMoveUp={i > 0}
                  canMoveDown={i < tasks.length - 1}
                  usedModes={usedModes}
                  suggestedModeId={checkinModeId ?? suggestedModeId}
                />
              ))}
            </div>

            <button className={styles.startBtn} disabled={!allFilled} onClick={startSession}>
              {allFilled ? (rushMode ? "🚀 Começar no Modo Rush" : "▶ Começar sessão") : "Preencha todas as tarefas"}
            </button>
          </div>
        )}

        {/* ── WORK PHASE ── */}
        {phase === "work" && (
          <div className={styles.workLayout}>
            {/* Progress dots */}
            {tasks.length > 1 && (
              <ProgressDots total={tasks.length} current={currentIdx} done={currentIdx} />
            )}

            {/* Task card */}
            <div className={styles.taskCard}>
              <div className={styles.taskCardLabel}>
                Tarefa {currentIdx + 1} / {tasks.length}
                {rushMode && <span className={styles.rushBadge}>🚀 Rush</span>}
              </div>
              {editingTitle ? (
                <div className={styles.editTitleWrap}>
                  <input
                    className={styles.editTitleInput}
                    value={editTitle}
                    onChange={(e) => setEditTitle(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && saveEditTitle()}
                    autoFocus
                  />
                  <button className={styles.editTitleSave} onClick={saveEditTitle}>✓</button>
                </div>
              ) : (
                <div className={styles.taskCardTitleRow}>
                  <div className={styles.taskCardTitle}>{currentTask.title}</div>
                  <button className={styles.editTitleBtn} onClick={startEditTitle} title="Editar título">✏️</button>
                </div>
              )}
              {!rushMode && <div className={styles.taskCardTime}>{currentTask.durationMin} min</div>}
            </div>

            {/* Timer (only in timer mode) */}
            {!rushMode && (
              <div className={styles.timerWrap}>
                <DailyTimer
                  key={`${currentIdx}-${totalSecs}`}
                  totalSeconds={totalSecs}
                  initialRemaining={timerRemaining ?? totalSecs}
                  running={timerRunning}
                  onTick={handleTimerTick}
                  onComplete={handleTimerDone}
                />

                {timerDone && (
                  <div className={styles.timerComplete}>
                    ⏰ Tempo esgotado — marque quando terminar!
                  </div>
                )}

                {longPause && !timerDone && (
                  <div className={styles.longPauseBanner}>
                    ☕ Pausado há mais de 5 min — tudo bem, retome quando quiser
                  </div>
                )}

                <div className={styles.timerBtns}>
                  <button
                    className={`${styles.timerBtn} ${styles.timerBtnPrimary}`}
                    onClick={() => { setTimerRunning((v) => !v); setLongPause(false); }}
                    disabled={timerDone}
                  >
                    {timerRunning ? "⏸ Pausar" : "▶ Iniciar"}
                  </button>
                </div>
                {!timerRunning && !timerDone && timerRemaining === totalSecs && (
                  <div className={styles.timerHint}>Pressione Espaço para iniciar</div>
                )}
              </div>
            )}

            {/* Helper panel */}
            {helperEntry && helperMode && (
              <div className={styles.helperPanel}>
                <div className={styles.helperPanelHeader}>
                  <span className={styles.helperPanelEmoji}>{helperMode.emoji}</span>
                  <span className={styles.helperPanelName}>{helperMode.name}</span>
                  <span className={styles.helperPanelBadge}>modo de apoio</span>
                </div>
                <helperEntry.Component
                  state={currentHelperState}
                  onChange={handleHelperChange}
                  modeConfig={helperMode}
                />
              </div>
            )}

            {/* Banner: quase batendo recorde */}
            {level > maxLevel && maxLevel > 0 && currentIdx === tasks.length - 1 && (
              <div className={styles.almostRecordBanner}>
                🏆 Última tarefa! Complete para bater seu recorde de Etapa {maxLevel}!
              </div>
            )}
            {level > maxLevel && maxLevel > 0 && currentIdx < tasks.length - 1 && (
              <div className={styles.almostRecordBanner}>
                ⚡ Sessão de recorde em andamento — Etapa {level}!
              </div>
            )}

            {/* Actions */}
            <div className={styles.workActions}>
              <button className={styles.doneBtn} onClick={handleCompleteTask}>
                ✅ Concluí esta tarefa
              </button>
              <button
                className={styles.changeHelperBtn}
                onClick={() => { setPickerForTask(null); setShowHelperPicker(true); }}
              >
                {helperMode ? `🔄 Trocar modo de apoio (${helperMode.name})` : "🎯 Adicionar modo de apoio"}
              </button>
            </div>
          </div>
        )}

        {/* ── CELEBRATE PHASE ── */}
        {phase === "celebrate" && (
          <div className={styles.celebration}>
            <div className={styles.celebrationEmoji}>{newRecord ? "🏆" : "🎉"}</div>
            <div className={styles.celebrationTitle}>
              {newRecord ? `🏆 Novo recorde! Etapa ${level}` : `Nível ${level} completo!`}
            </div>
            {newRecord && (
              <div className={styles.newRecordHighlight}>
                Você superou seu recorde anterior!
              </div>
            )}
            <div className={styles.celebrationSub}>
              {tasks.length} tarefa{tasks.length !== 1 ? "s" : ""} feita{tasks.length !== 1 ? "s" : ""}.
              O Nível {level + 1} tem {level + 1} tarefa{level + 1 !== 1 ? "s" : ""}.
            </div>

            {/* Task breakdown */}
            <div className={styles.celebrationTasks}>
              {tasks.map((t, i) => {
                const timing = taskTimings[i];
                return (
                  <div key={i} className={styles.celebrationTask}>
                    <span className={styles.celebrationTaskCheck}>✓</span>
                    <span className={styles.celebrationTaskTitle}>{t.title}</span>
                    {timing && (
                      <span className={`${styles.celebrationTaskTime} ${timing.early ? styles.success : ""}`}>
                        {timing.early ? "⚡ " : ""}{timing.used}/{timing.total}min
                      </span>
                    )}
                  </div>
                );
              })}
            </div>

            <div className={styles.celebrationBtns}>
              <button className={styles.celebrationNextBtn} onClick={handleNextLevel}>
                🚀 Ir para o Nível {level + 1}
              </button>
              <button className={styles.shareBtn} onClick={shareSession}>
                {copiedShare ? "✓ Copiado!" : "📋 Compartilhar"}
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Modals */}
      {showHelperPicker && (
        <HelperPickerModal
          current={activeHelperModeId}
          usedModes={usedModes}
          suggestedModeId={suggestedModeId}
          onSelect={handleSelectHelper}
          onRemove={activeHelperModeId ? handleRemoveHelper : null}
          onClose={() => { setShowHelperPicker(false); setPickerForTask(null); }}
        />
      )}

      {showHistory && <HistoryPanel onClose={() => setShowHistory(false)} />}

      {newAchievements.length > 0 && (
        <AchievementToast
          achievements={newAchievements}
          onDismiss={() => setNewAchievements([])}
        />
      )}
    </div>
  );
}
