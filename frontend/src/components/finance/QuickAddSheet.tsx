import { useMemo, useState } from "react";
import Modal from "../shared/Modal";
import { useToast } from "../shared/Toast";
import { storageGet, storageSet } from "../../lib/storage";
import { centsFromDigits, formatBRL, splitCents } from "../../lib/money";
import { PAYMENT_LABELS, PAYMENT_METHODS } from "../../lib/financeFormat";
import { useCreateSeries, useFinanceCategories, useSaveEntry } from "../../hooks/useFinance";
import type { FinanceItem, FinanceType, PaymentMethod } from "../../api/financas";
import styles from "./Finance.module.css";

type Recurrence = "single" | "monthly" | "installment";

const LAST_PAYMENT_KEY = "finance.lastPayment";
const LAST_CAT_KEY = "finance.lastCategory";

interface Props {
  onClose: () => void;
  /** Data padrão (YYYY-MM-DD). */
  defaultDate: string;
  /** Lançamento real em edição (séries não passam por aqui). */
  editing?: FinanceItem | null;
}

/**
 * Adição rápida: valor em foco (teclado numérico, estilo caixa), tipo, categoria em chips.
 * "Mais opções" abre data, descrição, forma de pagamento e recorrência.
 */
export default function QuickAddSheet({ onClose, defaultDate, editing }: Props): JSX.Element {
  const { showToast } = useToast();
  const { data: categories = [] } = useFinanceCategories();
  const saveEntry = useSaveEntry();
  const createSeries = useCreateSeries();

  const [type, setType] = useState<FinanceType>(editing?.type ?? "expense");
  const [digits, setDigits] = useState(editing ? String(editing.amountCents) : "");
  const [categoryId, setCategoryId] = useState<string | null>(
    editing ? editing.categoryId : (storageGet<string | null>(`${LAST_CAT_KEY}.expense`, null) ?? null),
  );
  const [date, setDate] = useState(editing?.date ?? defaultDate);
  const [description, setDescription] = useState(editing?.description ?? "");
  const [payment, setPayment] = useState<PaymentMethod | null>(
    editing ? editing.paymentMethod : (storageGet<PaymentMethod | null>(LAST_PAYMENT_KEY, null) ?? null),
  );
  const [recurrence, setRecurrence] = useState<Recurrence>("single");
  const [installments, setInstallments] = useState("3");
  const [more, setMore] = useState(!!editing);
  const [error, setError] = useState("");

  const cents = centsFromDigits(digits);
  const n = Math.max(2, Math.min(120, Number(installments) || 2));
  const cats = useMemo(() => categories.filter((c) => c.kind === type), [categories, type]);
  const busy = saveEntry.isPending || createSeries.isPending;

  const changeType = (t: FinanceType) => {
    setType(t);
    setCategoryId(storageGet<string | null>(`${LAST_CAT_KEY}.${t}`, null) ?? null);
  };

  const submit = async () => {
    if (cents <= 0) return setError("Informe um valor maior que zero.");
    setError("");
    const base = {
      type,
      amountCents: cents,
      categoryId,
      description: description.trim() || null,
      paymentMethod: payment,
    };
    try {
      if (editing) {
        await saveEntry.mutateAsync({ id: editing.id, data: { ...base, date } });
      } else if (recurrence === "single") {
        await saveEntry.mutateAsync({ data: { ...base, date } });
      } else {
        await createSeries.mutateAsync({
          ...base,
          kind: recurrence,
          startDate: date,
          ...(recurrence === "installment" ? { installments: n } : {}),
        });
      }
      storageSet(`${LAST_CAT_KEY}.${type}`, categoryId);
      if (payment) storageSet(LAST_PAYMENT_KEY, payment);
      showToast(type === "expense" ? "Gasto lançado" : "Renda lançada", "success");
      onClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Não foi possível salvar.");
    }
  };

  return (
    <Modal isOpen onClose={onClose} title={editing ? "Editar lançamento" : "Novo lançamento"}>
      <div className={styles.form}>
        <div className={styles.seg} role="group" aria-label="Tipo">
          <button type="button" className={`${styles.segBtn} ${type === "expense" ? styles.onExpense : ""}`} onClick={() => changeType("expense")}>
            Gasto
          </button>
          <button type="button" className={`${styles.segBtn} ${type === "income" ? styles.onIncome : ""}`} onClick={() => changeType("income")}>
            Renda
          </button>
        </div>

        <label className={styles.field}>
          Valor
          <input
            className={`${styles.input} ${styles.amountInput}`}
            inputMode="numeric"
            autoFocus
            aria-label="Valor"
            value={formatBRL(cents)}
            onChange={(e) => setDigits(e.target.value.replace(/\D/g, ""))}
          />
        </label>

        <div className={styles.field}>
          Categoria
          <div className={styles.chips}>
            {cats.map((c) => (
              <button
                key={c.id}
                type="button"
                className={`${styles.chip} ${categoryId === c.id ? styles.on : ""}`}
                onClick={() => setCategoryId(categoryId === c.id ? null : c.id)}
              >
                {c.emoji} {c.name}
              </button>
            ))}
          </div>
        </div>

        {!more && !editing && (
          <button type="button" className={styles.btn} onClick={() => setMore(true)}>
            Mais opções (data, forma, recorrência)
          </button>
        )}

        {more && (
          <>
            <div className={styles.row}>
              <label className={styles.field}>
                Data
                <input className={styles.input} type="date" value={date} onChange={(e) => setDate(e.target.value)} />
              </label>
              <label className={styles.field}>
                Forma de pagamento
                <select
                  className={styles.input}
                  value={payment ?? ""}
                  onChange={(e) => setPayment((e.target.value || null) as PaymentMethod | null)}
                >
                  <option value="">—</option>
                  {PAYMENT_METHODS.map((p) => (
                    <option key={p} value={p}>{PAYMENT_LABELS[p]}</option>
                  ))}
                </select>
              </label>
            </div>
            <label className={styles.field}>
              Descrição
              <input className={styles.input} value={description} maxLength={200} onChange={(e) => setDescription(e.target.value)} placeholder="Opcional" />
            </label>

            {!editing && (
              <div className={styles.field}>
                Recorrência
                <div className={styles.seg} role="group" aria-label="Recorrência">
                  {([["single", "Único"], ["monthly", "Fixo mensal"], ["installment", "Parcelado"]] as const).map(([v, label]) => (
                    <button key={v} type="button" className={`${styles.segBtn} ${recurrence === v ? styles.on : ""}`} onClick={() => setRecurrence(v)}>
                      {label}
                    </button>
                  ))}
                </div>
                {recurrence === "installment" && (
                  <>
                    <label className={styles.field}>
                      Nº de parcelas (valor acima = total)
                      <input className={styles.input} inputMode="numeric" value={installments} onChange={(e) => setInstallments(e.target.value.replace(/\D/g, ""))} />
                    </label>
                    {cents > 0 && cents >= n && (
                      <span className={styles.hint}>
                        {n}× de {formatBRL(splitCents(cents, n)[1] ?? cents)}
                        {splitCents(cents, n)[0] !== splitCents(cents, n)[1] ? ` (1ª de ${formatBRL(splitCents(cents, n)[0])})` : ""}
                      </span>
                    )}
                  </>
                )}
                {recurrence === "monthly" && <span className={styles.hint}>Repete todo mês no mesmo dia, a partir da data escolhida.</span>}
              </div>
            )}
          </>
        )}

        {error && <div className={styles.error} role="alert">{error}</div>}
        <button type="button" className={`${styles.btn} ${styles.btnPrimary} ${styles.btnBlock}`} disabled={busy} onClick={submit}>
          {busy ? "Salvando…" : "Salvar"}
        </button>
      </div>
    </Modal>
  );
}
