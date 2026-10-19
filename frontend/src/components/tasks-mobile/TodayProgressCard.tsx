/**
 * TodayProgressCard — "Seu progresso hoje" (mobile).
 *
 * Mostra quantas rotinas do dia já foram concluídas. É a barra de progresso que
 * saiu do card "Rotina diária", agora promovida ao topo da tela.
 *
 * Recebe os números prontos: quem calcula é a página, a partir da mesma lista
 * de tarefas que alimenta o painel de rotinas — então os dois nunca divergem.
 */

import styles from "./todayProgressCard.module.css";

interface TodayProgressCardProps {
  done: number;
  total: number;
}

export default function TodayProgressCard({ done, total }: TodayProgressCardProps): JSX.Element | null {
  // Sem rotinas não há progresso a mostrar — o card sumiria vazio.
  if (total === 0) return null;

  const pct = Math.round((done / total) * 100);

  return (
    <section className={styles.card} aria-label="Seu progresso hoje">
      <div className={styles.info}>
        <h2 className={styles.title}>Seu progresso hoje</h2>
        <p className={styles.subtitle}>
          {done} de {total} rotina{total === 1 ? "" : "s"} concluída{total === 1 ? "" : "s"}
        </p>

        <div
          className={styles.bar}
          role="progressbar"
          aria-valuenow={pct}
          aria-valuemin={0}
          aria-valuemax={100}
        >
          <div className={styles.fill} style={{ width: `${pct}%` }} />
        </div>
      </div>

      <strong className={styles.pct}>{pct}%</strong>
    </section>
  );
}
