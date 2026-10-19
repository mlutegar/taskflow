/**
 * HeatmapOptionsSheet — bottom sheet de opções do heatmap (mobile).
 *
 * No mobile não cabem dois selects + estatísticas + legenda no cabeçalho do
 * card. Tudo isso vive aqui: período, filtro por rotina, melhor sequência e a
 * legenda Menos/Mais. O estado continua em `useRoutineConsistency`; este
 * componente só lê e dispara os setters.
 */

import { useEffect } from "react";
import { Trophy, X, Check } from "lucide-react";

import styles from "./heatmapOptionsSheet.module.css";
import heatmap from "./routineHeatmap.module.css";
import { RANGE_OPTIONS, type HeatmapRange } from "../../lib/routineConsistency";
import type { RoutineConsistencyRoutine } from "../../api/tasks";

const LEGEND_CLASSES = [heatmap.cell0, heatmap.cell1, heatmap.cell2, heatmap.cell3, heatmap.cell4];

interface HeatmapOptionsSheetProps {
  open: boolean;
  onClose: () => void;
  range: HeatmapRange;
  onRangeChange: (range: HeatmapRange) => void;
  routines: RoutineConsistencyRoutine[];
  routineId: string | null;
  onRoutineChange: (id: string | null) => void;
  bestStreak: number;
}

export default function HeatmapOptionsSheet({
  open,
  onClose,
  range,
  onRangeChange,
  routines,
  routineId,
  onRoutineChange,
  bestStreak,
}: HeatmapOptionsSheetProps): JSX.Element {
  // Esc fecha; com o sheet aberto, a página atrás não rola.
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    document.addEventListener("keydown", onKey);
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = previous;
    };
  }, [open, onClose]);

  return (
    <div className={`${styles.overlay} ${open ? styles.open : ""}`} aria-hidden={!open}>
      <div className={styles.backdrop} onClick={onClose} />

      <div className={styles.sheet} role="dialog" aria-modal="true" aria-label="Opções do heatmap">
        <div className={styles.grabber} aria-hidden />

        <div className={styles.header}>
          <strong className={styles.title}>Consistência</strong>
          <button className={styles.closeBtn} onClick={onClose} aria-label="Fechar">
            <X size={18} />
          </button>
        </div>

        <div className={styles.content}>
          <section className={styles.section}>
            <h3 className={styles.sectionTitle}>Período</h3>
            <div className={styles.options}>
              {RANGE_OPTIONS.map((option) => (
                <button
                  key={option.value}
                  className={`${styles.option} ${range === option.value ? styles.optionActive : ""}`}
                  onClick={() => onRangeChange(option.value)}
                >
                  {option.label}
                  {range === option.value && <Check size={15} />}
                </button>
              ))}
            </div>
          </section>

          {routines.length > 1 && (
            <section className={styles.section}>
              <h3 className={styles.sectionTitle}>Rotina</h3>
              <div className={styles.options}>
                <button
                  className={`${styles.option} ${routineId === null ? styles.optionActive : ""}`}
                  onClick={() => onRoutineChange(null)}
                >
                  Todas as rotinas
                  {routineId === null && <Check size={15} />}
                </button>
                {routines.map((routine) => (
                  <button
                    key={routine.id}
                    className={`${styles.option} ${routineId === routine.id ? styles.optionActive : ""}`}
                    onClick={() => onRoutineChange(routine.id)}
                  >
                    <span className={styles.optionLabel}>{routine.title}</span>
                    {routineId === routine.id && <Check size={15} />}
                  </button>
                ))}
              </div>
            </section>
          )}

          <section className={styles.section}>
            <div className={styles.best}>
              <Trophy size={15} color="var(--streak)" aria-hidden />
              Melhor sequência: <strong>{bestStreak} {bestStreak === 1 ? "dia" : "dias"}</strong>
            </div>

            <div className={styles.legend}>
              Menos
              {LEGEND_CLASSES.map((cls, i) => (
                <span key={i} className={`${styles.legendCell} ${cls}`} />
              ))}
              Mais
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}
