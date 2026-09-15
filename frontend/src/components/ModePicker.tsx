import { useState, useMemo, useEffect, useCallback, useRef, Fragment } from "react";
import type { MouseEvent } from "react";
import { MODES, CATEGORY_BY_ID, CATEGORY_ORDER } from "../data/modes";
import { getCustomModes, getHiddenModeIds, toggleHiddenMode, setHiddenModeIds } from "../lib/customModes";
import { getUsageLogs } from "../lib/sessionUsageLog";
import { usageStats } from "../lib/modeLog";
import { todayISO, todayPtBR } from "../lib/dateUtils";
import { storageGet, storageSet } from "../lib/storage";
import { pruneOrder, getFavorites, toggleFavorite as toggleFavoriteStore } from "../lib/modeUtils";
import LongPressButton from "./modes/LongPressButton";
import ModeDetailSheet from "./modes/ModeDetailSheet";
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
  /** Subgrupo visual dentro da categoria (ex.: "Ouvir", "Cantar", "Playlist"). */
  group?: string;
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

/** Modos de ordenação da lista */
type SortMode = "default" | "alpha" | "most" | "least" | "random";
const SORT_CYCLE: SortMode[] = ["default", "alpha", "most", "least", "random"];
const SORT_LABEL: Record<SortMode, string> = {
  default: "Padrão",
  alpha: "A–Z",
  most: "Mais usados",
  least: "Menos usados",
  random: "Aleatória",
};
const SORT_KEY = "modePicker.sortMode";
const RANDOM_ORDER_KEY = "modePicker.randomOrder";
const K_CATEGORY = "modePicker.category";
const K_SEARCH = "modePicker.search";
const K_HIDE = "modePicker.hideUsedToday";
const K_COMPACT = "modePicker.compact";

/** Embaralha uma lista de ids (Fisher–Yates). */
function shuffleIds(ids: string[]): string[] {
  const arr = [...ids];
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

export default function ModePicker({ onSelect, onClose, selectedIds = [], usedTodayIds = [] }: ModePickerProps): JSX.Element {
  const [search, setSearch] = useState<string>(() => storageGet<string>(K_SEARCH, ""));
  const [category, setCategory] = useState<string>(() => storageGet<string>(K_CATEGORY, "Todos"));
  const [hideUsedToday, setHideUsedToday] = useState<boolean>(() => storageGet<boolean>(K_HIDE, false));
  const [compact, setCompact] = useState<boolean>(() => storageGet<boolean>(K_COMPACT, false));
  const [hiddenIds, setHiddenIds] = useState<Set<string>>(() => getHiddenModeIds());
  const [showHidden, setShowHidden] = useState<boolean>(false);
  const [undoBar, setUndoBar] = useState<{ msg: string; undo: () => void } | null>(null);
  const undoTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [sortMode, setSortMode] = useState<SortMode>(() => {
    const saved = storageGet<SortMode>(SORT_KEY, "default");
    return SORT_CYCLE.includes(saved) ? saved : "default";
  });
  const [randomOrder, setRandomOrder] = useState<string[]>(() => storageGet<string[]>(RANDOM_ORDER_KEY, []));
  const [favorites, setFavorites] = useState<string[]>(() => getFavorites());
  const [detailMode, setDetailMode] = useState<ModeConfig | null>(null);
  const [showDetailHint, setShowDetailHint] = useState<boolean>(() => !storageGet<boolean>("modePicker.detailHintSeen", false));

  // Ao abrir os detalhes pela 1ª vez, marca a dica como vista.
  useEffect(() => {
    if (detailMode && showDetailHint) {
      setShowDetailHint(false);
      storageSet("modePicker.detailHintSeen", true);
    }
  }, [detailMode, showDetailHint]);

  // Persiste filtros simples sempre que mudam.
  useEffect(() => { storageSet(K_SEARCH, search); }, [search]);
  useEffect(() => { storageSet(K_CATEGORY, category); }, [category]);
  useEffect(() => { storageSet(K_HIDE, hideUsedToday); }, [hideUsedToday]);
  useEffect(() => { storageSet(K_COMPACT, compact); }, [compact]);

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

  // Contagem de uso nos últimos 7 dias (mini-stat + ordenação por uso).
  const usage7d = useMemo<Map<string, number>>(
    () => new Map(usageStats(7).map((s) => [s.modeId, s.count])),
    []
  );

  // Poda ids órfãos da ordem aleatória salva (modos removidos/renomeados).
  useEffect(() => {
    if (randomOrder.length === 0) return;
    const valid = new Set(allModes.map((m) => m.id));
    const pruned = pruneOrder(randomOrder, valid);
    if (pruned.length !== randomOrder.length) {
      setRandomOrder(pruned);
      storageSet(RANDOM_ORDER_KEY, pruned);
    }
  }, [allModes, randomOrder]);

  const favSet = useMemo(() => new Set(favorites), [favorites]);
  const toggleFav = useCallback((id: string) => setFavorites(toggleFavoriteStore(id)), []);

  // Sincroniza favoritos/ocultos entre abas e entre componentes (evento in-app).
  useEffect(() => {
    const refresh = () => {
      setHiddenIds(getHiddenModeIds());
      setFavorites(getFavorites());
    };
    const onStorage = (e: StorageEvent) => {
      if (e.key === "taskflow.hiddenModeIds" || e.key === "taskflow.modePicker.favorites") refresh();
    };
    window.addEventListener("storage", onStorage);
    window.addEventListener("hiddenModesUpdated", refresh);
    return () => {
      window.removeEventListener("storage", onStorage);
      window.removeEventListener("hiddenModesUpdated", refresh);
    };
  }, []);

  // Barra "Desfazer" temporária (5s) para ações de ocultar/reexibir.
  const flashUndo = useCallback((msg: string, undo: () => void) => {
    if (undoTimer.current) clearTimeout(undoTimer.current);
    setUndoBar({ msg, undo });
    undoTimer.current = setTimeout(() => setUndoBar(null), 5000);
  }, []);
  useEffect(() => () => { if (undoTimer.current) clearTimeout(undoTimer.current); }, []);

  // Garante uma ordem aleatória salva ao entrar no modo "Aleatória".
  const ensureRandomOrder = useCallback((): string[] => {
    const next = shuffleIds(allModes.map((m) => m.id));
    setRandomOrder(next);
    storageSet(RANDOM_ORDER_KEY, next);
    return next;
  }, [allModes]);

  // Cicla Padrão → A–Z → Aleatória (persistindo a escolha).
  const cycleSort = useCallback(() => {
    const idx = SORT_CYCLE.indexOf(sortMode);
    const next = SORT_CYCLE[(idx + 1) % SORT_CYCLE.length];
    setSortMode(next);
    storageSet(SORT_KEY, next);
    if (next === "random" && randomOrder.length === 0) ensureRandomOrder();
  }, [sortMode, randomOrder.length, ensureRandomOrder]);

  // Set unificado de IDs feitos hoje (interno + prop de fallback)
  const usedSet = useMemo<Set<string>>(
    () => new Set<string>([...todayUsage.keys(), ...usedTodayIds]),
    [todayUsage, usedTodayIds]
  );

  const hasActiveFilters =
    search.trim() !== "" || category !== "Todos" || hideUsedToday || sortMode !== "default";

  const clearFilters = useCallback(() => {
    setSearch("");
    setCategory("Todos");
    setHideUsedToday(false);
    setSortMode("default");
    storageSet(SORT_KEY, "default");
  }, []);

  const filtered = useMemo<ModeConfig[]>(() => {
    let list = allModes;

    if (category !== "Todos") {
      list = list.filter((m) => modeCategory(m) === category);
    }

    if (!showHidden) {
      list = list.filter((m) => !hiddenIds.has(m.id));
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

    const favRank = (m: ModeConfig) => (favSet.has(m.id) ? 0 : 1);
    const usedLast = (a: ModeConfig, b: ModeConfig) =>
      Number(usedSet.has(a.id)) - Number(usedSet.has(b.id));
    const count = (m: ModeConfig) => usage7d.get(m.id) ?? 0;
    const catalogIndex = new Map(allModes.map((m, i) => [m.id, i]));
    const randomRank = new Map(randomOrder.map((id, i) => [id, i]));

    const byMode = (a: ModeConfig, b: ModeConfig): number => {
      switch (sortMode) {
        case "alpha":
          return usedLast(a, b) || a.name.localeCompare(b.name, "pt-BR");
        case "most":
          return count(b) - count(a) || a.name.localeCompare(b.name, "pt-BR");
        case "least":
          return count(a) - count(b) || a.name.localeCompare(b.name, "pt-BR");
        case "random":
          // Ordem sorteada salva; ids ausentes vão ao fim. Não reordena por "feito hoje".
          return (randomRank.get(a.id) ?? Infinity) - (randomRank.get(b.id) ?? Infinity);
        default:
          return usedLast(a, b) || (catalogIndex.get(a.id)! - catalogIndex.get(b.id)!);
      }
    };

    // Favoritos sempre no topo; depois o critério de ordenação escolhido.
    return [...list].sort((a, b) => favRank(a) - favRank(b) || byMode(a, b));
  }, [allModes, category, search, hideUsedToday, hiddenIds, showHidden, usedSet, sortMode, randomOrder, favSet, usage7d]);

  // Alterna a ocultação de um modo (sem disparar a seleção do card), com undo.
  const handleToggleHidden = useCallback((e: MouseEvent, id: string, name: string) => {
    e.stopPropagation();
    const wasHidden = getHiddenModeIds().has(id);
    setHiddenIds(new Set(toggleHiddenMode(id)));
    flashUndo(wasHidden ? `“${name}” reexibido` : `“${name}” oculto`, () => {
      setHiddenIds(new Set(toggleHiddenMode(id)));
      setUndoBar(null);
    });
  }, [flashUndo]);

  // Oculta/reexibe todos os modos da categoria selecionada, com undo (snapshot).
  const bulkCategory = useCallback((hide: boolean) => {
    if (category === "Todos") return;
    const catIds = allModes.filter((m) => modeCategory(m) === category).map((m) => m.id);
    const snapshot = getHiddenModeIds();
    const next = new Set(snapshot);
    catIds.forEach((id) => (hide ? next.add(id) : next.delete(id)));
    setHiddenModeIds(next);
    setHiddenIds(new Set(next));
    flashUndo(hide ? `Categoria “${category}” oculta` : `Categoria “${category}” reexibida`, () => {
      setHiddenModeIds(snapshot);
      setHiddenIds(new Set(snapshot));
      setUndoBar(null);
    });
  }, [allModes, category, flashUndo]);

  // Para o botão de gerenciar categoria: os modos da categoria estão todos ocultos?
  const catAllHidden = useMemo(() => {
    if (category === "Todos") return false;
    const catIds = allModes.filter((m) => modeCategory(m) === category).map((m) => m.id);
    return catIds.length > 0 && catIds.every((id) => hiddenIds.has(id));
  }, [allModes, category, hiddenIds]);

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
        <button
          className={styles.densityBtn}
          onClick={() => setCompact((v) => !v)}
          aria-pressed={compact}
          title={compact ? "Ver cards confortáveis" : "Ver cards compactos"}
        >
          {compact ? "▤" : "▦"}
        </button>
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

      {/* Barra de ferramentas: filtro + ordenação (rolável no mobile) */}
      <div className={styles.toolbar}>
        <button
          className={`${styles.toolBtn} ${hideUsedToday ? styles.toolBtnActive : ""}`}
          onClick={() => setHideUsedToday((v) => !v)}
          aria-pressed={hideUsedToday}
        >
          {hideUsedToday ? "☑" : "☐"} Só não feitos hoje
        </button>
        <button
          className={`${styles.toolBtn} ${sortMode !== "default" ? styles.toolBtnActive : ""}`}
          onClick={cycleSort}
          title={`Ordenação atual: ${SORT_LABEL[sortMode]}. Toque para mudar.`}
        >
          ↕ Ordem: {SORT_LABEL[sortMode]}
        </button>
        <button
          className={`${styles.toolBtn} ${showHidden ? styles.toolBtnActive : ""}`}
          onClick={() => setShowHidden((v) => !v)}
          aria-pressed={showHidden}
          title="Modo gerenciar: mostra os modos ocultos e habilita ocultar/reexibir em cada card"
        >
          ⚙ Gerenciar{hiddenIds.size > 0 ? ` (${hiddenIds.size})` : ""}
        </button>
        {showHidden && category !== "Todos" && (
          <button
            className={styles.toolBtn}
            onClick={() => bulkCategory(!catAllHidden)}
            title={catAllHidden ? `Reexibir todos os modos de ${category}` : `Ocultar todos os modos de ${category}`}
          >
            {catAllHidden ? "↩" : "🚫"} {catAllHidden ? "Reexibir" : "Ocultar"} “{category}”
          </button>
        )}
        {sortMode === "random" && (
          <button
            className={styles.toolBtn}
            onClick={ensureRandomOrder}
            title="Gerar uma nova ordem aleatória"
          >
            🎲 Embaralhar
          </button>
        )}
        {hasActiveFilters && (
          <button className={styles.toolBtn} onClick={clearFilters} title="Limpar busca, categoria e ordenação">
            ✕ Limpar
          </button>
        )}
      </div>

      {/* Contador de resultados */}
      <div className={styles.resultRow} role="status" aria-live="polite">
        {filtered.length} {filtered.length === 1 ? "modo" : "modos"}
        {sortMode === "random" && <span className={styles.resultHint}> • ordem embaralhada</span>}
      </div>

      {/* Dica de descoberta (primeira vez) */}
      {showDetailHint && (
        <div className={styles.detailHint}>
          <span>💡 Segure um card (ou clique com o botão direito) para ver os detalhes do modo.</span>
          <button
            className={styles.detailHintClose}
            onClick={() => { setShowDetailHint(false); storageSet("modePicker.detailHintSeen", true); }}
            aria-label="Entendi, fechar dica"
          >
            ×
          </button>
        </div>
      )}

      {/* Mode list */}
      <div className={`${styles.list} ${compact ? styles.listCompact : ""}`}>
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
        {filtered.map((mode, idx) => {
          const isSelected = selectedIds.includes(mode.id);
          const usage = todayUsage.get(mode.id);
          const isUsedToday = usedSet.has(mode.id);
          const cat = modeCategory(mode);
          const catColor = CATEGORY_COLOR[cat] || CATEGORY_COLOR["Outros"];
          const isHidden = hiddenIds.has(mode.id);
          const isFav = favSet.has(mode.id);
          const weekCount = usage7d.get(mode.id) ?? 0;
          // Divisor de subgrupo: só na ordenação padrão, dentro de uma categoria e sem busca ativa
          // (nas demais ordenações os cards se reordenam e o agrupamento perderia sentido).
          const showGroups = sortMode === "default" && category !== "Todos" && !search.trim();
          const groupChanged = Boolean(showGroups && mode.group && mode.group !== filtered[idx - 1]?.group);
          return (
            <Fragment key={mode.id}>
            {groupChanged && (
              <div className={styles.groupDivider} role="presentation">{mode.group}</div>
            )}
            <div
              className={`${styles.modeCardWrap} ${isHidden ? styles.modeCardHidden : ""}`}
            >
            <LongPressButton
              className={`${styles.modeCard} ${isUsedToday ? styles.modeCardUsed : ""}`}
              onClick={() => onSelect(mode)}
              onLongPress={() => setDetailMode(mode)}
              title="Segure ou clique com o botão direito para ver detalhes"
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
                    role="button"
                    tabIndex={-1}
                    onClick={(e) => { e.stopPropagation(); setCategory(cat); }}
                    title={`Filtrar por ${cat}`}
                    style={{ color: catColor, background: `${catColor}22`, cursor: "pointer" }}
                  >
                    {cat}
                  </span>
                  {mode.type && TYPE_LABEL[mode.type] && (
                    <span className={styles.typeBadge} title={`Tipo: ${TYPE_LABEL[mode.type]}`}>
                      {TYPE_LABEL[mode.type]}
                    </span>
                  )}
                  {weekCount > 0 && (
                    <span className={styles.usageBadge} title={`Usado ${weekCount}× nos últimos 7 dias`}>
                      {weekCount}×/7d
                    </span>
                  )}
                </span>
              </span>
              <span className={styles.modeArrow}>›</span>
            </LongPressButton>
            <button
              className={`${styles.favBtn} ${isFav ? styles.favBtnActive : ""}`}
              onClick={(e) => { e.stopPropagation(); toggleFav(mode.id); }}
              aria-pressed={isFav}
              aria-label={isFav ? `Remover ${mode.name} dos favoritos` : `Favoritar ${mode.name}`}
              title={isFav ? "Remover dos favoritos" : "Favoritar"}
            >
              {isFav ? "★" : "☆"}
            </button>
            {showHidden && (
              <button
                className={styles.hideBtn}
                onClick={(e) => handleToggleHidden(e, mode.id, mode.name)}
                aria-pressed={isHidden}
                aria-label={isHidden ? `Reexibir ${mode.name}` : `Ocultar ${mode.name}`}
                title={isHidden ? "Reexibir este modo" : "Ocultar este modo da lista"}
              >
                {isHidden ? "↩" : "🚫"}
              </button>
            )}
            </div>
            </Fragment>
          );
        })}

        {/* Rodapé: atalho para gerenciar os modos ocultos */}
        {!showHidden && hiddenIds.size > 0 && (
          <button
            className={styles.hiddenFooter}
            onClick={() => setShowHidden(true)}
            title="Mostrar e gerenciar os modos ocultos"
          >
            + {hiddenIds.size} {hiddenIds.size === 1 ? "modo oculto" : "modos ocultos"} — gerenciar
          </button>
        )}
      </div>

      {/* Barra "Desfazer" */}
      {undoBar && (
        <div className={styles.undoBar} role="status" aria-live="polite">
          <span className={styles.undoMsg}>{undoBar.msg}</span>
          <button className={styles.undoBtn} onClick={undoBar.undo}>Desfazer</button>
        </div>
      )}

      {/* Painel de detalhes (segurar / botão direito no card) */}
      {detailMode && (
        <ModeDetailSheet
          mode={detailMode}
          todayUsage={todayUsage.get(detailMode.id)}
          weekCount={usage7d.get(detailMode.id) ?? 0}
          isFavorite={favSet.has(detailMode.id)}
          isHidden={hiddenIds.has(detailMode.id)}
          similarModes={allModes
            .filter((m) => m.id !== detailMode.id && modeCategory(m) === modeCategory(detailMode) && !hiddenIds.has(m.id))
            .slice(0, 6)}
          onClose={() => setDetailMode(null)}
          onUse={(m) => { setDetailMode(null); onSelect(m as ModeConfig); }}
          onToggleFavorite={(id) => toggleFav(id)}
          onToggleHidden={(id) => {
            const wasHidden = getHiddenModeIds().has(id);
            setHiddenIds(new Set(toggleHiddenMode(id)));
            flashUndo(wasHidden ? `“${detailMode.name}” reexibido` : `“${detailMode.name}” oculto`, () => {
              setHiddenIds(new Set(toggleHiddenMode(id)));
              setUndoBar(null);
            });
          }}
          onFilterCategory={(c) => { setCategory(c); setDetailMode(null); }}
          onOpenSimilar={(m) => setDetailMode(m as ModeConfig)}
        />
      )}
    </div>
  );
}
