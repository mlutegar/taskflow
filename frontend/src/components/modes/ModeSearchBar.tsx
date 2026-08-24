import React from "react";
import styles from "../ModesPanel.module.css";

interface ModeSearchBarProps {
  value: string;
  onChange: (value: string) => void;
  onClear: () => void;
}

export default function ModeSearchBar({ value, onChange, onClear }: ModeSearchBarProps) {
  return (
    <div className={styles.searchBar}>
      <span className={styles.searchIcon}>🔍</span>
      <input
        className={styles.searchInput}
        type="text"
        placeholder="Buscar modo…"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        aria-label="Buscar modo"
      />
      {value && (
        <button
          className={styles.searchClear}
          onClick={onClear}
          aria-label="Limpar busca"
        >
          ×
        </button>
      )}
    </div>
  );
}
