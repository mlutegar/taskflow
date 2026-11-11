import { useState, type FormEvent } from "react";
import { Plus, Trash2 } from "lucide-react";
import Modal from "../shared/Modal";
import { useSaveMedication } from "../../hooks/useMedications";
import { todayISO } from "../../lib/dateUtils";
import type { MedFrequency, Medication, MedicationInput } from "../../api/saude";
import styles from "./Health.module.css";

const WEEKDAYS = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];
const FREQ_LABELS: Record<MedFrequency, string> = {
  daily: "Todos os dias",
  weekdays: "Segunda a sexta",
  custom_days: "Dias da semana específicos",
  every_n_days: "A cada N dias",
};

interface ScheduleRow {
  id?: string;
  time: string;
  doseQty: string; // texto p/ permitir digitar "0,5"
}

interface MedicationFormProps {
  medication?: Medication | null;
  onClose: () => void;
}

function toNumber(v: string): number {
  return Number(v.replace(",", "."));
}

export default function MedicationForm({ medication, onClose }: MedicationFormProps): JSX.Element {
  const save = useSaveMedication();
  const editing = !!medication;

  const [name, setName] = useState(medication?.name ?? "");
  const [dose, setDose] = useState(medication?.dose ?? "");
  const [frequency, setFrequency] = useState<MedFrequency>(medication?.frequency ?? "daily");
  const [daysOfWeek, setDaysOfWeek] = useState<number[]>(medication?.daysOfWeek ?? []);
  const [intervalDays, setIntervalDays] = useState<string>(String(medication?.intervalDays ?? 2));
  const [startDate, setStartDate] = useState(medication?.startDate ?? todayISO());
  const [endDate, setEndDate] = useState(medication?.endDate ?? "");
  const [stockQty, setStockQty] = useState(String(medication?.stockQty ?? 0));
  const [threshold, setThreshold] = useState(String(medication?.lowStockThreshold ?? 5));
  const [schedules, setSchedules] = useState<ScheduleRow[]>(
    medication?.schedules.length
      ? medication.schedules.map((s) => ({ id: s.id, time: s.time, doseQty: String(s.doseQty) }))
      : [{ time: "08:00", doseQty: "1" }]
  );
  const [error, setError] = useState<string | null>(null);

  const toggleDay = (d: number): void =>
    setDaysOfWeek((cur) => (cur.includes(d) ? cur.filter((x) => x !== d) : [...cur, d].sort()));

  const updateRow = (i: number, patch: Partial<ScheduleRow>): void =>
    setSchedules((rows) => rows.map((r, idx) => (idx === i ? { ...r, ...patch } : r)));

  const submit = (e: FormEvent): void => {
    e.preventDefault();
    setError(null);
    if (!name.trim()) return setError("Informe o nome do remédio.");
    if (schedules.length === 0) return setError("Adicione ao menos um horário.");
    if (frequency === "custom_days" && daysOfWeek.length === 0) return setError("Escolha ao menos um dia da semana.");
    if (frequency === "every_n_days" && !(toNumber(intervalDays) >= 1)) return setError("Informe o intervalo em dias.");
    if (endDate && endDate < startDate) return setError("A data final não pode ser antes da inicial.");
    const qty = toNumber(stockQty);
    const thr = toNumber(threshold);
    if (!(qty >= 0) || !(thr >= 0)) return setError("Estoque inválido.");
    const rows = schedules.map((s) => ({ ...s, qty: toNumber(s.doseQty) }));
    if (rows.some((s) => !/^([01]\d|2[0-3]):[0-5]\d$/.test(s.time))) return setError("Horário inválido.");
    if (rows.some((s) => !(s.qty > 0))) return setError("A dose de cada horário deve ser maior que zero.");

    const data: MedicationInput = {
      name: name.trim(),
      dose: dose.trim() || null,
      frequency,
      daysOfWeek: frequency === "custom_days" ? daysOfWeek : [],
      intervalDays: frequency === "every_n_days" ? Math.round(toNumber(intervalDays)) : null,
      startDate,
      endDate: endDate || null,
      stockQty: qty,
      lowStockThreshold: thr,
      schedules: rows.map((s) => ({ ...(s.id ? { id: s.id } : {}), time: s.time, doseQty: s.qty })),
    };
    save.mutate({ id: medication?.id, data }, { onSuccess: onClose });
  };

  return (
    <Modal isOpen onClose={onClose} title={editing ? "Editar remédio" : "Novo remédio"}>
      <form className={styles.form} onSubmit={submit} noValidate>
        <label className={styles.field}>
          Nome
          <input className={styles.input} value={name} onChange={(e) => setName(e.target.value)} maxLength={120} autoFocus={!editing} />
        </label>
        <label className={styles.field}>
          Dose (ex.: 50 mg)
          <input className={styles.input} value={dose} onChange={(e) => setDose(e.target.value)} maxLength={120} />
        </label>

        <label className={styles.field}>
          Frequência
          <select className={styles.input} value={frequency} onChange={(e) => setFrequency(e.target.value as MedFrequency)}>
            {Object.entries(FREQ_LABELS).map(([v, l]) => (
              <option key={v} value={v}>{l}</option>
            ))}
          </select>
        </label>

        {frequency === "custom_days" && (
          <div className={styles.days} role="group" aria-label="Dias da semana">
            {WEEKDAYS.map((l, d) => (
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
          <label className={styles.field}>
            A cada quantos dias (conta a partir da data de início)
            <input className={styles.input} type="number" min={1} inputMode="numeric" value={intervalDays} onChange={(e) => setIntervalDays(e.target.value)} />
          </label>
        )}

        <div className={styles.row}>
          <label className={styles.field}>
            Início
            <input className={styles.input} type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} required />
          </label>
          <label className={styles.field}>
            Fim (opcional)
            <input className={styles.input} type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} />
          </label>
        </div>

        <div className={styles.field}>
          Horários e quantidade por dose
          {schedules.map((s, i) => (
            <div className={styles.scheduleRow} key={s.id ?? `new-${i}`}>
              <label className={styles.field}>
                <span>Hora</span>
                <input className={styles.input} type="time" value={s.time} onChange={(e) => updateRow(i, { time: e.target.value })} />
              </label>
              <label className={styles.field}>
                <span>Unidades</span>
                <input className={styles.input} inputMode="decimal" value={s.doseQty} onChange={(e) => updateRow(i, { doseQty: e.target.value })} />
              </label>
              <button
                type="button"
                className={`${styles.btn} ${styles.btnIcon}`}
                onClick={() => setSchedules((rows) => rows.filter((_, idx) => idx !== i))}
                aria-label={`Remover horário ${s.time}`}
                title="Remover horário (o histórico é preservado)"
              >
                <Trash2 size={16} aria-hidden="true" />
              </button>
            </div>
          ))}
          <button type="button" className={`${styles.btn} ${styles.btnGhost}`} onClick={() => setSchedules((r) => [...r, { time: "20:00", doseQty: "1" }])}>
            <Plus size={16} aria-hidden="true" /> Adicionar horário
          </button>
        </div>

        <div className={styles.row}>
          <label className={styles.field}>
            Estoque (unidades)
            <input className={styles.input} inputMode="decimal" value={stockQty} onChange={(e) => setStockQty(e.target.value)} />
          </label>
          <label className={styles.field}>
            Avisar quando ≤
            <input className={styles.input} inputMode="decimal" value={threshold} onChange={(e) => setThreshold(e.target.value)} />
          </label>
        </div>

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
