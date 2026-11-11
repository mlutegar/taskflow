import { useMemo, useState } from "react";
import { Check, X } from "lucide-react";
import { useMedicationHistory } from "../../hooks/useMedications";
import { daysAgoISO, todayISO } from "../../lib/dateUtils";
import type { HistoryEntry } from "../../api/saude";
import { formatQty } from "../../lib/healthFormat";
import styles from "./Health.module.css";

const RANGES = [
  { label: "7 dias", days: 6 },
  { label: "30 dias", days: 29 },
  { label: "90 dias", days: 89 },
];

function dayLabel(iso: string): string {
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(y, m - 1, d).toLocaleDateString("pt-BR", { weekday: "long", day: "2-digit", month: "short" });
}

/** Histórico de doses (tomei / não tomei) agrupado por dia. */
export default function IntakeHistory(): JSX.Element {
  const [days, setDays] = useState(6);
  const to = todayISO();
  const from = daysAgoISO(days);
  const { data, isLoading, isError } = useMedicationHistory(from, to);

  const groups = useMemo(() => {
    const map = new Map<string, HistoryEntry[]>();
    for (const e of data ?? []) map.set(e.date, [...(map.get(e.date) ?? []), e]);
    return Array.from(map.entries());
  }, [data]);

  return (
    <>
      <div className={styles.subtabs}>
        {RANGES.map((r) => (
          <button
            key={r.days}
            className={`${styles.chip} ${days === r.days ? styles.active : ""}`}
            onClick={() => setDays(r.days)}
          >
            {r.label}
          </button>
        ))}
      </div>

      {isLoading && <div className={styles.empty}>Carregando…</div>}
      {isError && <div className={styles.empty}>Não foi possível carregar o histórico.</div>}
      {data && groups.length === 0 && <div className={styles.empty}>Sem registros neste período.</div>}

      {groups.map(([date, entries]) => (
        <section key={date}>
          <div className={styles.histDay}>{dayLabel(date)}</div>
          {entries.map((e) => (
            <div key={e.id} className={styles.hist}>
              {e.status === "taken" ? (
                <Check size={16} className={styles.histOk} aria-label="Tomei" />
              ) : (
                <X size={16} className={styles.histSkip} aria-label="Não tomei" />
              )}
              <span style={{ fontVariantNumeric: "tabular-nums" }}>{e.scheduledTime}</span>
              <span style={{ flex: 1 }}>
                {e.medicationName}
                {e.dose ? ` · ${e.dose}` : ""}
              </span>
              <span className={styles.histSkip}>{formatQty(e.doseQty)} un.</span>
            </div>
          ))}
        </section>
      ))}
    </>
  );
}
