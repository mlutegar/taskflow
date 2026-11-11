import { useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { todayISO } from "../../lib/dateUtils";
import { dayTitle, shiftISO } from "../../lib/healthFormat";
import WaterTracker from "./WaterTracker";
import MealLog from "./MealLog";
import styles from "./Health.module.css";

/** Alimentação (versão simples): água + refeições do dia, com navegação entre dias. */
export default function NutritionSection(): JSX.Element {
  const today = todayISO();
  const [date, setDate] = useState(today);
  const isToday = date >= today;

  return (
    <>
      <div className={styles.dayNav}>
        <button className={`${styles.btn} ${styles.btnIcon}`} onClick={() => setDate((d) => shiftISO(d, -1))} aria-label="Dia anterior">
          <ChevronLeft size={18} aria-hidden="true" />
        </button>
        <span className={styles.dayTitle}>{dayTitle(date, today)}</span>
        <button
          className={`${styles.btn} ${styles.btnIcon}`}
          onClick={() => setDate((d) => shiftISO(d, 1))}
          disabled={isToday}
          aria-label="Próximo dia"
        >
          <ChevronRight size={18} aria-hidden="true" />
        </button>
      </div>

      <WaterTracker date={date} />
      <MealLog date={date} />
    </>
  );
}
