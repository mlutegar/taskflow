import { useState, useMemo } from "react";
import { MODES, CATEGORY_BY_ID, CATEGORY_ORDER } from "../data/modes";
import { getCustomModes } from "../lib/customModes";
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
  [key: string]: unknown;
}

interface ModePickerProps {
  onSelect: (mode: ModeConfig) => void;
  onClose: () => void;
  /** IDs de modos já selecionados (não desabilita, mas pode indicar visualmente) */
  selectedIds?: string[];
}

const ALL_CATEGORIES = ["Todos", ...CATEGORY_ORDER.filter((c) => c !== "Personalizados"), "Personalizados"];

export default function ModePicker({ onSelect, onClose, selectedIds = [] }: ModePickerProps): JSX.Element {
  const [search, setSearch] = useState<string>("");
  const [category, setCategory] = useState<string>("Todos");

  const allModes = useMemo<ModeConfig[]>(() => {
    const custom = getCustomModes().map((m: ModeConfig) => ({ ...m, isCustom: true, category: "Personalizados" }));
    return [...(MODES as ModeConfig[]), ...custom];
  }, []);

  const filtered = useMemo<ModeConfig[]>(() => {
    let list = allModes;

    if (category !== "Todos") {
      list = list.filter((m) => {
        const cat = m.category || (CATEGORY_BY_ID as Record<string, string>)[m.id] || "Outros";
        return cat === category;
      });
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

    return list;
  }, [allModes, category, search]);

  return (
    <div className={styles.overlay}>
      {/* Header */}
      <div className={styles.header}>
        <button className={styles.backBtn} onClick={onClose} aria-label="Voltar">
          ←
        </button>
        <span className={styles.headerTitle}>Escolher modo</span>
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

      {/* Mode list */}
      <div className={styles.list}>
        {filtered.length === 0 && (
          <p className={styles.empty}>Nenhum modo encontrado.</p>
        )}
        {filtered.map((mode) => {
          const isSelected = selectedIds.includes(mode.id);
          return (
            <button
              key={mode.id}
              className={styles.modeCard}
              onClick={() => onSelect(mode)}
              style={{ opacity: isSelected ? 0.6 : 1 }}
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
                </span>
                <span className={styles.modeTagline}>{mode.tagline}</span>
              </span>
              <span className={styles.modeArrow}>›</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
