import { useState } from "react";
import Modal from "../shared/Modal";
import { useToast } from "../shared/Toast";
import { formatBRL, parseBRL } from "../../lib/money";
import { dayLabel, monthTitle, PAYMENT_LABELS } from "../../lib/financeFormat";
import {
  useDeleteEntry, useEndSeries, useFinanceCategories, useFinanceEntries, useReviseSeries, useSeriesException,
} from "../../hooks/useFinance";
import type { FinanceItem } from "../../api/financas";
import QuickAddSheet from "./QuickAddSheet";
import styles from "./Finance.module.css";

/** Lançamentos do mês agrupados por dia; tocar abre as ações do item. */
export default function EntriesTab({ month }: { month: string }): JSX.Element {
  const { data: items = [], isLoading, isError } = useFinanceEntries(month);
  const { data: categories = [] } = useFinanceCategories(true);
  const [selected, setSelected] = useState<FinanceItem | null>(null);
  const [editing, setEditing] = useState<FinanceItem | null>(null);

  if (isLoading) return <div className={styles.card}>Carregando…</div>;
  if (isError) return <div className={styles.card}>Não foi possível carregar os lançamentos.</div>;
  if (items.length === 0) return <div className={styles.empty}>Nada lançado em {monthTitle(month)}. Use o + para adicionar.</div>;

  const byId = new Map(categories.map((c) => [c.id, c]));
  const groups = new Map<string, FinanceItem[]>();
  for (const it of items) groups.set(it.date, [...(groups.get(it.date) ?? []), it]);

  return (
    <>
      {[...groups.entries()].map(([date, list]) => (
        <section key={date}>
          <div className={styles.dayHead}>{dayLabel(date)}</div>
          <div className={styles.list}>
            {list.map((it) => {
              const cat = it.categoryId ? byId.get(it.categoryId) : null;
              return (
                <button key={it.id} className={`${styles.item} ${it.skipped ? styles.itemSkipped : ""}`} onClick={() => setSelected(it)}>
                  <span className={styles.emoji}>{cat?.emoji ?? (it.type === "income" ? "💰" : "•")}</span>
                  <span className={styles.grow}>
                    {it.description || cat?.name || (it.type === "income" ? "Renda" : "Gasto")}
                    {it.kind === "monthly" && <span className={styles.badge}>🔁 mensal</span>}
                    {it.kind === "installment" && <span className={styles.badge}>{it.installmentIndex}/{it.installmentTotal}</span>}
                    {it.skipped && <span className={styles.badge}>pulado</span>}
                    <div className={styles.muted}>
                      {cat?.name ?? "Sem categoria"}
                      {it.paymentMethod ? ` · ${PAYMENT_LABELS[it.paymentMethod]}` : ""}
                    </div>
                  </span>
                  <span className={`${styles.amount} ${it.type === "income" ? styles.pos : ""}`}>
                    {it.type === "income" ? "+" : "−"} {formatBRL(it.amountCents)}
                  </span>
                </button>
              );
            })}
          </div>
        </section>
      ))}

      {selected && !editing && (
        <ItemActions item={selected} month={month} onClose={() => setSelected(null)} onEdit={() => setEditing(selected)} />
      )}
      {editing && (
        <QuickAddSheet
          editing={editing}
          defaultDate={editing.date}
          onClose={() => {
            setEditing(null);
            setSelected(null);
          }}
        />
      )}
    </>
  );
}

function ItemActions({ item, month, onClose, onEdit }: { item: FinanceItem; month: string; onClose: () => void; onEdit: () => void }): JSX.Element {
  const { showToast } = useToast();
  const del = useDeleteEntry();
  const end = useEndSeries();
  const revise = useReviseSeries();
  const exception = useSeriesException();
  const [newValue, setNewValue] = useState("");
  const [confirm, setConfirm] = useState(false);
  const isSeries = item.origin === "series" && item.seriesId;
  const isMonthly = item.kind === "monthly";

  const run = async (fn: () => Promise<unknown>, ok: string) => {
    try {
      await fn();
      showToast(ok, "success");
      onClose();
    } catch (e) {
      showToast(e instanceof Error ? e.message : "Não foi possível concluir.", "error");
    }
  };

  const newCents = parseBRL(newValue);

  return (
    <Modal isOpen onClose={onClose} title={`${formatBRL(item.amountCents)} · ${dayLabel(item.date)}`}>
      <div className={styles.actions}>
        {!isSeries && (
          <>
            <button className={styles.btn} onClick={onEdit}>Editar</button>
            {confirm ? (
              <button className={`${styles.btn} ${styles.btnDanger}`} disabled={del.isPending} onClick={() => run(() => del.mutateAsync(item.id), "Lançamento excluído")}>
                Confirmar exclusão
              </button>
            ) : (
              <button className={`${styles.btn} ${styles.btnDanger}`} onClick={() => setConfirm(true)}>Excluir</button>
            )}
          </>
        )}

        {isSeries && (
          <>
            <p className={styles.hint}>
              {isMonthly ? "Lançamento fixo mensal." : `Parcela ${item.installmentIndex} de ${item.installmentTotal}.`} Mudanças valem só de {monthTitle(month)} em diante;
              meses anteriores não são alterados.
            </p>
            <button
              className={styles.btn}
              disabled={exception.isPending}
              onClick={() => run(() => exception.mutateAsync({ id: item.seriesId!, month, skipped: !item.skipped }), item.skipped ? "Mês restaurado" : "Mês pulado")}
            >
              {item.skipped ? "Restaurar este mês" : "Pular só este mês"}
            </button>
            {isMonthly && (
              <>
                <label className={styles.field}>
                  Novo valor a partir de {monthTitle(month)}
                  <input className={styles.input} inputMode="decimal" placeholder="Ex.: 79,90" value={newValue} onChange={(e) => setNewValue(e.target.value)} />
                </label>
                <button
                  className={`${styles.btn} ${styles.btnPrimary}`}
                  disabled={newCents === null || newCents <= 0 || revise.isPending}
                  onClick={() => run(() => revise.mutateAsync({ id: item.seriesId!, data: { effectiveMonth: month, amountCents: newCents! } }), "Valor atualizado")}
                >
                  Alterar valor daqui em diante
                </button>
              </>
            )}
            <button
              className={`${styles.btn} ${styles.btnDanger}`}
              disabled={end.isPending}
              onClick={() => run(() => end.mutateAsync({ id: item.seriesId!, fromMonth: month }), isMonthly ? "Recorrência encerrada" : "Parcelas futuras encerradas")}
            >
              {isMonthly ? `Encerrar a partir de ${monthTitle(month)}` : "Encerrar parcelas daqui em diante"}
            </button>
          </>
        )}
      </div>
    </Modal>
  );
}
