import { useState } from "react";
import { randomSong } from "../../../lib/singableSongs";
import styles from "../DailyFocus.module.css";

interface Variant {
  id: string;
  label: string;
}

const VARIANTS: Variant[] = [
  { id: "one", label: "1 Música" },
  { id: "ten", label: "10 Músicas" },
];

interface QueueItem {
  name: string;
  done: boolean;
}

interface SingState {
  variant: string;
  suggestion: string | null;
  queue: QueueItem[];
  currentSong: string;
}

export const DEFAULT_STATE: SingState = { variant: "one", suggestion: null, queue: [], currentSong: "" };

interface SingHelperProps {
  state: Partial<SingState>;
  onChange: (state: SingState) => void;
}

export default function SingHelper({ state, onChange }: SingHelperProps): JSX.Element {
  const s: SingState = { ...DEFAULT_STATE, ...state };
  const [queueInput, setQueueInput] = useState<string>("");

  const setField = (field: keyof SingState, val: unknown): void => onChange({ ...s, [field]: val });

  const reroll = (): void => {
    setField("suggestion", randomSong(s.suggestion));
  };

  const addToQueue = (song: string): void => {
    if (!song.trim()) return;
    const updated = [...(s.queue || []), { name: song.trim(), done: false }].slice(0, 10);
    onChange({ ...s, queue: updated });
    setQueueInput("");
  };

  const toggleQueue = (i: number): void => {
    const updated = (s.queue || []).map((item: QueueItem, idx: number) =>
      idx === i ? { ...item, done: !item.done } : item
    );
    onChange({ ...s, queue: updated });
  };

  return (
    <div className={styles.helperPanelBody}>
      <div className={styles.variantRow}>
        {VARIANTS.map((v) => (
          <button
            key={v.id}
            className={`${styles.variantBtn} ${s.variant === v.id ? styles.variantBtnActive : ""}`}
            onClick={() => setField("variant", v.id)}
          >
            {v.label}
          </button>
        ))}
      </div>

      {s.variant === "one" && (
        <>
          <div>
            <div className={styles.helperInputLabel}>Sugestão aleatória</div>
            <div className={styles.helperRow}>
              <div className={styles.helperInput} style={{ flex: 1 }}>
                {s.suggestion || <span style={{ color: "var(--text-muted)" }}>—</span>}
              </div>
              <button className={styles.helperSmallBtn} onClick={reroll}>🎲</button>
            </div>
          </div>
          <div>
            <div className={styles.helperInputLabel}>Música que cantei</div>
            <input
              className={styles.helperInput}
              placeholder="Ex: Bohemian Rhapsody"
              value={s.currentSong}
              onChange={(e) => setField("currentSong", e.target.value)}
            />
          </div>
        </>
      )}

      {s.variant === "ten" && (
        <>
          <div>
            <div className={styles.helperInputLabel}>
              Fila de músicas ({(s.queue || []).length}/10)
            </div>
            <div className={styles.helperRow}>
              <input
                className={styles.helperInput}
                placeholder="Nome da música"
                value={queueInput}
                onChange={(e) => setQueueInput(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && addToQueue(queueInput)}
                disabled={(s.queue || []).length >= 10}
              />
              <button
                className={styles.helperSmallBtn}
                onClick={() => addToQueue(queueInput)}
                disabled={(s.queue || []).length >= 10}
              >
                +
              </button>
            </div>
          </div>
          {(s.queue || []).length > 0 && (
            <div className={styles.queueList}>
              {s.queue.map((item: QueueItem, i: number) => (
                <div key={i} className={`${styles.queueItem} ${item.done ? styles.queueItemDone : ""}`}>
                  <div
                    className={`${styles.queueCheck} ${item.done ? styles.queueCheckDone : ""}`}
                    onClick={() => toggleQueue(i)}
                  >
                    {item.done ? "✓" : ""}
                  </div>
                  <span>{item.name}</span>
                </div>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}
