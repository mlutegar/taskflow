/**
 * HeatmapStats — rodapé do card de consistência.
 *
 * Desktop: sequência atual · melhor sequência · % concluídos + legenda.
 * Mobile:  uma linha só — tendência à esquerda, % em verde-água à direita.
 *          Melhor sequência e legenda migram para o bottom sheet, e tocar no
 *          rodapé abre esse sheet.
 */

import { Flame, Trophy, CheckCircle2, TrendingUp } from "lucide-react";

import styles from "./routineHeatmap.module.css";
import type { HeatmapStatsData } from "../../lib/routineConsistency";

const LEGEND_CLASSES = [styles.cell0, styles.cell1, styles.cell2, styles.cell3, styles.cell4];

function plural(n: number): string {
  return n === 1 ? "dia" : "dias";
}

interface HeatmapStatsProps {
  stats: HeatmapStatsData;
  /** Mobile: rodapé em uma linha. */
  compact?: boolean;
  /** Quando presente, o rodapé inteiro vira botão e abre o sheet de opções. */
  onOpenDetails?: () => void;
}

export default function HeatmapStats({ stats, compact = false, onOpenDetails }: HeatmapStatsProps): JSX.Element {
  if (compact) {
    return (
      <button
        type="button"
        className={`${styles.stats} ${styles.statsCompact}`}
        onClick={onOpenDetails}
        aria-label="Ver mais detalhes de consistência"
      >
        <span className={styles.stat}>
          <TrendingUp size={14} aria-hidden />
          Sequência atual: <strong>{stats.currentStreak} {plural(stats.currentStreak)}</strong>
        </span>

        <span className={`${styles.stat} ${styles.statDone}`}>
          <CheckCircle2 size={14} aria-hidden />
          {stats.pct}% concluídos
        </span>
      </button>
    );
  }

  return (
    <div className={styles.stats}>
      <span className={styles.stat}>
        <Flame size={13} color="var(--streak)" aria-hidden />
        Sequência atual: <strong>{stats.currentStreak} {plural(stats.currentStreak)}</strong>
      </span>

      <span className={styles.divider} aria-hidden />

      <span className={styles.stat}>
        <Trophy size={13} color="var(--streak)" aria-hidden />
        Melhor sequência: <strong>{stats.bestStreak} {plural(stats.bestStreak)}</strong>
      </span>

      <span className={styles.divider} aria-hidden />

      <span className={styles.stat}>
        <CheckCircle2 size={13} color="var(--progress)" aria-hidden />
        Dias concluídos: <strong>{stats.pct}%</strong> ({stats.doneDays} de {stats.eligibleDays})
      </span>

      <span className={styles.legend} aria-hidden>
        Menos
        {LEGEND_CLASSES.map((cls, i) => (
          <span key={i} className={`${styles.legendCell} ${cls}`} />
        ))}
        Mais
      </span>
    </div>
  );
}
