import { useState, useEffect, useMemo, useCallback, useRef } from "react";
import { useConfirm } from "./ConfirmDialog";
import { useToast } from './shared/Toast';
import { useFocusTrap } from "../hooks/useFocusTrap";
import ModeSession from "./ModeSession";
import ModeComboSession from "./ModeComboSession";
import styles from "./ModesPanel.module.css";
import dfStyles from "./daily-focus/DailyFocus.module.css";
import { modeStatsApi } from "../api/modeStats";
import { getPinned, metaFor, pin, unpin } from "../lib/splitePinned";
import { logCompletion, usageStats } from "../lib/modeLog";
import { getAllActivations } from "../lib/modeActivations";
import { getCustomModes, saveCustomMode, deleteCustomMode } from "../lib/customModes";
import { MODES, CATEGORY_BY_ID, CATEGORY_ORDER } from "../data/modes";
import { PRESET_COMBOS } from '../data/presetCombos';
import {
  getUsageLogs,
  getBestHourForMode,
  getModeSuccessRate,
  getPendingReminders,
  clearPendingReminder,
  getCurrentHourBlock,
  getAvgEfficiencyByMode,
  getCorrelationByEstado,
} from "../lib/sessionUsageLog";
import { getEstados } from "./daily-focus/stateToMode";
import { getComboStats } from "../lib/modeComboLog";
import { Task, Routine } from '../types/index';
import SlotBoard from "./SlotBoard";
import MultiCardSession from "./MultiCardSession";
import { loadActiveSession, saveActiveSession, clearActiveSession } from "../lib/multiCardSessionLog";
import { storageGet, storageSet, storageRemove } from "../lib/storage";
import { SK } from "../lib/storageKeys";
import ModeCard from "./modes/ModeCard";
import ModeSearchBar from "./modes/ModeSearchBar";
import CreateModeModal from "./modes/CreateModeModal";

// ── sessionStorage key para persistir seleção de combo ──────────────────────
const COMBO_SS_KEY = "modeComboSelected";

// ── Sorteio ponderado por taxa de sucesso ────────────────────────────────────
// Modos com maior successRate têm score mais alto e aparecem primeiro.
// Modos sem histórico recebem UNTESTED_BONUS como peso base (estimula exploração).
const UNTESTED_BONUS = 50;

function weightedShuffleBySuccess(
  ids: string[],
  seed: number,
  getRate: (id: string) => { successRate: number } | null
): string[] {
  let rng = seed || 1;
  const next = (): number => {
    rng = (rng * 1664525 + 1013904223) & 0xffffffff;
    return (rng >>> 0) / 0x100000000;
  };
  return ids
    .map((id) => {
      const sr = getRate(id);
      const weight = sr !== null ? sr.successRate : UNTESTED_BONUS;
      return { id, score: weight * next() };
    })
    .sort((a, b) => b.score - a.score)
    .map((s) => s.id);
}

interface ModeClass {
  emoji: string;
  name: string;
  desc: string;
  color: string;
}

interface ModeConfig {
  id: string;
  emoji: string;
  name: string;
  tagline: string;
  color: string;
  colorBg: string;
  context?: string[];
  prerequisite?: string;
  whyItWorks?: string;
  whenToUse?: string;
  steps?: string[];
  tips?: string;
  category?: string;
  session?: string;
  preset?: Record<string, unknown>;
  isCustom?: boolean;
  classes?: ModeClass[];
  tags?: string[];
  type?: string;
}

interface SavedShuffle {
  id: number;
  name: string;
  seed: number;
}

interface ComboStat {
  key: string;
  modeIdA: string;
  modeIdB: string;
  total: number;
  successRate: number;
}

interface WeeklyEntry {
  modeId: string;
  count: number;
  mode?: ModeConfig;
}

interface Reminder {
  modeId: string;
  modeName: string;
}

interface DetoxSuggestion {
  platform: string;
  count: number;
  detoxId: string;
}

interface ComboSuggestion {
  modeA: ModeConfig;
  modeB: ModeConfig;
}

// ── Cards do Splite separados por atividade (reutilizam a SpliteSession com preset) ──
// Gerados dinamicamente a partir das atividades "fixadas" (lib/splitePinned.js).
const slug = (s: string): string => s.toLowerCase().normalize("NFD").replace(/[^a-z0-9]+/g, "_").replace(/^_|_$/g, "");

function buildSpliteModes(pinnedActivities: string[]): ModeConfig[] {
  return pinnedActivities.map((activity, i) => {
    const { emoji, color } = metaFor(activity, i);
    return {
      id: `splite_${slug(activity)}`,
      emoji,
      name: activity,
      tagline: `Ciclos progressivos com "${activity}" entre tarefas`,
      color,
      colorBg: hexToRgba(color, 0.08),
      category: "Ciclos",
      session: "splite",
      preset: { activity },
      context: ["🖥️ Desktop", "🔄 Ciclos"],
      prerequisite: `"${activity}" disponível para usar como pausa entre as tarefas.`,
      whyItWorks: `Ciclos progressivos com "${activity}" como recompensa treinável — a atividade fixa cria um ritual previsível e motivador.`,
      whenToUse: `Quando você quer ciclos de foco com "${activity}" como recompensa consistente.`,
      steps: [
        `Ciclo 1: "${activity}" 1× → 1 tarefa`,
        `Ciclo 2: "${activity}" 2× → 2 tarefas`,
        "Continue aumentando progressivamente",
        "A atividade de recompensa já vem escolhida",
      ],
      tips: `Variante do Splite Mode com "${activity}" fixa como recompensa entre as tarefas.`,
    };
  });
}

const categoryOf = (m: ModeConfig): string =>
  m.isCustom ? "Personalizados" : (m.category || CATEGORY_BY_ID[m.id] || "Outros");

function hexToRgba(hex: string, alpha: number): string {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return `rgba(${r},${g},${b},${alpha})`;
}

interface ModesPanelProps {
  tasks: Task[];
  routines?: Routine[];
  onCompleteTask: (id: string) => void;
  onCompleteRoutine: (id: string) => void;
  onAddTask: (task: unknown) => void;
  onAddChecklist: (taskId: string, item: unknown) => void;
  onToggleChecklist: (taskId: string, itemId: string) => void;
  onAddRoutineChecklist: (routineId: string, item: unknown) => void;
  onToggleRoutineChecklist: (routineId: string, itemId: string) => void;
}

export default function ModesPanel({ tasks, routines = [], onCompleteTask, onCompleteRoutine, onAddTask, onAddChecklist, onToggleChecklist, onAddRoutineChecklist, onToggleRoutineChecklist }: ModesPanelProps) {
  const [expanded, setExpanded] = useState<string | null>(null);
  const [activeSession, setActiveSession] = useState<ModeConfig | null>(null); // objeto completo do modo
  const [showCreate, setShowCreate] = useState<boolean>(false);
  // Combo de modos: array com até 2 ids selecionados; activeCombo = { modeA, modeB }
  // Persiste no sessionStorage por ~10 min para sobreviver troca de tabs
  const [comboSelected, setComboSelectedRaw] = useState<string[]>(() => {
    try {
      const raw = sessionStorage.getItem(COMBO_SS_KEY);
      if (!raw) return [];
      const { ids, ts } = JSON.parse(raw);
      if (Date.now() - ts < 10 * 60 * 1000) return ids;
    } catch {}
    return [];
  });
  const setComboSelected = useCallback((updater: string[] | ((prev: string[]) => string[])) => {
    setComboSelectedRaw((prev) => {
      const next = typeof updater === "function" ? updater(prev) : updater;
      try { sessionStorage.setItem(COMBO_SS_KEY, JSON.stringify({ ids: next, ts: Date.now() })); } catch {}
      return next;
    });
  }, []);

  const [activeCombo, setActiveCombo] = useState<{ modeA: ModeConfig; modeB: ModeConfig } | null>(null);
  // Estatísticas de combos já realizados
  const [comboStats, setComboStats] = useState<ComboStat[]>(() => getComboStats());
  const [sortBy, setSortBy] = useState<string>(() => storageGet<string>(SK.MODES_SORT_BY, 'default')); // "default" | "tasks" | "random" | "smart"
  const [category, setCategory] = useState<string>(() => storageGet<string>(SK.MODES_CATEGORY, '')); // "" = todas
  const [pinnedSplite, setPinnedSplite] = useState<string[]>(() => getPinned());
  const [weekly, setWeekly] = useState<WeeklyEntry[]>(() => usageStats(7));
  const [activations, setActivations] = useState<Record<string, number>>(() => {
    const all = getAllActivations();
    return Object.fromEntries(all.map(({ modeId, count }: { modeId: string; count: number }) => [modeId, count]));
  });

  const [customModes, setCustomModes] = useState<ModeConfig[]>(() => getCustomModes());
  // ── Novas features ──────────────────────────────────────────────────────────
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [collapsedCategories, setCollapsedCategories] = useState<Set<string>>(new Set());
  const [showAddActivity, setShowAddActivity] = useState<boolean>(false);
  const [newActivity, setNewActivity] = useState<string>("");
  const [showFilters, setShowFilters] = useState<boolean>(false);
  const [flashingCard, setFlashingCard] = useState<string | null>(null);
  const [shuffleAnim, setShuffleAnim] = useState<boolean>(false);
  const [feelingFilter, setFeelingFilter] = useState<string | null>(null);
  const [intentionDraft, setIntentionDraft] = useState<{ mode: ModeConfig; text: string } | null>(null);
  const [pendingIntention, setPendingIntention] = useState<string>("");
  const [pendingMultiCard, setPendingMultiCard] = useState<{ cards: ModeConfig[]; sessionMode: 'sequential' | 'parallel' } | null>(null);
  const sessionRef = useRef<HTMLDivElement>(null);

  // ── Sequência aleatória ─────────────────────────────────────────────────────
  // #4 Progresso: IDs já iniciados na sequência atual
  const [startedInSequence, setStartedInSequence] = useState<Set<string>>(() =>
    new Set(storageGet<string[]>(SK.MODES_SEQUENCE, []))
  );
  // #5 Ordens salvas (máx 3): [{id, name, seed}]
  const [savedShuffles, setSavedShuffles] = useState<SavedShuffle[]>(() =>
    storageGet<SavedShuffle[]>(SK.MODES_SAVED_SHUFFLES, [])
  );
  const [showSaveShuffleInput, setShowSaveShuffleInput] = useState<boolean>(false);
  const [shuffleSaveName, setShuffleSaveName] = useState<string>('');
  // #7 Sequência guiada
  const [guidedMode, setGuidedMode] = useState<boolean>(() => storageGet<boolean>(SK.MODES_GUIDED, false));
  // #8 Smart shuffle (peso inversamente proporcional ao uso)
  const [smartShuffle, setSmartShuffle] = useState<boolean>(() => storageGet<boolean>(SK.MODES_SMART_SHUFFLE, false));

  // ── Favorites ───────────────────────────────────────────────────────────────
  const [favoriteModes, setFavoriteModes] = useState<string[]>(() =>
    storageGet<string[]>(SK.MODES_FAVORITE, [])
  );
  const toggleFavorite = (id: string): void => {
    setFavoriteModes(prev => {
      const next = prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id];
      storageSet(SK.MODES_FAVORITE, next);
      return next;
    });
  };

  // ── Auto-detox banner ────────────────────────────────────────────────────────
  const [detoxDismissed, setDetoxDismissed] = useState<boolean>(false);

  // ── Preset Combos collapse ───────────────────────────────────────────────────
  const [combosSectionCollapsed, setCombosSectionCollapsed] = useState<boolean>(false);

  // ── Compact view ─────────────────────────────────────────────────────────────
  const [compactView, setCompactView] = useState<boolean>(false);

  // Atualiza modos customizados quando o backend os hidrata no localStorage (ex: primeiro acesso no celular)
  useEffect(() => {
    const handler = () => setCustomModes(getCustomModes());
    window.addEventListener("customModesUpdated", handler);
    return () => window.removeEventListener("customModesUpdated", handler);
  }, []);

  const { confirm, ConfirmUI } = useConfirm();
  const { showToast } = useToast();

  // Focus trap for the active ModeSession modal (sessionRef is the container div)
  useFocusTrap(sessionRef, !!activeSession, () => (modeSessionRef as any).current?.triggerClose());

  // Registros de uso pós-sessão para insights nos cards
  const [usageLogs, setUsageLogs] = useState<any[]>(() => getUsageLogs());
  // Eficiência média histórica por modo (para badge "⚡ XX% avg")
  const [avgEffByMode, setAvgEffByMode] = useState<Record<string, number>>(
    () => getAvgEfficiencyByMode()
  );
  // Lembretes pendentes (sessões puladas sem registrar)
  const [reminders, setReminders] = useState<Reminder[]>(() => getPendingReminders());

  // Recarrega usage logs e lembretes quando a sessão fecha
  const refreshInsights = (): void => {
    setUsageLogs(getUsageLogs());
    setReminders(getPendingReminders());
    setAvgEffByMode(getAvgEfficiencyByMode());
  };

  // ── Multi-card session (novo flow) ──────────────────────────────────────────
  const [multiCardCards, setMultiCardCards] = useState<ModeConfig[] | null>(null);
  const [multiCardStartedAt, setMultiCardStartedAt] = useState<string>("");
  const [multiCardInitialIndex, setMultiCardInitialIndex] = useState<number>(0);
  const [multiCardSessionMode, setMultiCardSessionMode] = useState<'sequential' | 'parallel'>('sequential');

  // Restaurar sessão ativa ao montar (browser reload durante sessão)
  useEffect(() => {
    const active = loadActiveSession();
    if (!active) return;
    // Resolve ModeConfig a partir dos IDs salvos
    const allModes: ModeConfig[] = [...(MODES as ModeConfig[]), ...getCustomModes()];
    const resolved = active.cards
      .map((id) => allModes.find((m) => m.id === id))
      .filter(Boolean) as ModeConfig[];
    if (resolved.length === 0) {
      clearActiveSession();
      return;
    }
    setMultiCardCards(resolved);
    setMultiCardStartedAt(active.startedAt);
    setMultiCardInitialIndex(active.currentCardIndex);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const startMultiCardSession = (cards: ModeConfig[], sessionMode: 'sequential' | 'parallel', intention: string): void => {
    const startedAt = new Date().toISOString();
    saveActiveSession({
      cards: cards.map((c) => c.id),
      startedAt,
      currentCardIndex: 0,
    });
    setMultiCardStartedAt(startedAt);
    setMultiCardInitialIndex(0);
    setMultiCardSessionMode(sessionMode);
    setPendingIntention(intention);
    setMultiCardCards(cards);
  };

  const handleStartMultiCard = (cards: ModeConfig[], mode: 'sequential' | 'parallel' = 'sequential'): void => {
    // Show intention modal before starting
    const syntheticMode: ModeConfig = {
      id: "__multi__",
      emoji: cards.slice(0, 3).map((c) => c.emoji).join(" "),
      name: cards.length === 1 ? cards[0].name : `${cards.length} modos`,
      tagline: "",
      color: "#7c6ef5",
      colorBg: "rgba(124,110,245,0.08)",
    };
    setPendingMultiCard({ cards, sessionMode: mode });
    setIntentionDraft({ mode: syntheticMode, text: "" });
  };

  const handleMultiCardClose = (): void => {
    clearActiveSession();
    setMultiCardCards(null);
    setMultiCardStartedAt("");
    setMultiCardInitialIndex(0);
    refreshInsights();
  };

  // Stats: { [modeId]: number }
  // Início: carrega do localStorage como cache otimista, depois sincroniza com o banco
  const [modeStats, setModeStats] = useState<Record<string, number>>(() =>
    storageGet<Record<string, number>>(SK.MODE_STATS, {})
  );

  // Carrega stats do banco ao montar
  useEffect(() => {
    modeStatsApi.list()
      .then((stats: Record<string, number>) => {
        setModeStats(stats);
        storageSet(SK.MODE_STATS, stats);
      })
      .catch(() => {
        // Mantém localStorage como fallback se o banco falhar
      });
  }, []);

  // Persiste preferências de ordenação e categoria sempre que mudarem
  useEffect(() => { storageSet(SK.MODES_SORT_BY, sortBy); }, [sortBy]);
  useEffect(() => { storageSet(SK.MODES_CATEGORY, category); }, [category]);

  const handleModeTaskComplete = async (modeId: string): Promise<void> => {
    // #4/#7: marcar como concluído na sequência aleatória
    if (sortBy === "random") {
      setStartedInSequence((prev) => {
        const next = new Set(prev);
        next.add(modeId);
        storageSet(SK.MODES_SEQUENCE, [...next]);
        return next;
      });
    }
    // Log local para o painel "mais usados na semana"
    logCompletion(modeId);
    setWeekly(usageStats(7));
    // Update otimista imediato na UI e no cache local
    setModeStats((prev) => {
      const updated = { ...prev, [modeId]: (prev[modeId] || 0) + 1 };
      storageSet(SK.MODE_STATS, updated);
      return updated;
    });
    // Persiste no banco (incremento atômico via RPC)
    try {
      const newCount: number = await modeStatsApi.increment(modeId);
      // Sincroniza o valor exato retornado pelo banco
      setModeStats((prev) => {
        const updated = { ...prev, [modeId]: newCount };
        storageSet(SK.MODE_STATS, updated);
        return updated;
      });
      showToast('Progresso salvo!', 'success');
    } catch (e: any) {
      // Falhou no banco — localStorage já tem o valor otimista, ok por ora
      console.warn("Falha ao salvar stat no banco:", e.message);
      showToast('Falha ao salvar — dados mantidos localmente', 'error');
    }
  };

  const toggle = (id: string): void => setExpanded((p) => (p === id ? null : id));

  const toggleCombo = (id: string): void => {
    setComboSelected((prev) => {
      if (prev.includes(id)) return prev.filter((x) => x !== id);
      if (prev.length < 2) return [...prev, id];
      // Substitui o mais antigo (índice 0) pelo novo
      return [prev[1], id];
    });
  };

  const handleStartCombo = (): void => {
    if (comboSelected.length !== 2) return;
    const modeA = modeById[comboSelected[0]];
    const modeB = modeById[comboSelected[1]];
    if (modeA && modeB) setActiveCombo({ modeA, modeB });
  };

  const handleSaveMode = (newMode: ModeConfig): void => {
    const updated = saveCustomMode(newMode);
    setCustomModes(updated ?? getCustomModes());
    setShowCreate(false);
    showToast('Modo criado!', 'success');
  };

  const toggleCategory = (name: string): void => {
    setCollapsedCategories((prev) => {
      const next = new Set(prev);
      next.has(name) ? next.delete(name) : next.add(name);
      return next;
    });
  };

  const handleAddActivity = (): void => {
    const activity = newActivity.trim();
    if (!activity) return;
    const updated = pin(activity);
    setPinnedSplite([...updated]);
    setNewActivity("");
    setShowAddActivity(false);
  };

  const handleUnpinActivity = (activity: string): void => {
    const updated = unpin(activity);
    setPinnedSplite([...updated]);
  };

  const handleDeleteMode = async (id: string): Promise<void> => {
    const mode = customModes.find((m) => m.id === id);
    const ok = await confirm({
      title: `Excluir modo "${mode?.name ?? ""}"?`,
      message: "Esse modo customizado será removido permanentemente.",
      confirmLabel: "Excluir",
    });
    if (!ok) return;
    const updated = deleteCustomMode(id);
    setCustomModes(updated ?? getCustomModes());
    showToast('Modo excluído.', 'info');
  };

  const hasRequiredFields = (m: ModeConfig): boolean =>
    !!(m.prerequisite?.trim() && m.whyItWorks?.trim() && m.whenToUse?.trim());

  const incompleteCustomModes = customModes.filter((m) => !hasRequiredFields(m));

  // Cards do Splite ordenados por frequência de uso (mais usado primeiro)
  const spliteCards = buildSpliteModes(pinnedSplite)
    .sort((a, b) => (activations[b.id] || 0) - (activations[a.id] || 0));

  const allModes: ModeConfig[] = [...MODES.filter((m: ModeConfig) => m.id !== "splite"), ...spliteCards, ...customModes]
    .filter(hasRequiredFields);
  const modeById: Record<string, ModeConfig> = Object.fromEntries(allModes.map((m) => [m.id, m]));

  // Filtra por busca de texto
  const sq = searchQuery.trim().toLowerCase();
  const displayModes: ModeConfig[] = sq
    ? allModes.filter(m =>
        m.name.toLowerCase().includes(sq) ||
        (m.tagline || '').toLowerCase().includes(sq) ||
        (m.context || []).some(c => c.toLowerCase().includes(sq)) ||
        (m.whenToUse || '').toLowerCase().includes(sq) ||
        (m.tags || []).some(t => t.toLowerCase().includes(sq))
      )
    : allModes;

  // Top modos da semana (com metadados conhecidos)
  const topWeekly: WeeklyEntry[] = weekly
    .map((w) => ({ ...w, mode: modeById[w.modeId] }))
    .filter((w) => w.mode)
    .slice(0, 5);
  const weeklyMax = topWeekly.reduce((mx, w) => Math.max(mx, w.count), 0);

  // Categorias presentes (na ordem canônica, só as que têm modos)
  const presentCategories: string[] = CATEGORY_ORDER.filter((c: string) => displayModes.some((m) => categoryOf(m) === c));

  // ── Scores inteligentes pré-computados (evita recalcular por comparação no sort) ──
  const smartScores: Record<string, number> = useMemo(() => {
    const currentBlock = getCurrentHourBlock();
    const lastLog = usageLogs[usageLogs.length - 1];
    const IDLE_BOOST_IDS = ["momentum", "espresso", "music", "cafe-ritual"];

    // Pré-calcula idle time uma vez
    let minutesIdle = 0;
    if (lastLog) {
      const lastDate = new Date(
        lastLog.date + "T" + String(lastLog.hour).padStart(2, "0") + ":00"
      );
      minutesIdle = (Date.now() - lastDate.getTime()) / 60000;
    }

    const scores: Record<string, number> = {};
    for (const mode of allModes) {
      let score = 0;

      // +3 se o melhor horário histórico coincide com o bloco atual
      const bestHour = getBestHourForMode(mode.id);
      if (bestHour && bestHour.block.id === currentBlock.id) score += 3;

      // +2 / +1 por taxa de sucesso
      const sr = getModeSuccessRate(mode.id);
      if (sr && sr.successRate >= 70) score += 2;
      else if (sr && sr.successRate >= 50) score += 1;

      // -2 se foi o último modo usado (evita repetição imediata)
      if (lastLog && lastLog.modeId === mode.id) score -= 2;

      // +1 se muito utilizado (tarefas concluídas)
      if ((modeStats[mode.id] || 0) >= 5) score += 1;

      // +2 para modos de entrada se usuário parado > 45 min
      if (IDLE_BOOST_IDS.includes(mode.id) && minutesIdle > 45) score += 2;

      scores[mode.id] = score;
    }
    return scores;
  }, [allModes, usageLogs, modeStats]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Auto-detox suggestion ──────────────────────────────────────────────────
  const detoxSuggestion: DetoxSuggestion | null = useMemo(() => {
    if (detoxDismissed) return null;
    const recent = usageLogs.slice(-10);
    const platforms = ['youtube', 'tiktok', 'reels', 'twitter', 'reddit', 'whatsapp', 'netflix'];
    for (const p of platforms) {
      const count = recent.filter((l: any) => l.modeId && l.modeId.startsWith(p + '_')).length;
      if (count >= 3) {
        const detoxId = p + '_detox';
        if (modeById[detoxId]) return { platform: p, count, detoxId };
      }
    }
    return null;
  }, [usageLogs, detoxDismissed, modeById]);

  // ── Ordem aleatória estável: só reembaralha quando o usuário clica em "Aleatório" ──
  const [randomSeed, setRandomSeed] = useState<number>(() => storageGet<number>(SK.MODES_RANDOM_SEED, 0));
  const randomOrder: string[] = useMemo(() => {
    // #6: se há categoria ativa, embaralha apenas os modos dela
    const pool = category ? allModes.filter((m) => categoryOf(m) === category) : allModes;
    const ids = pool.map((m) => m.id);
    let rng = randomSeed || 1;
    const next = (): number => { rng = (rng * 1664525 + 1013904223) & 0xffffffff; return (rng >>> 0) / 0x100000000; };

    if (smartShuffle) {
      // #8: peso inversamente proporcional ao uso — menos usado = aparece antes
      const scored = ids.map((id) => {
        const r = next();
        const usage = modeStats[id] || 0;
        return { id, score: r / (usage + 1) };
      });
      return scored.sort((a, b) => b.score - a.score).map((s) => s.id);
    }

    // Sorteio ponderado por taxa de sucesso — modos sem dados recebem bônus fixo
    return weightedShuffleBySuccess(ids, randomSeed, getModeSuccessRate);
  }, [allModes, randomSeed, smartShuffle, modeStats, category]);

  const handleSetRandom = (): void => {
    const newSeed = Math.floor(Math.random() * 0xffffffff) + 1;
    setRandomSeed(newSeed);
    storageSet(SK.MODES_RANDOM_SEED, newSeed);
    storageSet(SK.MODES_SORT_BY, 'random');
    setSortBy("random");
    // #4: limpar progresso da sequência ao reembaralhar
    setStartedInSequence(new Set());
    storageRemove(SK.MODES_SEQUENCE);
    setShuffleAnim(true);
    setTimeout(() => setShuffleAnim(false), 550);
  };

  // #5: salvar ordem atual com nome
  const handleSaveShuffle = (): void => {
    const name = shuffleSaveName.trim() || `Ordem ${savedShuffles.length + 1}`;
    const entry: SavedShuffle = { id: randomSeed, name, seed: randomSeed };
    const updated = [...savedShuffles.filter((s) => s.seed !== randomSeed).slice(-2), entry];
    setSavedShuffles(updated);
    storageSet(SK.MODES_SAVED_SHUFFLES, updated);
    setShuffleSaveName('');
    setShowSaveShuffleInput(false);
  };

  // #5: carregar ordem salva
  const loadSavedShuffle = (shuffle: SavedShuffle): void => {
    setRandomSeed(shuffle.seed);
    storageSet(SK.MODES_RANDOM_SEED, shuffle.seed);
    setSortBy('random');
    storageSet(SK.MODES_SORT_BY, 'random');
    setStartedInSequence(new Set());
    storageRemove(SK.MODES_SEQUENCE);
  };

  // #5: excluir ordem salva
  const deleteSavedShuffle = (id: number): void => {
    const updated = savedShuffles.filter((s) => s.id !== id);
    setSavedShuffles(updated);
    storageSet(SK.MODES_SAVED_SHUFFLES, updated);
  };

  // #7: alternar sequência guiada
  const toggleGuidedMode = (): void => {
    setGuidedMode((prev) => {
      storageSet(SK.MODES_GUIDED, !prev);
      return !prev;
    });
  };

  // #8: alternar smart shuffle
  const toggleSmartShuffle = (): void => {
    setSmartShuffle((prev) => {
      storageSet(SK.MODES_SMART_SHUFFLE, !prev);
      return !prev;
    });
  };

  const applySort = (list: ModeConfig[]): ModeConfig[] => {
    let sorted: ModeConfig[];
    if (sortBy === "tasks")
      sorted = [...list].sort((a, b) => (modeStats[b.id] || 0) - (modeStats[a.id] || 0));
    else if (sortBy === "random") {
      const pos = Object.fromEntries(randomOrder.map((id, i) => [id, i]));
      sorted = [...list].sort((a, b) => (pos[a.id] ?? 999) - (pos[b.id] ?? 999));
    } else if (sortBy === "smart")
      sorted = [...list].sort((a, b) => (smartScores[b.id] ?? 0) - (smartScores[a.id] ?? 0));
    else
      sorted = list; // "default"

    if (feelingFilter) {
      const correlation = getCorrelationByEstado();
      const getRateForFeeling = (modeId: string): number => {
        const entries = correlation[modeId];
        if (!entries) return -1;
        const match = entries.find((e: { estadoId: string }) => e.estadoId === feelingFilter);
        return match ? (match as { successRate: number }).successRate : -1;
      };
      sorted = [...sorted].sort((a, b) => {
        const rA = getRateForFeeling(a.id);
        const rB = getRateForFeeling(b.id);
        if (rA === -1 && rB === -1) return 0;
        if (rA === -1) return 1;
        if (rB === -1) return -1;
        return rB - rA;
      });
    }

    return sorted;
  };

  // Quando sort é smart/random → lista plana (sem agrupamento por categoria)
  const flatSortedModes: ModeConfig[] | null =
    sortBy === "random" || sortBy === "smart"
      ? applySort(category ? displayModes.filter((m) => categoryOf(m) === category) : displayModes)
      : null;

  // Sem filtro → agrupa por categoria; com filtro → um único grupo
  const groups: { name: string; modes: ModeConfig[] }[] = category
    ? [{ name: category, modes: applySort(displayModes.filter((m) => categoryOf(m) === category)) }]
    : presentCategories.map((c) => ({ name: c, modes: applySort(displayModes.filter((m) => categoryOf(m) === c)) }));

  // Pré-computa contagem de combos por modo (quantas vezes aparece em qualquer par)
  const comboCountByMode: Record<string, number> = useMemo(() => {
    const map: Record<string, number> = {};
    for (const s of comboStats) {
      map[s.modeIdA] = (map[s.modeIdA] || 0) + s.total;
      map[s.modeIdB] = (map[s.modeIdB] || 0) + s.total;
    }
    return map;
  }, [comboStats]);

  // Sugestão inteligente de combo: par com maior soma de smartScores ainda não tentado
  const comboSuggestion: ComboSuggestion | null = useMemo(() => {
    if (sortBy !== "smart") return null;
    const triedPairs = new Set(comboStats.map((s) => `${s.modeIdA}+${s.modeIdB}`));
    const topModes = allModes
      .filter((m) => (smartScores[m.id] ?? 0) >= 2)
      .sort((a, b) => (smartScores[b.id] ?? 0) - (smartScores[a.id] ?? 0))
      .slice(0, 6);
    let best: ComboSuggestion | null = null;
    let bestScore = -Infinity;
    for (let i = 0; i < topModes.length; i++) {
      for (let j = i + 1; j < topModes.length; j++) {
        const [a, b] = [topModes[i].id, topModes[j].id].sort();
        const key = `${a}+${b}`;
        const score = (smartScores[topModes[i].id] ?? 0) + (smartScores[topModes[j].id] ?? 0);
        if (!triedPairs.has(key) && score > bestScore) {
          bestScore = score;
          best = { modeA: topModes[i], modeB: topModes[j] };
        }
      }
    }
    return best;
  }, [sortBy, comboStats, allModes, smartScores]);

  const modeSessionRef = useRef<any>(null);

  // ── Stable callbacks for ModeCard (React.memo only helps if refs are stable) ─
  const handleToggle = useCallback((id: string) => setExpanded((p) => p === id ? null : id), []);

  const handleFavorite = useCallback((id: string) => {
    setFavoriteModes((prev) => {
      const next = prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id];
      storageSet(SK.MODES_FAVORITE, next);
      return next;
    });
  }, []);

  const handleCombo = useCallback((id: string) => {
    setComboSelected((prev) => {
      if (prev.includes(id)) return prev.filter((x) => x !== id);
      if (prev.length < 2) return [...prev, id];
      return [prev[1], id];
    });
  }, []);

  const handleStart = useCallback((mode: ModeConfig) => {
    setIntentionDraft({ mode, text: "" });
  }, []);

  const confirmIntention = (): void => {
    if (!intentionDraft) return;
    const text = intentionDraft.text.trim();
    if (pendingMultiCard) {
      // Multi-card session path
      startMultiCardSession(pendingMultiCard.cards, pendingMultiCard.sessionMode, text);
      setPendingMultiCard(null);
    } else {
      // Single-mode session path
      setPendingIntention(text);
      setActiveSession(intentionDraft.mode);
    }
    setIntentionDraft(null);
  };

  const handleDelete = useCallback(async (id: string) => {
    const mode = customModes.find((m) => m.id === id);
    const ok = await confirm({
      title: `Excluir modo "${mode?.name ?? ""}"?`,
      message: "Esse modo customizado será removido permanentemente.",
      confirmLabel: "Excluir",
    });
    if (!ok) return;
    const updated = deleteCustomMode(id);
    setCustomModes(updated ?? getCustomModes());
    showToast("Modo excluído.", "info");
  }, [customModes, confirm, showToast]);

  const handleUnpin = useCallback((activity: string) => {
    const updated = unpin(activity);
    setPinnedSplite([...updated]);
  }, []);

  const handleFlash = useCallback((id: string | null) => setFlashingCard(id), []);

  const handleSequenceAdd = useCallback((id: string) => {
    setStartedInSequence((prev) => {
      const next = new Set(prev);
      next.add(id);
      storageSet(SK.MODES_SEQUENCE, [...next]);
      return next;
    });
  }, []);

  const openDailyFocus = (): void => {
    window.open(window.location.href.split("#")[0] + "#/daily-focus", "_blank");
  };

  return (
    <div className={styles.root}>
      {/* Feature 3: Lembretes de sessões não registradas */}
      {reminders.map((r) => (
        <div key={r.modeId} className={styles.reminderBanner}>
          <span className={styles.reminderIcon}>📝</span>
          <span className={styles.reminderText}>
            Você pulou o registro da sessão de <strong>{r.modeName}</strong>. Que tal registrar agora?
          </span>
          <button
            className={styles.reminderRegisterBtn}
            onClick={() => setActiveSession(null) || setReminders((prev) => {
              clearPendingReminder(r.modeId);
              return prev.filter((x) => x.modeId !== r.modeId);
            })}
          >
            Dispensar
          </button>
        </div>
      ))}

      {/* Daily Focus card */}
      <div className={dfStyles.dailyFocusCard} onClick={openDailyFocus} role="button" tabIndex={0}
        onKeyDown={(e) => e.key === "Enter" && openDailyFocus()}>
        <span className={dfStyles.dailyFocusCardEmoji}>🎯</span>
        <div className={dfStyles.dailyFocusCardInfo}>
          <div className={dfStyles.dailyFocusCardName}>Daily Focus</div>
          <div className={dfStyles.dailyFocusCardSub}>
            Sessões progressivas por nível · Timer + Modo de Apoio · Persiste o estado
          </div>
        </div>
        <span className={dfStyles.dailyFocusCardArrow}>↗</span>
      </div>

      {incompleteCustomModes.length > 0 && (
        <div className={styles.incompleteWarning}>
          <span className={styles.incompleteIcon}>⚠️</span>
          <span>
            <strong>{incompleteCustomModes.length}</strong> modo{incompleteCustomModes.length > 1 ? "s" : ""} personalizado{incompleteCustomModes.length > 1 ? "s" : ""} oculto{incompleteCustomModes.length > 1 ? "s" : ""} por faltarem campos obrigatórios:{" "}
            {incompleteCustomModes.map((m) => m.name).join(", ")}.
          </span>
          <button className={styles.incompleteEditBtn} onClick={() => setShowCreate(true)}>
            Criar completo →
          </button>
        </div>
      )}

      <SlotBoard onStartSession={handleStartMultiCard} />

      {/* ── Panel header ── */}
      <div className={styles.panelHeader}>
        <div>
          <h2 className={styles.panelTitle}>Modos de Produtividade</h2>
          <p className={styles.subtitle}>Escolha um modo para iniciar sua sessão</p>
        </div>
        <button className={styles.createBtn} onClick={() => setShowCreate(true)}>
          <span>✦</span> Criar modo
        </button>
      </div>

      {/* ── Sort bar ── */}
      <div className={styles.sortBar}>
        <span className={styles.sortLabel}>Ordenar:</span>
        {(["default", "tasks", "smart"] as const).map((s) => (
          <button
            key={s}
            className={sortBy === s ? styles.sortBtnActive : styles.sortBtn}
            onClick={() => { setSortBy(s); setStartedInSequence(new Set()); storageRemove(SK.MODES_SEQUENCE); }}
          >
            {s === "default" ? "Padrão" : s === "tasks" ? "+ usados" : "✨ Smart"}
          </button>
        ))}
        <button
          className={`${sortBy === "random" ? styles.sortBtnActive : styles.sortBtn} ${shuffleAnim ? styles.shuffleSpin : ""}`}
          onClick={() => {
            const seed = (Math.floor(Math.random() * 0x7fffffff) + 1) || 1;
            setRandomSeed(seed);
            storageSet(SK.MODES_RANDOM_SEED, seed);
            setSortBy("random");
            setStartedInSequence(new Set());
            storageRemove(SK.MODES_SEQUENCE);
            if (sortBy === "random") { setShuffleAnim(true); setTimeout(() => setShuffleAnim(false), 500); }
          }}
        >
          🔀 {sortBy === "random" ? "Reembaralhar" : "Aleatório"}
        </button>
        <button
          className={compactView ? styles.sortBtnActive : styles.sortBtn}
          onClick={() => setCompactView((p) => !p)}
        >
          ⊞ Compacto
        </button>
      </div>

      {/* ── Feeling filter bar ── */}
      {(() => {
        const estados = getEstados();
        const active = feelingFilter ? estados.find((e) => e.id === feelingFilter) : null;
        return (
          <div className={styles.feelingBar}>
            {active ? (
              <span className={styles.feelingActive}>
                {active.emoji} {active.label}
                <button
                  className={styles.feelingClear}
                  onClick={() => setFeelingFilter(null)}
                  title="Remover filtro de feeling"
                >
                  ×
                </button>
              </span>
            ) : (
              <>
                <span className={styles.feelingLabel}>Como você está?</span>
                {estados.map((e) => (
                  <button
                    key={e.id}
                    className={styles.feelingBtn}
                    onClick={() => setFeelingFilter(e.id)}
                    title={e.label}
                  >
                    {e.emoji}
                  </button>
                ))}
              </>
            )}
          </div>
        );
      })()}

      {/* ── Search + filter toggle ── */}
      <div className={styles.searchRow}>
        <ModeSearchBar value={searchQuery} onChange={setSearchQuery} onClear={() => setSearchQuery("")} />
        <button
          className={`${styles.filterToggleBtn} ${(category || showFilters) ? styles.filterToggleBtnActive : ""}`}
          onClick={() => setShowFilters((p) => !p)}
          title="Filtrar por categoria"
        >
          {category && <span className={styles.filterDot} />}
          ⊟ Filtros
        </button>
      </div>

      {/* ── Category filter panel ── */}
      {showFilters && (
        <div className={styles.filterPanel}>
          <button
            className={!category ? styles.sortBtnActive : styles.sortBtn}
            onClick={() => setCategory("")}
          >
            Todos
          </button>
          {(CATEGORY_ORDER as string[])
            .filter((c) => presentCategories.includes(c))
            .map((c) => (
              <button
                key={c}
                className={category === c ? styles.sortBtnActive : styles.sortBtn}
                onClick={() => setCategory((prev) => (prev === c ? "" : c))}
              >
                {c}
              </button>
            ))}
        </div>
      )}

      {/* ── Random mode toolbar ── */}
      {sortBy === "random" && (
        <div className={styles.randomToolbar}>
          <button
            className={`${styles.randomToolbarBtn} ${guidedMode ? styles.randomToolbarBtnActive : ""}`}
            onClick={toggleGuidedMode}
            title="Sequência guiada: siga a ordem dos cards e marque cada um como concluído"
          >
            {guidedMode ? "🗺️ Guiado ON" : "🗺️ Guiado OFF"}
          </button>
          <button
            className={`${styles.randomToolbarBtn} ${smartShuffle ? styles.randomToolbarBtnActive : ""}`}
            onClick={toggleSmartShuffle}
            title="Embaralha priorizando modos menos usados"
          >
            {smartShuffle ? "🧠 Smart ON" : "🧠 Smart OFF"}
          </button>
          {startedInSequence.size > 0 && flatSortedModes && (
            <span className={styles.seqProgress}>
              {startedInSequence.size}/{flatSortedModes.length} iniciados
            </span>
          )}
          {savedShuffles.length < 3 && !showSaveShuffleInput && (
            <button className={styles.randomToolbarBtn} onClick={() => setShowSaveShuffleInput(true)}>
              💾 Salvar ordem
            </button>
          )}
        </div>
      )}

      {/* ── Save shuffle input ── */}
      {sortBy === "random" && showSaveShuffleInput && (
        <div className={styles.saveShuffleRow}>
          <input
            className={styles.saveShuffleInput}
            placeholder="Nome da ordem…"
            value={shuffleSaveName}
            onChange={(e) => setShuffleSaveName(e.target.value)}
            autoFocus
          />
          <button
            className={styles.saveShuffleConfirm}
            onClick={() => {
              if (!shuffleSaveName.trim()) return;
              const shuffle: SavedShuffle = { id: Date.now(), name: shuffleSaveName.trim(), seed: randomSeed };
              const updated = [...savedShuffles, shuffle].slice(-3);
              setSavedShuffles(updated);
              storageSet(SK.MODES_SAVED_SHUFFLES, updated);
              setShuffleSaveName("");
              setShowSaveShuffleInput(false);
            }}
          >
            Salvar
          </button>
          <button
            className={styles.saveShuffleCancel}
            onClick={() => { setShowSaveShuffleInput(false); setShuffleSaveName(""); }}
          >
            Cancelar
          </button>
        </div>
      )}

      {/* ── Saved shuffles ── */}
      {sortBy === "random" && savedShuffles.length > 0 && (
        <div className={styles.savedShufflesRow}>
          {savedShuffles.map((s) => (
            <div
              key={s.id}
              className={`${styles.savedShuffleChip} ${s.seed === randomSeed ? styles.savedShuffleChipActive : ""}`}
            >
              <button onClick={() => loadSavedShuffle(s)}>{s.name}</button>
              <button className={styles.savedShuffleDelete} onClick={() => deleteSavedShuffle(s.id)}>×</button>
            </div>
          ))}
        </div>
      )}

      {/* ── Smart sort hint ── */}
      {sortBy === "smart" && (
        <div className={styles.smartSortHint}>
          ✨ Ordenado por horário ideal, taxa de sucesso e uso recente
        </div>
      )}

      {/* ── Detox banner ── */}
      {detoxSuggestion && (
        <div className={styles.detoxBanner}>
          <span>
            ⚠️ Você usou modos de <strong>{detoxSuggestion.platform}</strong>{" "}
            {detoxSuggestion.count}× recentemente. Que tal um detox?
          </span>
          <button
            className={styles.detoxBannerBtn}
            onClick={() => setActiveSession(modeById[detoxSuggestion.detoxId])}
          >
            🧹 Iniciar Detox
          </button>
          <button className={styles.detoxBannerClose} onClick={() => setDetoxDismissed(true)}>×</button>
        </div>
      )}

      {/* ── Combo suggestion ── */}
      {comboSuggestion && (
        <div className={styles.comboSuggestion}>
          <span className={styles.comboSuggestionIcon}>🔀</span>
          <span className={styles.comboSuggestionText}>
            Combinação sugerida:{" "}
            <strong>{comboSuggestion.modeA.emoji} {comboSuggestion.modeA.name}</strong>
            {" + "}
            <strong>{comboSuggestion.modeB.emoji} {comboSuggestion.modeB.name}</strong>
          </span>
          <button
            className={styles.comboSuggestionBtn}
            onClick={() => setComboSelected([comboSuggestion.modeA.id, comboSuggestion.modeB.id])}
          >
            Testar juntos
          </button>
        </div>
      )}

      {/* ── Mais usados esta semana ── */}
      {topWeekly.length > 0 && (
        <div className={styles.weeklyPanel}>
          <div className={styles.weeklyHeader}>
            <span className={styles.weeklyTitle}>📊 Mais usados esta semana</span>
          </div>
          <div className={styles.weeklyList}>
            {topWeekly.map((w) => (
              <div key={w.modeId} className={styles.weeklyRow}>
                <span className={styles.weeklyEmoji}>{w.mode?.emoji}</span>
                <span className={styles.weeklyName}>{w.mode?.name}</span>
                <div className={styles.weeklyBarTrack}>
                  <div
                    className={styles.weeklyBarFill}
                    style={{ width: `${(w.count / weeklyMax) * 100}%`, background: w.mode?.color }}
                  />
                </div>
                <span className={styles.weeklyCount}>{w.count}×</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── Add Splite activity ── */}
      <div className={styles.categorySection}>
        {showAddActivity ? (
          <div className={styles.addActivityRow}>
            <input
              className={styles.addActivityInput}
              placeholder="Atividade (ex: Guitarra, Leitura)…"
              value={newActivity}
              onChange={(e) => setNewActivity(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleAddActivity()}
              autoFocus
            />
            <button className={styles.addActivityConfirm} onClick={handleAddActivity}>Adicionar</button>
            <button
              className={styles.addActivityCancel}
              onClick={() => { setShowAddActivity(false); setNewActivity(""); }}
            >
              Cancelar
            </button>
          </div>
        ) : (
          <button className={styles.addActivityBtn} onClick={() => setShowAddActivity(true)}>
            + Adicionar atividade personalizada
          </button>
        )}
      </div>

      {/* ── Card list ── */}
      {(() => {
        const todayStr = new Intl.DateTimeFormat("en-CA").format(new Date());
        const inRandomMode = sortBy === "random";

        const cardProps = (mode: ModeConfig, index: number) => {
          const wasStartedInSeq = inRandomMode && startedInSequence.has(mode.id);
          const isNextGuided =
            guidedMode &&
            inRandomMode &&
            !wasStartedInSeq &&
            (flatSortedModes
              ? flatSortedModes.slice(0, index).every((m) => startedInSequence.has(m.id))
              : false);
          return {
            open: expanded === mode.id,
            compactView,
            isActiveSession: activeSession?.id === mode.id,
            sessionRef,
            sortBy,
            inRandomMode,
            wasStartedInSeq,
            isNextGuided,
            taskCount: modeStats[mode.id] || 0,
            activationCount: activations[mode.id] || 0,
            usedToday: usageLogs.some((l: any) => l.modeId === mode.id && l.date === todayStr),
            smartScore: smartScores[mode.id] ?? 0,
            isComboSelected: comboSelected.includes(mode.id),
            comboCount: comboCountByMode[mode.id] || 0,
            avgEfficiency: avgEffByMode[mode.id] ?? null,
            isFavorite: favoriteModes.includes(mode.id),
            flashingCard,
            onToggle: handleToggle,
            onFavorite: handleFavorite,
            onCombo: handleCombo,
            onStart: handleStart,
            onDelete: handleDelete,
            onUnpin: handleUnpin,
            onFlash: handleFlash,
            onSequenceAdd: handleSequenceAdd,
          };
        };

        if (sq) {
          return (
            <div className={styles.categorySection}>
              {displayModes.length === 0 ? (
                <div className={styles.emptyActivities}>
                  <span className={styles.emptyActivitiesIcon}>🔍</span>
                  <span className={styles.emptyActivitiesText}>
                    Nenhum modo encontrado para &ldquo;{searchQuery}&rdquo;
                  </span>
                </div>
              ) : (
                displayModes.map((mode, i) => (
                  <ModeCard key={mode.id} mode={mode} index={i} {...cardProps(mode, i)} />
                ))
              )}
            </div>
          );
        }

        if (flatSortedModes) {
          return (
            <div className={styles.categorySection}>
              {flatSortedModes.map((mode, i) => (
                <ModeCard key={mode.id} mode={mode} index={i} {...cardProps(mode, i)} />
              ))}
            </div>
          );
        }

        return (
          <>
            {groups.map((group) => (
              <div key={group.name} className={styles.categoryGroup}>
                <button
                  className={styles.categoryToggleBtn}
                  onClick={() => toggleCategory(group.name)}
                >
                  <span
                    className={`${styles.categoryChevron} ${collapsedCategories.has(group.name) ? "" : styles.categoryChevronOpen}`}
                  >
                    ›
                  </span>
                  <span className={styles.categoryTitle}>{group.name}</span>
                  <span className={styles.categoryCount}>{group.modes.length}</span>
                </button>
                {!collapsedCategories.has(group.name) && (
                  <div className={styles.categorySection}>
                    {group.modes.map((mode, i) => (
                      <ModeCard key={mode.id} mode={mode} index={i} {...cardProps(mode, i)} />
                    ))}
                  </div>
                )}
              </div>
            ))}
          </>
        );
      })()}

      {showCreate && (
        <CreateModeModal onSave={handleSaveMode} onClose={() => setShowCreate(false)} />
      )}

      {/* Barra flutuante de combo */}
      {comboSelected.length > 0 && !activeCombo && (
        <div className={`${styles.comboBar} ${comboSelected.length === 1 ? styles.comboBarPending : ""}`}>
          {comboSelected.length === 1 ? (
            <>
              <span className={styles.comboBarLabel}>
                {modeById[comboSelected[0]]?.emoji} {modeById[comboSelected[0]]?.name}
              </span>
              <span className={styles.comboBarHint}>+ escolha mais 1 modo</span>
              <button className={styles.comboBarClear} onClick={() => setComboSelected([])}>×</button>
            </>
          ) : (() => {
            const mA = modeById[comboSelected[0]];
            const mB = modeById[comboSelected[1]];
            const typeMismatch = mA?.type && mB?.type && mA.type !== mB.type;
            return (
              <>
                <span className={styles.comboBarLabel}>
                  {mA?.emoji} {mA?.name}{" + "}{mB?.emoji} {mB?.name}
                </span>
                {typeMismatch && (
                  <span className={styles.comboBarTypeMismatch} title={`${mA.name} é "${mA.type}" · ${mB.name} é "${mB.type}"`}>
                    ⚠️ tipos diferentes
                  </span>
                )}
                <button className={styles.comboBarStart} onClick={handleStartCombo}>
                  🔀 Testar juntos
                </button>
                <button className={styles.comboBarClear} onClick={() => setComboSelected([])}>×</button>
              </>
            );
          })()}
        </div>
      )}

      {activeCombo && (
        <ModeComboSession
          modeA={activeCombo.modeA}
          modeB={activeCombo.modeB}
          onClose={() => {
            setActiveCombo(null);
            setComboSelected([]);
            setComboStats(getComboStats());
          }}
        />
      )}

      {activeSession && (
        <div
          ref={sessionRef}
          role="dialog"
          aria-modal="true"
          aria-label={activeSession.name ? `Sessão: ${activeSession.name}` : "Sessão ativa"}
        >
        <ModeSession
          modeId={activeSession.id}
          mode={activeSession}
          tasks={tasks}
          routines={routines}
          intention={pendingIntention || undefined}
          onCompleteTask={onCompleteTask}
          onCompleteRoutine={onCompleteRoutine}
          onAddTask={onAddTask}
          onAddChecklist={onAddChecklist}
          onToggleChecklist={onToggleChecklist}
          onAddRoutineChecklist={onAddRoutineChecklist}
          onToggleRoutineChecklist={onToggleRoutineChecklist}
          onTaskComplete={handleModeTaskComplete}
          onClose={() => {
            setActiveSession(null);
            setPendingIntention("");
            setPinnedSplite(getPinned());
            // Recarrega contagem de ativações ao fechar sessão
            const all = getAllActivations();
            setActivations(Object.fromEntries(all.map(({ modeId, count }: { modeId: string; count: number }) => [modeId, count])));
            // Recarrega insights de uso pós-sessão
            refreshInsights();
          }}
        />
        </div>
      )}

      {/* Multi-card session overlay */}
      {multiCardCards && (
        <MultiCardSession
          cards={multiCardCards}
          startedAt={multiCardStartedAt}
          initialIndex={multiCardInitialIndex}
          sessionMode={multiCardSessionMode}
          intention={pendingIntention || undefined}
          tasks={tasks}
          routines={routines}
          onCompleteTask={onCompleteTask}
          onCompleteRoutine={onCompleteRoutine}
          onAddTask={onAddTask}
          onAddChecklist={onAddChecklist}
          onToggleChecklist={onToggleChecklist}
          onAddRoutineChecklist={onAddRoutineChecklist}
          onToggleRoutineChecklist={onToggleRoutineChecklist}
          onClose={() => {
            setPendingIntention("");
            handleMultiCardClose();
          }}
        />
      )}

      {ConfirmUI}

      {/* ── Modal de intenção de sessão ── */}
      {intentionDraft && (
        <div
          style={{
            position: "fixed", inset: 0, background: "rgba(0,0,0,0.55)",
            display: "flex", alignItems: "center", justifyContent: "center",
            zIndex: 350, backdropFilter: "blur(2px)",
          }}
          onClick={(e) => { if (e.target === e.currentTarget) setIntentionDraft(null); }}
        >
          <div style={{
            background: "var(--surface)", border: "1px solid var(--border)",
            borderRadius: "var(--radius)", padding: "24px", width: "min(90vw, 400px)",
            display: "flex", flexDirection: "column", gap: 12,
          }}>
            <div style={{ fontSize: 15, fontWeight: 600, color: "var(--text)" }}>
              {intentionDraft.mode.emoji} {intentionDraft.mode.name}
            </div>
            <input
              autoFocus
              placeholder="O que você vai fazer nessa sessão?"
              value={intentionDraft.text}
              onChange={(e) => setIntentionDraft((d) => d ? { ...d, text: e.target.value } : d)}
              onKeyDown={(e) => {
                if (e.key === "Enter") confirmIntention();
                if (e.key === "Escape") setIntentionDraft(null);
              }}
              style={{
                background: "var(--surface-2)", border: "1px solid var(--border)",
                borderRadius: "var(--radius-sm)", padding: "9px 12px",
                fontSize: 14, color: "var(--text)", outline: "none", width: "100%",
                fontFamily: "inherit",
              }}
            />
            <div style={{ display: "flex", gap: 8 }}>
              <button
                onClick={confirmIntention}
                style={{
                  flex: 1, padding: "9px", borderRadius: "var(--radius-sm)",
                  background: "var(--accent)", color: "#fff", fontWeight: 600,
                  fontSize: 13, border: "none", cursor: "pointer",
                }}
              >
                ▶ Começar
              </button>
              <button
                onClick={() => {
                  if (pendingMultiCard) {
                    startMultiCardSession(pendingMultiCard.cards, pendingMultiCard.sessionMode, "");
                    setPendingMultiCard(null);
                  } else {
                    setPendingIntention("");
                    setActiveSession(intentionDraft.mode);
                  }
                  setIntentionDraft(null);
                }}
                style={{
                  padding: "9px 16px", borderRadius: "var(--radius-sm)", fontSize: 13,
                  background: "none", border: "1px solid var(--border)",
                  color: "var(--text-muted)", cursor: "pointer",
                }}
              >
                Pular
              </button>
              <button
                onClick={() => {
                  setIntentionDraft(null);
                  setPendingMultiCard(null);
                }}
                style={{
                  padding: "9px 16px", borderRadius: "var(--radius-sm)", fontSize: 13,
                  background: "none", border: "1px solid var(--border)",
                  color: "var(--text-muted)", cursor: "pointer",
                }}
              >
                Cancelar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
