import { useEffect, useRef, useState } from "react";
import { PROJECT_EMOJIS, DEFAULT_PROJECT_EMOJI } from "../lib/projectTheme";
import styles from "./EmojiPicker.module.css";

interface Props {
  value: string;
  onChange: (emoji: string) => void;
  /** Emojis exibidos na grade (default: PROJECT_EMOJIS). */
  options?: string[];
  ariaLabel?: string;
}

/**
 * Botão que abre um popover com grade de emojis + campo para colar um
 * personalizado. Fecha ao selecionar ou clicar fora. Compartilhado entre o
 * ProjectManager e o QuickCreateProject.
 */
export default function EmojiPicker({ value, onChange, options = PROJECT_EMOJIS, ariaLabel = "Escolher emoji" }: Props) {
  const [open, setOpen] = useState(false);
  const wrapRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => { if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) setOpen(false); };
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, [open]);

  return (
    <div className={styles.wrap} ref={wrapRef}>
      <button type="button" className={styles.button} aria-label={ariaLabel} aria-expanded={open} onClick={() => setOpen((v) => !v)}>
        {value || DEFAULT_PROJECT_EMOJI}
      </button>
      {open && (
        <div className={styles.popover} role="menu">
          <input
            className={styles.custom}
            aria-label="Emoji personalizado"
            placeholder="Colar emoji…"
            value={value}
            maxLength={16}
            onChange={(e) => onChange(e.target.value)}
          />
          <div className={styles.grid}>
            {options.map((emoji) => (
              <button
                key={emoji}
                type="button"
                className={`${styles.option} ${value === emoji ? styles.active : ""}`}
                onClick={() => { onChange(emoji); setOpen(false); }}
              >
                {emoji}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
