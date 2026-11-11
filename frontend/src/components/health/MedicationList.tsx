import { useState } from "react";
import { Archive, ArchiveRestore, Pencil, Plus, Trash2 } from "lucide-react";
import {
  useArchiveMedication,
  useDeleteMedication,
  useMedications,
} from "../../hooks/useMedications";
import type { Medication } from "../../api/saude";
import MedicationForm from "./MedicationForm";
import StockBadge from "./StockBadge";
import { formatQty } from "../../lib/healthFormat";
import styles from "./Health.module.css";

const WEEKDAYS = ["dom", "seg", "ter", "qua", "qui", "sex", "sáb"];

function frequencyLabel(m: Medication): string {
  switch (m.frequency) {
    case "daily": return "Todos os dias";
    case "weekdays": return "Segunda a sexta";
    case "custom_days": return m.daysOfWeek.map((d) => WEEKDAYS[d]).join(", ");
    case "every_n_days": return `A cada ${m.intervalDays} dias`;
  }
}

export default function MedicationList(): JSX.Element {
  const [showArchived, setShowArchived] = useState(false);
  const { data, isLoading, isError, refetch } = useMedications(showArchived);
  const archive = useArchiveMedication();
  const remove = useDeleteMedication();
  const [editing, setEditing] = useState<Medication | null>(null);
  const [creating, setCreating] = useState(false);

  const confirmDelete = (m: Medication): void => {
    const ok = window.confirm(
      `Excluir "${m.name}" de vez?\n\nIsso apaga TAMBÉM todo o histórico de doses deste remédio e não pode ser desfeito.\n\nPara só parar de usar, prefira "Arquivar".`
    );
    if (ok) remove.mutate(m.id);
  };

  return (
    <>
      <div className={styles.toolbar}>
        <button className={`${styles.btn} ${styles.btnPrimary}`} onClick={() => setCreating(true)}>
          <Plus size={16} aria-hidden="true" /> Novo remédio
        </button>
        <button
          className={`${styles.chip} ${showArchived ? styles.active : ""}`}
          aria-pressed={showArchived}
          onClick={() => setShowArchived((v) => !v)}
        >
          Mostrar arquivados
        </button>
      </div>

      {isLoading && <div className={styles.empty}>Carregando…</div>}
      {isError && (
        <div className={styles.empty}>
          Não foi possível carregar.{" "}
          <button className={styles.btn} onClick={() => refetch()}>Tentar de novo</button>
        </div>
      )}
      {data && data.length === 0 && (
        <div className={styles.empty}>Nenhum remédio cadastrado ainda.</div>
      )}

      <ul className={styles.list}>
        {data?.map((m) => (
          <li key={m.id} className={`${styles.card} ${styles.med} ${m.active ? "" : styles.archived}`}>
            <div className={styles.medHead}>
              <div>
                <div className={styles.medName}>{m.name}</div>
                <div className={styles.medSub}>
                  {m.dose ? `${m.dose} · ` : ""}
                  {frequencyLabel(m)}
                  {m.endDate ? ` · até ${m.endDate.split("-").reverse().join("/")}` : ""}
                  {!m.active ? " · arquivado" : ""}
                </div>
              </div>
              <StockBadge stockQty={m.stockQty} lowStock={m.lowStock} daysLeft={m.daysLeft} />
            </div>
            <div className={styles.medTimes}>
              {m.schedules.map((s) => (
                <span key={s.id} className={styles.time}>
                  {s.time} · {formatQty(s.doseQty)} un.
                </span>
              ))}
            </div>
            <div className={styles.medActions}>
              {m.active && (
                <button className={styles.btn} onClick={() => setEditing(m)}>
                  <Pencil size={14} aria-hidden="true" /> Editar
                </button>
              )}
              <button
                className={styles.btn}
                onClick={() => archive.mutate({ id: m.id, active: !m.active })}
                disabled={archive.isPending}
              >
                {m.active ? <Archive size={14} aria-hidden="true" /> : <ArchiveRestore size={14} aria-hidden="true" />}
                {m.active ? "Arquivar" : "Reativar"}
              </button>
              {!m.active && (
                <button className={`${styles.btn} ${styles.btnDanger}`} onClick={() => confirmDelete(m)} disabled={remove.isPending}>
                  <Trash2 size={14} aria-hidden="true" /> Excluir…
                </button>
              )}
            </div>
          </li>
        ))}
      </ul>

      {(creating || editing) && (
        <MedicationForm
          key={editing?.id ?? "new"}
          medication={editing}
          onClose={() => {
            setCreating(false);
            setEditing(null);
          }}
        />
      )}
    </>
  );
}
