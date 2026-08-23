import { useState } from "react";
import { getPinned } from "../../../../lib/splitePinned";
import styles from "../../DailyFocus.module.css";

/**
 * Shared activity picker UI used by helpers that let the user choose
 * a "reward activity" from the pinned list (e.g. SpliteHelper, LazyFalconHelper).
 *
 * Props:
 *   label    {string}   – heading text shown above the search input
 *   onSelect {function} – called with the chosen activity string
 */

interface ActivityPickerProps {
  label?: string;
  onSelect: (activity: string) => void;
}

export default function ActivityPicker({ label = "Escolha a atividade de recompensa", onSelect }: ActivityPickerProps) {
  const [query, setQuery] = useState<string>("");
  const pinned: string[] = getPinned();

  const filtered: string[] = query
    ? pinned.filter((a) => a.toLowerCase().includes(query.toLowerCase()))
    : pinned;

  const select = (a: string): void => {
    onSelect(a);
    setQuery("");
  };

  return (
    <div className={styles.helperPanelBody}>
      <div>
        <div className={styles.helperInputLabel}>{label}</div>
        <input
          className={styles.activityInput}
          placeholder="Buscar atividade…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
        {filtered.length > 0 && (
          <div className={styles.activityResults}>
            {filtered.map((a) => (
              <div
                key={a}
                className={styles.activityResultItem}
                onClick={() => select(a)}
                role="button"
                tabIndex={0}
                aria-label={`Selecionar atividade: ${a}`}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault();
                    select(a);
                  }
                }}
              >
                {a}
              </div>
            ))}
          </div>
        )}
      </div>
      {query.trim() && !pinned.includes(query.trim()) && (
        <button
          className={styles.helperSmallBtn}
          style={{ width: "100%" }}
          onClick={() => select(query.trim())}
        >
          Usar "{query.trim()}"
        </button>
      )}
    </div>
  );
}
