import { useState, useMemo, useEffect, useCallback } from "react";
import { MODES, CATEGORY_BY_ID, CATEGORY_ORDER } from "../data/modes";
import { getCustomModes } from "../lib/customModes";
import { getUsageLogs } from "../lib/sessionUsageLog";
import { todayISO, todayPtBR } from "../lib/dateUtils";
import styles from "./ModePicker.module.css";

interface ModeConfig {
  id: string;
  emoji: string;
  name: string;
  tagline: string;
  color: string;
  colorBg: string;
  session?: string;
  preset?: Record<string, unknown>;
  isCustom?: boolean;
  category?: string;
  type?: string;
  context?: string[];
  [key: string]: unknown;
}

/** Rótulo legível do tipo de execução do modo */
const TYPE_LABEL: Record<string, string> = {
  durante: "Durante o foco",
  entre: "Entre tarefas",
};

/** Cor sutil por categoria (usada nos chips) */
const CATEGORY_COLOR: Record<string, string> = {
  "Música": "#c084fc",
  "Ciclos": "#f472b6",
  "Foco": "#4ecca3",
  "Memória": "#60a5fa",
  "Ritual": "#fbbf24",
  "Mobile": "#38bdf8",
  "Personalizados": "#9ca3af",
  "Outros": "#9ca3af",
};

/** Categoria de um modo (usa category explícita ou o mapa por id) */
function modeCategory(m: ModeConfig): string {
  return m.category || (CATEGORY_BY_ID as Record<string, string>)[m.id] || "Outros";
}

/** Uso de um modo no dia de hoje */
interface TodayUsage {
  count: number;
  lastHour: number;
}

/** Lê os logs de hoje e agrega por modo (contagem + última hora). */
function computeTodayUsage(): Map<string, TodayUsage> {
  const today = todayISO();
  const map = new Map<string, TodayUsage>();
  for (const log of getUsageLogs()) {
    if (log.date !== today) continue;
    const prev = map.get(log.modeId);
    const hour = typeof log.hour === "number" ? log.hour : 0;
    if (!prev) map.set(log.modeId, { count: 1, lastHour: hour });
    else map.set(log.modeId, { count: prev.count + 1, lastHour: Math.max(prev.lastHour, hour) });
  }
  return map;
}

interface ModePickerProps {
  onSelect: (mode: ModeConfig) => void;
  onClose: () => void;
  /** IDs de modos já selecionados (não desabilita, mas pode indicar visualmente) */
  selectedIds?: string[];
  /** IDs de modos já usados hoje (fallback; o picker também calcula sozinho) */
  usedTodayIds?: string[];
}

const ALL_CATEGORIES = ["Todos", ...CATEGORY_ORDER.filter((c) => c !== "Personalizados"), "Personalizados"];

export default function ModePicker({ onSelect, onClose, selectedIds = [], usedTodayIds = [] }: ModePickerProps): JSX.Element {
  const [search, setSearch] = useState<string>("");
  const [category, setCategory] = useState<string>("Todos");
  const [hideUsedToday, setHideUsedToday] = useState<boolean>(false);

  // Fonte da verdade do "feito hoje": calculada internamente e revalidada
  // quando a janela recebe foco (corrige a virada de meia-noite com o app aberto).
  const [todayUsage, setTodayUsage] = useState<Map<string, TodayUsage>>(() => computeTodayUsage());
  const refreshUsage = useCallback(() => setTodayUsage(computeTodayUsage()), []);
  useEffect(() => {
    window.addEventListener("focus", refreshUsage);
    document.addEventListener("visibilitychange", refreshUsage);
    return () => {
      window.removeEventListener("focus", refreshUsage);
      document.removeEventListener("visibilitychange", refreshUsage);
    };
  }, [refreshUsage]);

  const allModes = useMemo<ModeConfig[]>(() => {
    const custom = getCustomModes().map((m: ModeConfig) => ({ ...m, isCustom: true, category: "Personalizados" }));
    return [...(MODES as ModeConfig[]), ...custom];
  }, []);

  // Set unificado de IDs feitos hoje (interno + prop de fallback)
  const usedSet = useMemo<Set<string>>(
    () => new Set<string>([...todayUsage.keys(), ...usedTodayIds]),
    [todayUsage, usedTodayIds]
  );

  const filtered = useMemo<ModeConfig[]>(() => {
    let list = allModes;

    if (category !== "Todos") {
      list = list.filter((m) => modeCategory(m) === category);
    }

    if (hideUsedToday) {
      list = list.filter((m) => !usedSet.has(m.id));
    }

    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter(
        (m) =>
          m.name.toLowerCase().includes(q) ||
          m.tagline?.toLowerCase().includes(q) ||
          m.id.toLowerCase().includes(q)
      );
    }

    // Modos ainda não feitos hoje primeiro; os já feitos vão para o fim.
    return [...list].sort((a, b) => Number(usedSet.has(a.id)) - Number(usedSet.has(b.id)));
  }, [allModes, category, search, hideUsedToday, usedSet]);

  // Resumo textual do que já foi feito hoje (com contagem e hora da última vez).
  const usedTodaySummary = useMemo<string[]>(() => {
    return allModes
      .filter((m) => todayUsage.has(m.id))
      .map((m) => {
        const u = todayUsage.get(m.id)!;
        const times = u.count > 1 ? ` ×${u.count}` : "";
        return `${m.name}${times} (${u.lastHour}h)`;
      });
  }, [allModes, todayUsage]);

  return (
    <div className={styles.overlay}>
      {/* Header */}
      <div className={styles.header}>
        <button className={styles.backBtn} onClick={onClose} aria-label="Voltar">
          ←
        </button>
        <span className={styles.headerTitle}>Escolher modo</span>
      </div>

      {/* Resumo do que já foi feito hoje */}
      <div className={styles.todaySummary} role="status" aria-live="polite">
        {usedTodaySummary.length > 0 ? (
          <>
            <strong>
              Hoje ({todayPtBR()}) você já realizou {usedTodaySummary.length}{" "}
              {usedTodaySummary.length === 1 ? "modo" : "modos"}:
            </strong>{" "}
            {usedTodaySummary.join(", ")}
          </>
        ) : (
          <span className={styles.todaySummaryEmpty}>
            Nenhum modo realizado hoje ainda — comece por um 👇
          </span>
        )}
      </div>

      {/* Search */}
      <div className={styles.searchWrap}>
        <input
          type="text"
          className={styles.searchInput}
          placeholder="Buscar modo..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          autoFocus
        />
      </div>

      {/* Categories */}
      <div className={styles.categories}>
        {ALL_CATEGORIES.map((cat) => (
          <button
            key={cat}
            className={`${styles.catBtn} ${category === cat ? styles.catBtnActive : ""}`}
            onClick={() => setCategory(cat)}
          >
            {cat}
          </button>
        ))}
      </div>

      {/* Filtro rápido: esconder o que já foi feito hoje */}
      <div className={styles.filterRow}>
        <button
          className={`${styles.toggleBtn} ${hideUsedToday ? styles.toggleBtnActive : ""}`}
          onClick={() => setHideUsedToday((v) => !v)}
          aria-pressed={hideUsedToday}
        >
          {hideUsedToday ? "☑" : "☐"} Só não feitos hoje
        </button>
      </div>

      {/* Mode list */}
      <div className={styles.list}>
        {filtered.length > 0 && (
          <button
            className={styles.randomBtn}
            onClick={() => {
              const notUsedToday = filtered.filter((m) => !usedSet.has(m.id));
              // Prefere modos ainda não usados hoje; se todos já foram, usa a lista completa
              const pool = notUsedToday.length > 0 ? notUsedToday : filtered;
              const random = pool[Math.floor(Math.random() * pool.length)];
              onSelect(random);
            }}
          >
            <span className={styles.randomBtnIcon}>🎲</span>
            <span className={styles.randomBtnText}>Selecionar modo aleatório</span>
          </button>
        )}
        {filtered.length === 0 && (
          <p className={styles.empty}>
            {hideUsedToday
              ? "Você já fez todos os modos deste filtro hoje 🎉"
              : "Nenhum modo encontrado."}
          </p>
        )}
        {filtered.map((mode) => {
          const isSelected = selectedIds.includes(mode.id);
          const usage = todayUsage.get(mode.id);
          const isUsedToday = usedSet.has(mode.id);
          const cat = modeCategory(mode);
          const catColor = CATEGORY_COLOR[cat] || CATEGORY_COLOR["Outros"];
          const contextTags = (mode.context || []).slice(0, 2);
          return (
            <button
              key={mode.id}
              className={`${styles.modeCard} ${isUsedToday ? styles.modeCardUsed : ""}`}
              onClick={() => onSelect(mode)}
              style={{ opacity: isSelected ? 0.6 : undefined }}
            >
              <span
                className={styles.modeEmoji}
                style={{ background: mode.colorBg || "rgba(255,255,255,0.05)" }}
              >
                {mode.emoji}
              </span>
              <span className={styles.modeMeta}>
                <span className={styles.modeName}>
                  {mode.name}
                  {isSelected && " ✓"}
                  {isUsedToday && (
                    <span className={styles.todayBadge}>
                      hoje{usage && usage.count > 1 ? ` ×${usage.count}` : ""}
                    </span>
                  )}
                </span>
                <span className={styles.modeTagline}>{mode.tagline}</span>
                <span className={styles.modeTypes}>
                  <span
                    className={styles.typeBadge}
                    title={`Categoria: ${cat}`}
                    style={{ color: catColor, background: `${catColor}22` }}
                  >
                    {cat}
                  </span>
                  {mode.type && TYPE_LABEL[mode.type] && (
                    <span className={styles.typeBadge} title={`Tipo: ${TYPE_LABEL[mode.type]}`}>
                      {TYPE_LABEL[mode.type]}
                    </span>
                  )}
                  {contextTags.map((c) => (
                    <span key={c} className={styles.typeBadge}>
                      {c}
                    </span>
                  ))}
                </span>
              </span>
              <span className={styles.modeArrow}>›</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
