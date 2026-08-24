import { useState, useRef, useCallback, useMemo } from "react";
import ModePicker from "./ModePicker";
import ComboAnalytics from "./ComboAnalytics";
import styles from "./SlotBoard.module.css";
import { getMultiCardSessions } from "../lib/multiCardSessionLog";
import { getUsageLogs } from "../lib/sessionUsageLog";

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
  [key: string]: unknown;
}

interface CardSlot {
  slotId: string;
  mode: ModeConfig;
}

type SessionMode = 'sequential' | 'parallel';

interface SlotBoardProps {
  onStartSession: (cards: ModeConfig[], mode: SessionMode) => void;
}

const LS_KEY = "taskflow.slotBoard";
const LS_MODE_KEY = "taskflow.sessionMode";
const TEMPLATES_KEY = "taskflow.sessionTemplates";

// ── Templates ──────────────────────────────────────────────────────────────

interface SessionTemplate {
  id: string;
  name: string;
  cards: ModeConfig[];
}

function loadTemplates(): SessionTemplate[] {
  try {
    const raw = localStorage.getItem(TEMPLATES_KEY);
    return raw ? (JSON.parse(raw) as SessionTemplate[]) : [];
  } catch {
    return [];
  }
}

function saveTemplates(templates: SessionTemplate[]): void {
  try {
    localStorage.setItem(TEMPLATES_KEY, JSON.stringify(templates));
  } catch {}
}

// ── Smart suggestions ──────────────────────────────────────────────────────

interface Suggestion {
  ids: string[];
  label: string;
}

function computeSuggestions(): Suggestion[] {
  try {
    const sessions = getMultiCardSessions();
    const comboCount: Record<string, number> = {};
    for (const s of sessions) {
      if (s.cards && s.cards.length >= 1) {
        const key = [...s.cards].sort().join(",");
        comboCount[key] = (comboCount[key] ?? 0) + 1;
      }
    }

    const usageLogs = getUsageLogs();
    const singleCount: Record<string, number> = {};
    for (const log of usageLogs) {
      if (log.modeId) {
        singleCount[log.modeId] = (singleCount[log.modeId] ?? 0) + 1;
      }
    }

    const results: Suggestion[] = [];

    const sortedCombos = Object.entries(comboCount)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 2);

    for (const [key] of sortedCombos) {
      results.push({ ids: key.split(","), label: "Combo frequente" });
    }

    if (results.length < 2) {
      const topSingles = Object.entries(singleCount)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 2)
        .map(([id]) => id);
      if (topSingles.length > 0) {
        results.push({ ids: topSingles, label: "Modos favoritos" });
      }
    }

    return results.slice(0, 3);
  } catch {
    return [];
  }
}

const DEFAULT_SUGGESTIONS: Suggestion[] = [
  { ids: ["music", "pomodoro"], label: "Sugestao popular" },
];

function loadSlots(): CardSlot[] {
  try {
    const raw = localStorage.getItem(LS_KEY);
    return raw ? (JSON.parse(raw) as CardSlot[]) : [];
  } catch {
    return [];
  }
}

function saveSlots(slots: CardSlot[]): void {
  try {
    localStorage.setItem(LS_KEY, JSON.stringify(slots));
  } catch {}
}

let _slotIdCounter = Date.now();
function nextSlotId(): string {
  return `slot_${++_slotIdCounter}`;
}

export default function SlotBoard({ onStartSession }: SlotBoardProps): JSX.Element {
  const [slots, setSlotsRaw] = useState<CardSlot[]>(loadSlots);
  const [showPicker, setShowPicker] = useState<boolean>(false);
  const [pickerSlotId, setPickerSlotId] = useState<string | null>(null);
  const [sessionMode, setSessionMode] = useState<SessionMode>(() => {
    const saved = localStorage.getItem(LS_MODE_KEY);
    return (saved === 'parallel' ? 'parallel' : 'sequential') as SessionMode;
  });
  const [showAnalytics, setShowAnalytics] = useState<boolean>(false);

  // Templates
  const [templates, setTemplatesState] = useState<SessionTemplate[]>(loadTemplates);
  const [saveTemplateName, setSaveTemplateName] = useState<string>("");
  const [showSaveInput, setShowSaveInput] = useState<boolean>(false);

  // Smart suggestions
  const suggestions = useMemo(() => {
    const computed = computeSuggestions();
    return computed.length > 0 ? computed : DEFAULT_SUGGESTIONS;
  }, []);

  // Known modes cache (for suggestions → load)
  const knownModes = useRef<Map<string, ModeConfig>>(new Map());

  // Drag state (desktop HTML5)
  const dragIndex = useRef<number>(-1);
  const [overIndex, setOverIndex] = useState<number>(-1);

  // Touch drag state (mobile)
  const touchDragIndex = useRef<number>(-1);
  const touchOverIndex = useRef<number>(-1);
  const [touchDraggingIndex, setTouchDraggingIndex] = useState<number>(-1);
  const slotRefs = useRef<(HTMLDivElement | null)[]>([]);

  const setSlots = useCallback((updater: CardSlot[] | ((prev: CardSlot[]) => CardSlot[])) => {
    setSlotsRaw((prev) => {
      const next = typeof updater === "function" ? updater(prev) : updater;
      saveSlots(next);
      return next;
    });
  }, []);

  // ── Mode picker ────────────────────────────────────────────────────────────
  const openPicker = (slotId?: string): void => {
    setPickerSlotId(slotId || null);
    setShowPicker(true);
  };

  const handleSelectMode = (mode: ModeConfig): void => {
    knownModes.current.set(mode.id, mode);
    setShowPicker(false);
    if (pickerSlotId) {
      // Replace existing slot
      setSlots((prev) =>
        prev.map((s) => (s.slotId === pickerSlotId ? { ...s, mode } : s))
      );
    } else {
      // Add new slot
      setSlots((prev) => [...prev, { slotId: nextSlotId(), mode }]);
    }
    setPickerSlotId(null);
  };

  const handleRemove = (slotId: string): void => {
    setSlots((prev) => prev.filter((s) => s.slotId !== slotId));
  };

  // ── Templates ──────────────────────────────────────────────────────────────
  const setTemplates = useCallback((next: SessionTemplate[]) => {
    setTemplatesState(next);
    saveTemplates(next);
  }, []);

  const handleSaveTemplate = (): void => {
    const name = saveTemplateName.trim() || `Template ${templates.length + 1}`;
    const newTemplate: SessionTemplate = {
      id: `tpl_${Date.now()}`,
      name,
      cards: slots.map((s) => s.mode),
    };
    setTemplates([...templates, newTemplate]);
    setSaveTemplateName("");
    setShowSaveInput(false);
  };

  const handleLoadTemplate = (template: SessionTemplate): void => {
    setSlots(template.cards.map((mode) => ({ slotId: nextSlotId(), mode })));
  };

  const handleDeleteTemplate = (id: string): void => {
    setTemplates(templates.filter((t) => t.id !== id));
  };

  // ── Suggestions ────────────────────────────────────────────────────────────
  const handleLoadSuggestion = (suggestion: Suggestion): void => {
    const modes: ModeConfig[] = suggestion.ids
      .map((id) => knownModes.current.get(id))
      .filter((m): m is ModeConfig => m !== undefined);
    if (modes.length === 0) {
      openPicker();
      return;
    }
    setSlots(modes.map((mode) => ({ slotId: nextSlotId(), mode })));
  };

  // ── Touch drag (mobile) ────────────────────────────────────────────────────
  const handleTouchStart = (e: React.TouchEvent, index: number): void => {
    e.stopPropagation();
    touchDragIndex.current = index;
    touchOverIndex.current = index;
    setTouchDraggingIndex(index);
  };

  const handleTouchMove = (e: React.TouchEvent): void => {
    if (touchDragIndex.current === -1) return;
    e.preventDefault();
    const touch = e.touches[0];
    const el = document.elementFromPoint(touch.clientX, touch.clientY);
    if (!el) return;
    let target: Element | null = el;
    while (target) {
      const idx = slotRefs.current.findIndex((ref) => ref === target);
      if (idx !== -1) {
        touchOverIndex.current = idx;
        setOverIndex(idx);
        break;
      }
      target = target.parentElement;
    }
  };

  const handleTouchEnd = (): void => {
    const from = touchDragIndex.current;
    const to = touchOverIndex.current;
    if (from !== -1 && to !== -1 && from !== to) {
      setSlots((prev) => {
        const next = [...prev];
        const [moved] = next.splice(from, 1);
        next.splice(to, 0, moved);
        return next;
      });
    }
    touchDragIndex.current = -1;
    touchOverIndex.current = -1;
    setTouchDraggingIndex(-1);
    setOverIndex(-1);
  };

  // ── Drag to reorder ────────────────────────────────────────────────────────
  const handleDragStart = (index: number): void => {
    dragIndex.current = index;
  };

  const handleDragOver = (e: React.DragEvent, index: number): void => {
    e.preventDefault();
    setOverIndex(index);
  };

  const handleDrop = (dropIndex: number): void => {
    const from = dragIndex.current;
    if (from === -1 || from === dropIndex) {
      setOverIndex(-1);
      return;
    }
    setSlots((prev) => {
      const next = [...prev];
      const [moved] = next.splice(from, 1);
      next.splice(dropIndex, 0, moved);
      return next;
    });
    dragIndex.current = -1;
    setOverIndex(-1);
  };

  const handleDragEnd = (): void => {
    dragIndex.current = -1;
    setOverIndex(-1);
  };

  // ── Session mode toggle ────────────────────────────────────────────────────
  const handleToggleMode = (mode: SessionMode): void => {
    setSessionMode(mode);
    localStorage.setItem(LS_MODE_KEY, mode);
  };

  // ── Start session ──────────────────────────────────────────────────────────
  const handleStart = (): void => {
    if (slots.length === 0) return;
    onStartSession(slots.map((s) => s.mode), sessionMode);
  };

  const selectedIds = slots.map((s) => s.mode.id);

  if (showPicker) {
    return (
      <ModePicker
        onSelect={handleSelectMode}
        onClose={() => { setShowPicker(false); setPickerSlotId(null); }}
        selectedIds={selectedIds}
      />
    );
  }

  return (
    <div className={styles.root}>
      <div className={styles.header}>
        <h2 className={styles.title}>Minha sessão</h2>
        <p className={styles.subtitle}>
          Monte os modos que vai usar e inicie quando estiver pronto.
        </p>
      </div>

      <div className={styles.cardsList}>
        {/* ── Empty state + smart suggestions ── */}
        {slots.length === 0 && (
          <>
            <div className={styles.emptyState}>
              <span className={styles.emptyEmoji}>🧩</span>
              <span className={styles.emptyTitle}>Nenhum modo ainda</span>
              <span className={styles.emptyDesc}>
                Adicione modos abaixo para montar a sua sessão de foco.
              </span>
            </div>

            <div className={styles.suggestionsSection}>
              <span className={styles.suggestionsLabel}>Sugestoes para voce</span>
              <div className={styles.suggestionsList}>
                {suggestions.map((s, i) => (
                  <button
                    key={i}
                    className={styles.suggestionChip}
                    onClick={() => handleLoadSuggestion(s)}
                    title={s.ids.join(" + ")}
                  >
                    <span className={styles.suggestionChipLabel}>{s.label}</span>
                    <span className={styles.suggestionChipIds}>{s.ids.join(" + ")}</span>
                  </button>
                ))}
              </div>
            </div>
          </>
        )}

        {/* ── Saved templates ── */}
        {templates.length > 0 && (
          <div className={styles.templatesSection}>
            <span className={styles.templatesLabel}>Templates salvos</span>
            <div className={styles.templatesList}>
              {templates.map((tpl) => (
                <div key={tpl.id} className={styles.templateChip}>
                  <button
                    className={styles.templateChipName}
                    onClick={() => handleLoadTemplate(tpl)}
                    title={`Carregar: ${tpl.name}`}
                  >
                    {tpl.name}
                  </button>
                  <button
                    className={styles.templateChipDelete}
                    onClick={() => handleDeleteTemplate(tpl.id)}
                    aria-label={`Excluir template ${tpl.name}`}
                  >
                    ×
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ── Filled slots ── */}
        {slots.map((slot, index) => (
          <div
            key={slot.slotId}
            ref={(el) => { slotRefs.current[index] = el; }}
            className={[
              styles.slot,
              dragIndex.current === index ? styles.dragging : "",
              touchDraggingIndex === index ? styles.touchDragging : "",
              overIndex === index ? styles.dragOver : "",
            ].join(" ")}
            draggable
            onDragStart={() => handleDragStart(index)}
            onDragOver={(e) => handleDragOver(e, index)}
            onDrop={() => handleDrop(index)}
            onDragEnd={handleDragEnd}
          >
            {/* Drag handle — touch drag initiates here */}
            <span
              className={styles.dragHandle}
              title="Arrastar para reordenar"
              onTouchStart={(e) => handleTouchStart(e, index)}
              onTouchMove={handleTouchMove}
              onTouchEnd={handleTouchEnd}
            >
              ⠿
            </span>

            {/* Order badge */}
            <span className={styles.orderBadge}>{index + 1}</span>

            {/* Emoji */}
            <span
              className={styles.modeEmoji}
              style={{ background: slot.mode.colorBg || "rgba(255,255,255,0.05)" }}
            >
              {slot.mode.emoji}
            </span>

            {/* Info */}
            <span className={styles.modeMeta}>
              <span className={styles.modeName}>{slot.mode.name}</span>
              <span className={styles.modeTagline}>{slot.mode.tagline}</span>
            </span>

            {/* Remove */}
            <button
              className={styles.removeBtn}
              onClick={() => handleRemove(slot.slotId)}
              aria-label={`Remover ${slot.mode.name}`}
            >
              ×
            </button>
          </div>
        ))}

        {/* ── Add slot button ── */}
        <button className={styles.addSlot} onClick={() => openPicker()}>
          <span className={styles.addSlotIcon}>+</span>
          <span className={styles.addSlotText}>Adicionar modo</span>
        </button>

        {/* ── Save as template ── */}
        {slots.length >= 1 && (
          <div className={styles.saveTemplateRow}>
            {showSaveInput ? (
              <>
                <input
                  className={styles.saveTemplateInput}
                  type="text"
                  placeholder="Nome do template..."
                  value={saveTemplateName}
                  onChange={(e) => setSaveTemplateName(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") handleSaveTemplate();
                    if (e.key === "Escape") setShowSaveInput(false);
                  }}
                  autoFocus
                />
                <button className={styles.saveTemplateConfirm} onClick={handleSaveTemplate}>
                  Salvar
                </button>
                <button className={styles.saveTemplateCancel} onClick={() => setShowSaveInput(false)}>
                  ×
                </button>
              </>
            ) : (
              <button className={styles.saveTemplateBtn} onClick={() => setShowSaveInput(true)}>
                + Salvar como template
              </button>
            )}
          </div>
        )}
      </div>

      {/* Footer */}
      <div className={styles.footer}>
        {/* Session mode toggle */}
        <div className={styles.modeToggle}>
          <span className={styles.modeToggleLabel}>Modo:</span>
          <button
            className={`${styles.modeToggleBtn} ${sessionMode === 'sequential' ? styles.modeToggleActive : ''}`}
            onClick={() => handleToggleMode('sequential')}
            title="Executa os modos em sequência, um de cada vez"
          >
            ➡ Sequencial
          </button>
          <button
            className={`${styles.modeToggleBtn} ${sessionMode === 'parallel' ? styles.modeToggleActive : ''}`}
            onClick={() => handleToggleMode('parallel')}
            title="Todos os modos ficam disponíveis ao mesmo tempo em abas"
          >
            ⊞ Paralelo
          </button>
        </div>

        <button
          className={styles.startBtn}
          onClick={handleStart}
          disabled={slots.length === 0}
        >
          ▶ Iniciar sessão
        </button>

        {slots.length > 0 && (
          <button
            className={styles.clearBtn}
            onClick={() => setSlots([])}
          >
            Limpar tudo
          </button>
        )}

        {slots.length === 0 && (
          <p className={styles.startHint}>
            Adicione pelo menos 1 modo para iniciar
          </p>
        )}

        <button
          className={styles.analyticsBtn}
          onClick={() => setShowAnalytics((v) => !v)}
        >
          {showAnalytics ? "▲ Ocultar análises" : "📊 Ver análises"}
        </button>
      </div>

      {showAnalytics && <ComboAnalytics />}
    </div>
  );
}
