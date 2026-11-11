import { Check, Undo2, SkipForward } from "lucide-react";
import { useSetIntake, useTodayDoses } from "../../hooks/useMedications";
import { todayISO } from "../../lib/dateUtils";
import { timeToDate } from "../../lib/medicationReminders";
import type { TodayDose } from "../../api/saude";
import StockBadge from "./StockBadge";
import { formatQty } from "../../lib/healthFormat";
import styles from "./Health.module.css";

/** Checklist de doses de hoje: tomei / não tomei por horário, com estoque. */
export default function TodayDoses(): JSX.Element {
  const date = todayISO();
  const { data, isLoading, isError, refetch } = useTodayDoses(date);
  const setIntake = useSetIntake(date);

  if (isLoading) return <div className={styles.empty}>Carregando…</div>;
  if (isError || !data) {
    return (
      <div className={styles.empty}>
        Não foi possível carregar as doses.{" "}
        <button className={styles.btn} onClick={() => refetch()}>Tentar de novo</button>
      </div>
    );
  }

  const items = data.items;
  if (items.length === 0) {
    return <div className={styles.empty}>Nenhum remédio para hoje. Cadastre em “Remédios”.</div>;
  }

  const taken = items.filter((i) => i.status === "taken").length;
  const lowStock = Array.from(
    new Map(items.filter((i) => i.lowStock).map((i) => [i.medicationId, i])).values()
  );
  const now = new Date();

  const mark = (item: TodayDose, status: "taken" | "skipped" | "pending"): void => {
    setIntake.mutate({ scheduleId: item.scheduleId, status });
  };

  return (
    <>
      <div className={styles.progress}>
        {taken} de {items.length} doses tomadas hoje
      </div>

      {lowStock.length > 0 && (
        <div className={styles.alert} role="status">
          <span aria-hidden="true">⚠️</span>
          <span>
            Estoque acabando: {lowStock.map((i) => `${i.name} (${formatQty(i.stockQty)})`).join(", ")}.
          </span>
        </div>
      )}

      <ul className={styles.list}>
        {items.map((item) => {
          const done = item.status !== "pending";
          const late = item.status === "pending" && timeToDate(item.time, now) < now;
          return (
            <li
              key={item.scheduleId}
              className={`${styles.dose} ${item.status === "taken" ? styles.doseTaken : ""} ${
                item.status === "skipped" ? styles.doseSkipped : ""
              }`}
            >
              <span className={styles.doseTime}>{item.time}</span>
              <div className={styles.doseInfo}>
                <div className={styles.doseName}>{item.name}</div>
                <div className={styles.doseMeta}>
                  <span>
                    {item.dose ? `${item.dose} · ` : ""}
                    {formatQty(item.doseQty)} un.
                  </span>
                  {late && <span className={styles.late}>atrasado</span>}
                  {item.status === "skipped" && <span>não tomei</span>}
                  <StockBadge stockQty={item.stockQty} lowStock={item.lowStock} />
                </div>
              </div>
              <div className={styles.doseActions}>
                {done ? (
                  <button
                    className={`${styles.btn} ${styles.btnIcon}`}
                    onClick={() => mark(item, "pending")}
                    aria-label={`Desfazer ${item.name} ${item.time}`}
                    title="Desfazer"
                  >
                    <Undo2 size={16} aria-hidden="true" />
                  </button>
                ) : (
                  <>
                    <button
                      className={`${styles.btn} ${styles.btnIcon}`}
                      onClick={() => mark(item, "skipped")}
                      aria-label={`Não tomei ${item.name} ${item.time}`}
                      title="Não tomei"
                    >
                      <SkipForward size={16} aria-hidden="true" />
                    </button>
                    <button
                      className={`${styles.btn} ${styles.btnTake}`}
                      onClick={() => mark(item, "taken")}
                      aria-label={`Tomei ${item.name} ${item.time}`}
                    >
                      <Check size={16} aria-hidden="true" /> Tomei
                    </button>
                  </>
                )}
              </div>
            </li>
          );
        })}
      </ul>
    </>
  );
}
