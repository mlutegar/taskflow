/**
 * RoutineConsistencyCard — card "Consistência das Rotinas" no topo da aba Tarefas.
 *
 * Mostra um heatmap estilo GitHub da conclusão das rotinas diárias.
 *
 * Desktop: dois selects no cabeçalho (período + rotina) e rodapé completo.
 * Mobile:  um único pill "Últimos 6 meses ▾" que abre um bottom sheet com
 *          período, filtro de rotina, melhor sequência e legenda; o rodapé fica
 *          em uma linha só e também abre o sheet ao ser tocado.
 */

import { useMemo, useState } from "react";
import { BarChart3, ChevronDown } from "lucide-react";

import styles from "./routineHeatmap.module.css";
import HeatmapGrid from "./HeatmapGrid";
import HeatmapStats from "./HeatmapStats";
import HeatmapOptionsSheet from "./HeatmapOptionsSheet";
import { useRoutineConsistency } from "../../hooks/useRoutineConsistency";
import { useIsMobile } from "../../hooks/useIsMobile";
import { RANGE_OPTIONS, type HeatmapCell, type HeatmapRange } from "../../lib/routineConsistency";

const SKELETON_WEEKS = 26;

function skeletonGrid(): HeatmapCell[][] {
  return Array.from({ length: SKELETON_WEEKS }, () =>
    Array.from({ length: 7 }, () => ({
      date: "", expected: 0, completed: 0, level: null, isToday: false,
      expectedIdx: [], completedIdx: [],
    } as HeatmapCell)),
  );
}

export default function RoutineConsistencyCard(): JSX.Element {
  const {
    range, setRange, routines, routineId, setRoutineId,
    weeks, monthLabels, stats, isLoading, isEmpty,
  } = useRoutineConsistency();

  const isMobile = useIsMobile();
  const [sheetOpen, setSheetOpen] = useState(false);

  const placeholder = useMemo(skeletonGrid, []);
  const showPlaceholder = isLoading || weeks.length === 0;
  const gridWeeks = showPlaceholder ? placeholder : weeks;
  const gridLabels = showPlaceholder ? new Array(SKELETON_WEEKS).fill("") : monthLabels;

  const rangeLabel = RANGE_OPTIONS.find((o) => o.value === range)?.label ?? "Período";
  const activeRoutine = routineId ? routines.find((r) => r.id === routineId) : null;

  return (
    <div className={`${styles.panel} ${isMobile ? styles.panelMobile : ""}`}>
      <div className={styles.header}>
        <div>
          <span className={styles.titleRow}>
            <BarChart3 size={15} aria-hidden />
            <span className={styles.title}>
              {isMobile ? "Consistência das rotinas" : "Consistência das Rotinas"}
            </span>
          </span>
          <div className={styles.subtitle}>
            {isMobile ? "Acompanhe sua evolução diária" : "Veja sua consistência diária nas rotinas"}
          </div>
        </div>

        {isMobile ? (
          <button
            className={styles.rangePill}
            onClick={() => setSheetOpen(true)}
            aria-haspopup="dialog"
            aria-label="Opções do heatmap"
          >
            {activeRoutine ? activeRoutine.title : rangeLabel}
            <ChevronDown size={14} aria-hidden />
          </button>
        ) : (
          <div className={styles.filters}>
            {routines.length > 1 && (
              <select
                className={styles.rangeSelect}
                value={routineId ?? ""}
                onChange={(e) => setRoutineId(e.target.value || null)}
                aria-label="Filtrar por rotina"
                title="Filtrar por rotina"
              >
                <option value="">Todas as rotinas</option>
                {routines.map((routine) => (
                  <option key={routine.id} value={routine.id}>{routine.title}</option>
                ))}
              </select>
            )}

            <select
              className={styles.rangeSelect}
              value={range}
              onChange={(e) => setRange(e.target.value as HeatmapRange)}
              aria-label="Período do heatmap"
            >
              {RANGE_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>{option.label}</option>
              ))}
            </select>
          </div>
        )}
      </div>

      <div className={styles.body}>
        <HeatmapGrid
          weeks={gridWeeks}
          monthLabels={gridLabels}
          routines={routines}
          loading={showPlaceholder}
          compact={isMobile}
        />
        {isEmpty && (
          <div className={styles.empty}>
            Ainda não há histórico de rotinas — conclua uma rotina hoje para começar.
          </div>
        )}
      </div>

      <HeatmapStats
        stats={stats}
        compact={isMobile}
        onOpenDetails={isMobile ? () => setSheetOpen(true) : undefined}
      />

      {isMobile && (
        <HeatmapOptionsSheet
          open={sheetOpen}
          onClose={() => setSheetOpen(false)}
          range={range}
          onRangeChange={setRange}
          routines={routines}
          routineId={routineId}
          onRoutineChange={setRoutineId}
          bestStreak={stats.bestStreak}
        />
      )}
    </div>
  );
}
