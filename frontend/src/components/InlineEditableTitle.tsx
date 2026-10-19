import { useState, useEffect, useRef } from "react";
import styles from "./InlineEditableTitle.module.css";

interface InlineEditableTitleProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
}

export function InlineEditableTitle({ value, onChange, placeholder = "Título da tarefa" }: InlineEditableTitleProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [localValue, setLocalValue] = useState(value);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setLocalValue(value);
  }, [value]);

  useEffect(() => {
    if (isEditing && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [isEditing]);

  const handleSave = () => {
    const trimmed = localValue.trim();
    if (trimmed && trimmed !== value) {
      onChange(trimmed);
    } else {
      setLocalValue(value);
    }
    setIsEditing(false);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      e.preventDefault();
      handleSave();
    } else if (e.key === "Escape") {
      setLocalValue(value);
      setIsEditing(false);
    }
  };

  if (isEditing) {
    return (
      <input
        ref={inputRef}
        type="text"
        className={styles.input}
        value={localValue}
        onChange={(e) => setLocalValue(e.target.value)}
        onBlur={handleSave}
        onKeyDown={handleKeyDown}
        placeholder={placeholder}
      />
    );
  }

  return (
    <h1 className={styles.title} onClick={() => setIsEditing(true)}>
      {value || placeholder}
    </h1>
  );
}
