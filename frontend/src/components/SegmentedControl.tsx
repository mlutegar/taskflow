import { useRef, useEffect } from "react";
import styles from "./SegmentedControl.module.css";

interface SegmentedControlOption {
  label: string;
  value: string;
}

interface SegmentedControlProps {
  options: SegmentedControlOption[];
  value: string;
  onChange: (value: string) => void;
}

export function SegmentedControl({ options, value, onChange }: SegmentedControlProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const activeRef = useRef<HTMLButtonElement>(null);

  // Scroll ativo para visualização ao montar
  useEffect(() => {
    if (activeRef.current && containerRef.current) {
      const container = containerRef.current;
      const active = activeRef.current;
      const scrollLeft = active.offsetLeft - container.offsetWidth / 2 + active.offsetWidth / 2;
      container.scrollTo({ left: scrollLeft, behavior: "smooth" });
    }
  }, [value]);

  return (
    <div ref={containerRef} className={styles.container}>
      <div className={styles.track}>
        {options.map((option) => {
          const isActive = option.value === value;
          return (
            <button
              key={option.value}
              ref={isActive ? activeRef : null}
              className={`${styles.option} ${isActive ? styles.active : ""}`}
              onClick={() => onChange(option.value)}
              type="button"
            >
              {option.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}
