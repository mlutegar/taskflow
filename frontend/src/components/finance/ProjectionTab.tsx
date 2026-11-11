import { useState } from "react";
import { Bar, BarChart, CartesianGrid, Cell, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { AlertTriangle } from "lucide-react";
import { useToast } from "../shared/Toast";
import { todayISO } from "../../lib/dateUtils";
import { centsFromDigits, formatBRL } from "../../lib/money";
import { currentMonth, monthTitle } from "../../lib/financeFormat";
import { useFinanceSettings, useProjection, useSaveSettings } from "../../hooks/useIncomes";
import styles from "./Finance.module.css";

type Scenario = "confirmed" | "withProbable";

const shortMonth = (m: string) => `${m.slice(5, 7)}/${m.slice(2, 4)}`;

/** Projeção de 3 a 6 meses com dois cenários, saldo inicial editável e alerta de mês negativo. */
export default function ProjectionTab(): JSX.Element {
  const [months, setMonths] = useState(6);
  const [scenario, setScenario] = useState<Scenario>("confirmed");
  const from = currentMonth();
  const { data, isLoading, isError } = useProjection(from, months);

  const key = scenario === "confirmed" ? "confirmedBalanceCents" : "withProbableBalanceCents";
  const negatives = data ? data.negativeMonths[scenario] : [];

  return (
    <>
      <SettingsCard />

      <div className={styles.row}>
        <div className={styles.seg} role="group" aria-label="Cenário">
          <button className={`${styles.segBtn} ${scenario === "confirmed" ? styles.on : ""}`} onClick={() => setScenario("confirmed")}>Só confirmadas</button>
          <button className={`${styles.segBtn} ${scenario === "withProbable" ? styles.on : ""}`} onClick={() => setScenario("withProbable")}>+ Prováveis</button>
        </div>
        <label className={styles.field} style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
          Meses
          <select className={styles.input} value={months} onChange={(e) => setMonths(Number(e.target.value))} aria-label="Quantidade de meses">
            {[3, 4, 5, 6].map((n) => <option key={n} value={n}>{n}</option>)}
          </select>
        </label>
      </div>

      {isLoading && <div className={styles.card}>Carregando…</div>}
      {isError && <div className={styles.card}>Não foi possível carregar a projeção.</div>}

      {data && (
        <>
          {negatives.length > 0 && (
            <div className={styles.card} role="alert" style={{ borderColor: "var(--danger)" }}>
              <strong className={styles.neg} style={{ display: "flex", gap: 6, alignItems: "center" }}>
                <AlertTriangle size={16} aria-hidden="true" /> Saldo negativo previsto
              </strong>
              <div className={styles.muted}>{negatives.map(monthTitle).join(", ")}</div>
            </div>
          )}

          <section className={styles.card} aria-label="Saldo projetado">
            <h2 className={styles.cardTitle}>Saldo no fim de cada mês</h2>
            <div className={styles.chartWrap}>
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={data.months.map((m) => ({ label: shortMonth(m.month), value: m[key] }))}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
                  <XAxis dataKey="label" tick={{ fontSize: 11 }} />
                  <YAxis tick={{ fontSize: 11 }} width={48} tickFormatter={(v: number) => `${Math.round(v / 100)}`} />
                  <Tooltip formatter={(v: number) => formatBRL(v)} />
                  <ReferenceLine y={0} stroke="var(--text-muted)" />
                  <Bar dataKey="value" radius={[4, 4, 0, 0]}>
                    {data.months.map((m) => <Cell key={m.month} fill={m[key] < 0 ? "#ef4444" : "#22c55e"} />)}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </section>

          <section className={styles.card} aria-label="Detalhe por mês">
            <h2 className={styles.cardTitle}>Mês a mês</h2>
            <div className={styles.catRow}>
              <span className={styles.grow}>Saldo de partida ({monthTitle(data.from)})</span>
              <span className={styles.amount}>{formatBRL(data.startingBalanceCents)}</span>
            </div>
            {data.months.map((m) => {
              const expected = m.expectedConfirmedCents + (scenario === "withProbable" ? m.expectedProbableCents : 0);
              const bal = m[key];
              return (
                <div key={m.month} className={styles.catRow} style={{ flexWrap: "wrap" }}>
                  <span className={styles.grow}>
                    {monthTitle(m.month)}
                    <div className={styles.muted}>
                      + {formatBRL(m.incomeCents + expected)} · − {formatBRL(m.expenseCents)}
                      {expected > 0 ? ` (previstas ${formatBRL(expected)})` : ""}
                    </div>
                  </span>
                  <span className={`${styles.amount} ${bal < 0 ? styles.neg : styles.pos}`}>{formatBRL(bal)}</span>
                </div>
              );
            })}
            <p className={styles.hint}>
              Inclui lançamentos, fixos, parcelas e rendas previstas ainda não recebidas. Rendas incertas nunca entram.
            </p>
          </section>
        </>
      )}
    </>
  );
}

/** Saldo inicial + data de referência. */
function SettingsCard(): JSX.Element {
  const { showToast } = useToast();
  const { data } = useFinanceSettings();
  const save = useSaveSettings();
  const [digits, setDigits] = useState<string | null>(null);
  const [negative, setNegative] = useState<boolean | null>(null);
  const [date, setDate] = useState<string | null>(null);

  if (!data) return <div className={styles.card}>Carregando saldo inicial…</div>;
  const abs = digits ?? String(Math.abs(data.openingBalanceCents));
  const neg = negative ?? data.openingBalanceCents < 0;
  const cents = centsFromDigits(abs) * (neg ? -1 : 1);
  const refDate = date ?? data.openingDate ?? todayISO();
  const dirty = digits !== null || negative !== null || date !== null;

  const onSave = async () => {
    try {
      await save.mutateAsync({ openingBalanceCents: cents, openingDate: refDate });
      setDigits(null);
      setNegative(null);
      setDate(null);
      showToast("Saldo inicial salvo", "success");
    } catch (e) {
      showToast(e instanceof Error ? e.message : "Não foi possível salvar.", "error");
    }
  };

  return (
    <section className={styles.card} aria-label="Saldo inicial">
      <h2 className={styles.cardTitle}>Saldo inicial</h2>
      <div className={styles.row}>
        <label className={styles.field}>
          Quanto você tinha
          <input className={styles.input} inputMode="numeric" aria-label="Saldo inicial" value={formatBRL(Math.abs(cents)) } onChange={(e) => setDigits(e.target.value.replace(/\D/g, ""))} />
        </label>
        <label className={styles.field}>
          Em (data)
          <input className={styles.input} type="date" value={refDate} onChange={(e) => setDate(e.target.value)} />
        </label>
      </div>
      <label className={styles.hint} style={{ display: "flex", gap: 6, alignItems: "center", marginTop: 8 }}>
        <input type="checkbox" checked={neg} onChange={(e) => setNegative(e.target.checked)} /> Saldo negativo (devendo)
      </label>
      <p className={styles.hint}>A projeção soma os lançamentos a partir desta data. Sem saldo inicial, ela parte de zero no mês atual.</p>
      <button className={`${styles.btn} ${styles.btnPrimary}`} disabled={!dirty || save.isPending} onClick={onSave}>Salvar saldo inicial</button>
    </section>
  );
}
