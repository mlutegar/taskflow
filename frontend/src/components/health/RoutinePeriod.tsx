import { useState } from "react";
import { ArrowDown, ArrowUp, Check, Pencil, Plus, Trash2 } from "lucide-react";
import {
  useRemoveStep,
  useReorderSteps,
  useSetStepCheck,
  useSkincareSteps,
  useSkincareToday,
} from "../../hooks/useSkincare";
import { todayISO } from "../../lib/dateUtils";
import { frequencyText } from "../../lib/healthLabels";
import type { Period, SkincareStep, SkincareTodayItem } from "../../api/saude";
import StepForm from "./StepForm";
import styles from "./Health.module.css";

interface RoutinePeriodProps {
  period: Period;
}

function productWarning(item: SkincareTodayItem): JSX.Element | null {
  if (item.productStatus === "need_to_buy") return <span className={`${styles.badgeWarn} ${styles.badgeDanger}`}>comprar</span>;
  if (item.productStatus === "low") return <span className={styles.badgeWarn}>acabando</span>;
  return null;
}

/** Check do dia (só passos que se aplicam hoje) + edição dos passos da rotina. */
export default function RoutinePeriod({ period }: RoutinePeriodProps): JSX.Element {
  const date = todayISO();
  const today = useSkincareToday(date);
  const steps = useSkincareSteps();
  const setCheck = useSetStepCheck(date);
  const removeStep = useRemoveStep();
  const reorder = useReorderSteps();
  const [managing, setManaging] = useState(false);
  const [formStep, setFormStep] = useState<SkincareStep | "new" | null>(null);

  const items = today.data?.[period] ?? [];
  const periodSteps = (steps.data ?? []).filter((s) => s.period === period);
  const done = items.filter((i) => i.done).length;
  const label = period === "morning" ? "manhã" : "noite";

  const move = (index: number, dir: -1 | 1): void => {
    const ids = periodSteps.map((s) => s.id);
    const j = index + dir;
    if (j < 0 || j >= ids.length) return;
    [ids[index], ids[j]] = [ids[j], ids[index]];
    reorder.mutate({ period, ids });
  };

  const confirmRemove = (s: SkincareStep): void => {
    if (window.confirm(`Remover "${s.label}" da rotina da ${label}?\n\nOs checks antigos continuam no histórico.`)) {
      removeStep.mutate(s.id);
    }
  };

  return (
    <>
      <div className={styles.toolbar}>
        <div className={styles.progress}>
          {managing ? `${periodSteps.length} passos na rotina da ${label}` : `${done} de ${items.length} feitos hoje`}
        </div>
        <button className={`${styles.chip} ${managing ? styles.active : ""}`} aria-pressed={managing} onClick={() => setManaging((v) => !v)}>
          {managing ? "Concluir edição" : "Editar passos"}
        </button>
      </div>

      {!managing && (
        <>
          {today.isLoading && <div className={styles.empty}>Carregando…</div>}
          {today.isError && <div className={styles.empty}>Não foi possível carregar a rotina.</div>}
          {today.data && items.length === 0 && (
            <div className={styles.empty}>
              {periodSteps.length === 0
                ? `Nenhum passo na rotina da ${label}. Toque em “Editar passos” para criar.`
                : `Nenhum passo se aplica hoje na rotina da ${label}.`}
            </div>
          )}
          <ul className={styles.list}>
            {items.map((item) => (
              <li key={item.stepId} className={`${styles.step} ${item.done ? styles.stepDone : ""}`}>
                <button
                  className={`${styles.checkBtn} ${item.done ? styles.checkBtnOn : ""}`}
                  onClick={() => setCheck.mutate({ stepId: item.stepId, done: !item.done })}
                  aria-pressed={item.done}
                  aria-label={`${item.done ? "Desmarcar" : "Marcar"} ${item.label}`}
                >
                  <Check size={18} aria-hidden="true" />
                </button>
                <span className={styles.stepLabel}>
                  {item.label}
                  {item.productName && item.productName !== item.label && (
                    <span className={styles.stepSub}>{item.productName}</span>
                  )}
                </span>
                {productWarning(item)}
              </li>
            ))}
          </ul>
        </>
      )}

      {managing && (
        <>
          <ul className={styles.list}>
            {periodSteps.map((s, i) => (
              <li key={s.id} className={styles.step}>
                <span className={styles.stepLabel}>
                  {s.label}
                  <span className={styles.stepSub}>
                    {frequencyText(s)}
                    {s.productName && s.productName !== s.label ? ` · ${s.productName}` : ""}
                  </span>
                </span>
                <div className={styles.doseActions}>
                  <button className={`${styles.btn} ${styles.btnIcon}`} onClick={() => move(i, -1)} disabled={i === 0 || reorder.isPending} aria-label={`Subir ${s.label}`}>
                    <ArrowUp size={16} aria-hidden="true" />
                  </button>
                  <button className={`${styles.btn} ${styles.btnIcon}`} onClick={() => move(i, 1)} disabled={i === periodSteps.length - 1 || reorder.isPending} aria-label={`Descer ${s.label}`}>
                    <ArrowDown size={16} aria-hidden="true" />
                  </button>
                  <button className={`${styles.btn} ${styles.btnIcon}`} onClick={() => setFormStep(s)} aria-label={`Editar ${s.label}`}>
                    <Pencil size={16} aria-hidden="true" />
                  </button>
                  <button className={`${styles.btn} ${styles.btnIcon} ${styles.btnDanger}`} onClick={() => confirmRemove(s)} aria-label={`Remover ${s.label}`}>
                    <Trash2 size={16} aria-hidden="true" />
                  </button>
                </div>
              </li>
            ))}
          </ul>
          <button className={`${styles.btn} ${styles.btnPrimary}`} onClick={() => setFormStep("new")}>
            <Plus size={16} aria-hidden="true" /> Novo passo
          </button>
        </>
      )}

      {formStep && (
        <StepForm
          key={formStep === "new" ? "new" : formStep.id}
          period={period}
          step={formStep === "new" ? null : formStep}
          onClose={() => setFormStep(null)}
        />
      )}
    </>
  );
}
