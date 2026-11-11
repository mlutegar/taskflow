import { useState, type FormEvent } from "react";
import Modal from "../shared/Modal";
import { useSaveStep, useSkincareProducts } from "../../hooks/useSkincare";
import { todayISO } from "../../lib/dateUtils";
import { FREQUENCY_LABELS, WEEKDAY_SHORT } from "../../lib/healthLabels";
import type { MedFrequency, Period, SkincareStep, StepInput } from "../../api/saude";
import styles from "./Health.module.css";

interface StepFormProps {
  period: Period;
  step?: SkincareStep | null;
  onClose: () => void;
}

/** Cria/edita um passo da rotina (produto + frequência própria). */
export default function StepForm({ period, step, onClose }: StepFormProps): JSX.Element {
  const save = useSaveStep();
  const { data: products = [] } = useSkincareProducts();
  const editing = !!step;

  const [productId, setProductId] = useState<string>(step?.productId ?? "");
  const [label, setLabel] = useState(step?.label ?? "");
  const [frequency, setFrequency] = useState<MedFrequency>(step?.frequency ?? "daily");
  const [daysOfWeek, setDaysOfWeek] = useState<number[]>(step?.daysOfWeek ?? []);
  const [intervalDays, setIntervalDays] = useState(String(step?.intervalDays ?? 2));
  const [startDate, setStartDate] = useState(step?.startDate ?? todayISO());
  const [error, setError] = useState<string | null>(null);

  const toggleDay = (d: number): void =>
    setDaysOfWeek((cur) => (cur.includes(d) ? cur.filter((x) => x !== d) : [...cur, d].sort()));

  const submit = (e: FormEvent): void => {
    e.preventDefault();
    setError(null);
    const productName = products.find((p) => p.id === productId)?.name ?? "";
    const finalLabel = label.trim() || productName;
    if (!finalLabel) return setError("Escolha um produto ou dê um nome ao passo.");
    if (frequency === "custom_days" && daysOfWeek.length === 0) return setError("Escolha ao menos um dia da semana.");
    const n = Number(intervalDays);
    if (frequency === "every_n_days" && !(n >= 1)) return setError("Informe o intervalo em dias.");

    const data: StepInput = {
      period,
      productId: productId || null,
      label: finalLabel,
      frequency,
      daysOfWeek: frequency === "custom_days" ? daysOfWeek : [],
      intervalDays: frequency === "every_n_days" ? Math.round(n) : null,
      startDate,
    };
    save.mutate({ id: step?.id, data }, { onSuccess: onClose });
  };

  return (
    <Modal isOpen onClose={onClose} title={editing ? "Editar passo" : "Novo passo"}>
      <form className={styles.form} onSubmit={submit} noValidate>
        <label className={styles.field}>
          Produto
          <select className={styles.input} value={productId} onChange={(e) => setProductId(e.target.value)}>
            <option value="">Sem produto (só um nome)</option>
            {products.map((p) => (
              <option key={p.id} value={p.id}>{p.name}</option>
            ))}
          </select>
        </label>
        <label className={styles.field}>
          Nome do passo {productId ? "(opcional — usa o nome do produto)" : ""}
          <input className={styles.input} value={label} onChange={(e) => setLabel(e.target.value)} maxLength={120} placeholder="Ex.: Limpar o rosto" />
        </label>

        <label className={styles.field}>
          Frequência
          <select className={styles.input} value={frequency} onChange={(e) => setFrequency(e.target.value as MedFrequency)}>
            {Object.entries(FREQUENCY_LABELS).map(([v, l]) => (
              <option key={v} value={v}>{l}</option>
            ))}
          </select>
        </label>

        {frequency === "custom_days" && (
          <div className={styles.days} role="group" aria-label="Dias da semana">
            {WEEKDAY_SHORT.map((l, d) => (
              <button
                key={d}
                type="button"
                className={`${styles.chip} ${daysOfWeek.includes(d) ? styles.active : ""}`}
                aria-pressed={daysOfWeek.includes(d)}
                onClick={() => toggleDay(d)}
              >
                {l}
              </button>
            ))}
          </div>
        )}

        {frequency === "every_n_days" && (
          <div className={styles.row}>
            <label className={styles.field}>
              A cada (dias)
              <input className={styles.input} type="number" min={1} inputMode="numeric" value={intervalDays} onChange={(e) => setIntervalDays(e.target.value)} />
            </label>
            <label className={styles.field}>
              Contando a partir de
              <input className={styles.input} type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} />
            </label>
          </div>
        )}

        {error && <div className={styles.error} role="alert">{error}</div>}

        <div className={styles.formActions}>
          <button type="button" className={styles.btn} onClick={onClose}>Cancelar</button>
          <button type="submit" className={`${styles.btn} ${styles.btnPrimary}`} disabled={save.isPending}>
            {save.isPending ? "Salvando…" : "Salvar"}
          </button>
        </div>
      </form>
    </Modal>
  );
}
