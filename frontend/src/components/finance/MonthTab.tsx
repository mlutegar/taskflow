import { Cell, Pie, PieChart, ResponsiveContainer } from "recharts";
import { formatBRL } from "../../lib/money";
import { monthTitle } from "../../lib/financeFormat";
import { useFinanceCategories, useFinanceSummary } from "../../hooks/useFinance";
import type { FinanceType } from "../../api/financas";
import styles from "./Finance.module.css";

const PALETTE = ["#6366f1", "#22c55e", "#f59e0b", "#ef4444", "#06b6d4", "#a855f7", "#ec4899", "#84cc16", "#f97316", "#14b8a6"];

function Delta({ cents, pct, goodWhenDown }: { cents: number; pct: number | null; goodWhenDown?: boolean }): JSX.Element {
  if (cents === 0) return <span className={styles.delta}>igual ao mês anterior</span>;
  const up = cents > 0;
  const good = goodWhenDown ? !up : up;
  return (
    <span className={`${styles.delta} ${good ? styles.pos : styles.neg}`}>
      {up ? "▲" : "▼"} {formatBRL(Math.abs(cents))}
      {pct !== null ? ` (${Math.abs(pct).toLocaleString("pt-BR")}%)` : ""} vs. mês anterior
    </span>
  );
}

/** Visão do mês: entradas, saídas, saldo, gastos por categoria (rosca) e comparação com o mês anterior. */
export default function MonthTab({ month, onAdd }: { month: string; onAdd?: (type: FinanceType) => void }): JSX.Element {
  const { data, isLoading, isError } = useFinanceSummary(month);
  const { data: categories = [] } = useFinanceCategories(true);

  if (isLoading) return <div className={styles.card}>Carregando…</div>;
  if (isError || !data) return <div className={styles.card}>Não foi possível carregar o resumo.</div>;

  const byId = new Map(categories.map((c) => [c.id, c]));
  const rows = data.byCategory.map((c, i) => {
    const cat = c.categoryId ? byId.get(c.categoryId) : null;
    return {
      ...c,
      name: cat?.name ?? "Sem categoria",
      emoji: cat?.emoji ?? "•",
      color: cat?.color ?? PALETTE[i % PALETTE.length],
    };
  });

  return (
    <>
      <div className={styles.kpis}>
        <button type="button" className={`${styles.kpi} ${styles.kpiBtn}`} onClick={() => onAdd?.("income")} aria-label="Adicionar ganho">
          <span className={styles.kpiLabel}>Entradas</span>
          <span className={`${styles.kpiValue} ${styles.pos}`}>{formatBRL(data.incomeCents)}</span>
          <Delta cents={data.delta.incomeCents} pct={data.delta.incomePct} />
        </button>
        <button type="button" className={`${styles.kpi} ${styles.kpiBtn}`} onClick={() => onAdd?.("expense")} aria-label="Adicionar gasto">
          <span className={styles.kpiLabel}>Saídas</span>
          <span className={`${styles.kpiValue} ${styles.neg}`}>{formatBRL(data.expenseCents)}</span>
          <Delta cents={data.delta.expenseCents} pct={data.delta.expensePct} goodWhenDown />
        </button>
        <div className={`${styles.kpi} ${styles.kpiBalance}`}>
          <span className={styles.kpiLabel}>Saldo do mês</span>
          <span className={`${styles.kpiValue} ${data.balanceCents < 0 ? styles.neg : styles.pos}`}>{formatBRL(data.balanceCents)}</span>
          <span className={styles.delta}>Mês anterior ({monthTitle(data.previousMonth)}): {formatBRL(data.previous.balanceCents)}</span>
        </div>
      </div>

      <section className={styles.card} aria-label="Gastos por categoria">
        <h2 className={styles.cardTitle}>Gastos por categoria</h2>
        {rows.length === 0 ? (
          <div className={styles.empty}>Nenhum gasto neste mês.</div>
        ) : (
          <>
            <div className={styles.chartWrap} aria-hidden="true">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie data={rows} dataKey="totalCents" nameKey="name" innerRadius={50} outerRadius={80} paddingAngle={2} stroke="none">
                    {rows.map((r) => (
                      <Cell key={r.categoryId ?? "none"} fill={r.color} />
                    ))}
                  </Pie>
                </PieChart>
              </ResponsiveContainer>
            </div>
            <div>
              {rows.map((r) => (
                <div key={r.categoryId ?? "none"} className={styles.catRow}>
                  <span className={styles.dot} style={{ background: r.color }} />
                  <span className={styles.grow}>{r.emoji} {r.name}</span>
                  <span className={styles.muted}>{r.pct}%</span>
                  <span className={styles.amount}>{formatBRL(r.totalCents)}</span>
                </div>
              ))}
            </div>
          </>
        )}
      </section>
    </>
  );
}
