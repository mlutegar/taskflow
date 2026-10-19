/**
 * HeatmapGrid — grade semanal (colunas = semanas, linhas = dias da semana).
 *
 * No mobile o tamanho da célula é derivado da largura disponível para que o
 * período de 6 meses caiba inteiro sem scroll. Quando nem no tamanho mínimo
 * cabe (ex.: "Último ano"), volta a rolar na horizontal, já posicionado no fim.
 *
 * O detalhe do dia aparece no hover (desktop) e no toque (mobile), listando
 * QUAIS rotinas estavam agendadas e quais foram concluídas.
 */

import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { Check } from "lucide-react";

import styles from "./routineHeatmap.module.css";
import {
  cellRoutines,
  cellTooltip,
  prettyDate,
  weekdayRowLabels,
  type HeatmapCell,
} from "../../lib/routineConsistency";
import type { RoutineConsistencyRoutine } from "../../api/tasks";

const LEVEL_CLASS: Record<string, string> = {
  "0": styles.cell0,
  "1": styles.cell1,
  "2": styles.cell2,
  "3": styles.cell3,
  "4": styles.cell4,
};

/** Quantas rotinas listar antes de resumir com "+N". */
const MAX_LINES = 8;

/** Limites do lado da célula (px) ao calcular para caber na largura. */
const CELL_MIN = 7;
const CELL_MAX = 14;

interface HeatmapGridProps {
  weeks: HeatmapCell[][];
  monthLabels: string[];
  routines: RoutineConsistencyRoutine[];
  /** Renderiza a grade em modo esqueleto (carregando). */
  loading?: boolean;
  /** Mobile: célula calculada pela largura, rótulos de dia com uma letra. */
  compact?: boolean;
}

export default function HeatmapGrid({
  weeks,
  monthLabels,
  routines,
  loading = false,
  compact = false,
}: HeatmapGridProps): JSX.Element {
  const scrollRef = useRef<HTMLDivElement | null>(null);
  // Célula fixada por clique/toque — sobrevive ao mouse sair.
  const [pinned, setPinned] = useState<HeatmapCell | null>(null);
  const [hovered, setHovered] = useState<HeatmapCell | null>(null);
  // null = usa o tamanho do CSS (desktop).
  const [cellSize, setCellSize] = useState<number | null>(null);
  const active = pinned ?? hovered;

  const gap = compact ? 2 : 3;

  /** Maior célula que faz as N semanas caberem na largura disponível. */
  const measure = useCallback(() => {
    const el = scrollRef.current;
    if (!el || !compact || weeks.length === 0) {
      setCellSize(null);
      return;
    }
    // clientWidth já desconta o padding do card; tiramos a coluna de rótulos.
    const labels = el.querySelector(`.${styles.dayLabels}`) as HTMLElement | null;
    const available = el.clientWidth - (labels?.offsetWidth ?? 0) - 6;
    if (available <= 0) return;
    const raw = Math.floor(available / weeks.length) - gap;
    setCellSize(Math.max(CELL_MIN, Math.min(CELL_MAX, raw)));
  }, [compact, weeks.length, gap]);

  useLayoutEffect(() => {
    measure();
    const el = scrollRef.current;
    if (!el || typeof ResizeObserver === "undefined") return;
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, [measure]);

  // Abre já rolado até a semana mais recente (só importa quando não coube).
  useLayoutEffect(() => {
    const el = scrollRef.current;
    if (el) el.scrollLeft = el.scrollWidth;
  }, [weeks.length, cellSize]);

  // Toque fora da grade solta a célula fixada.
  useEffect(() => {
    if (!pinned) return;
    const close = (e: PointerEvent) => {
      if (!scrollRef.current?.contains(e.target as Node)) setPinned(null);
    };
    document.addEventListener("pointerdown", close);
    return () => document.removeEventListener("pointerdown", close);
  }, [pinned]);

  const dayLabels = weekdayRowLabels(compact);
  const lines = active ? cellRoutines(active, routines) : [];

  const sizeVars = cellSize
    ? ({ "--hm-cell": `${cellSize}px`, "--hm-gap": `${gap}px` } as React.CSSProperties)
    : undefined;

  return (
    <>
      <div
        className={`${styles.gridWrap} ${compact ? styles.gridWrapCompact : ""}`}
        ref={scrollRef}
        style={sizeVars}
      >
        <div className={styles.dayLabels} aria-hidden>
          {dayLabels.map((label, i) => (
            <span key={i} className={styles.dayLabel}>{label}</span>
          ))}
        </div>

        <div className={styles.gridInner}>
          <div className={styles.monthRow} aria-hidden>
            {monthLabels.map((label, i) => (
              <span key={i} className={styles.monthCell}>{label}</span>
            ))}
          </div>

          <div className={styles.grid} role="grid" aria-label="Heatmap de consistência das rotinas">
            {weeks.map((week, wi) => (
              <div key={wi} className={styles.week} role="row">
                {week.map((cell, di) => {
                  if (!cell.date) {
                    return <span key={di} className={`${styles.cell} ${styles.cellEmpty}`} aria-hidden />;
                  }
                  const classes = [styles.cell];
                  if (loading) classes.push(styles.skeletonCell);
                  else if (cell.level === null) classes.push(styles.cellNone);
                  else classes.push(LEVEL_CLASS[String(cell.level)]);
                  if (cell.isToday) classes.push(styles.cellToday);
                  if (pinned?.date === cell.date) classes.push(styles.cellActive);
                  if (!loading) classes.push(styles.cellInteractive);

                  const label = cellTooltip(cell);
                  return (
                    <button
                      key={cell.date}
                      type="button"
                      role="gridcell"
                      className={classes.join(" ")}
                      title={label}
                      aria-label={label}
                      onMouseEnter={() => setHovered(cell)}
                      onMouseLeave={() => setHovered((c) => (c?.date === cell.date ? null : c))}
                      onFocus={() => setHovered(cell)}
                      onBlur={() => setHovered(null)}
                      onClick={() => setPinned((c) => (c?.date === cell.date ? null : cell))}
                    />
                  );
                })}
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Detalhe do dia */}
      <div className={styles.detail} role="status" aria-live="polite">
        {active?.date && (
          <>
            <div className={styles.detailHead}>
              <strong>{prettyDate(active.date)}</strong>
              {active.expected === 0
                ? <span> · sem rotina agendada</span>
                : <span> · {active.completed} de {active.expected} rotina{active.expected === 1 ? "" : "s"}</span>}
            </div>
            {lines.length > 0 && (
              <ul className={styles.detailList}>
                {lines.slice(0, MAX_LINES).map((line) => (
                  <li
                    key={line.id}
                    className={`${styles.detailItem} ${line.done ? styles.detailDone : ""}`}
                  >
                    <span className={`${styles.detailMark} ${line.done ? styles.detailMarkDone : ""}`}>
                      {line.done && <Check size={9} strokeWidth={3} />}
                    </span>
                    {line.title}
                  </li>
                ))}
                {lines.length > MAX_LINES && (
                  <li className={styles.detailMore}>+{lines.length - MAX_LINES} outras</li>
                )}
              </ul>
            )}
          </>
        )}
      </div>
    </>
  );
}
