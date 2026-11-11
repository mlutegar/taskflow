import { useState } from "react";
import TodayWorkouts from "./TodayWorkouts";
import WeekHistory from "./WeekHistory";
import WeekPlan from "./WeekPlan";
import styles from "./Health.module.css";

type Sub = "today" | "history" | "plan";

/** Exercícios: Hoje (planejados + "Fiz"), Histórico por semana e Plano semanal. */
export default function ExerciseSection(): JSX.Element {
  const [sub, setSub] = useState<Sub>("today");
  const items: { id: Sub; label: string }[] = [
    { id: "today", label: "Hoje" },
    { id: "history", label: "Histórico" },
    { id: "plan", label: "Plano" },
  ];

  return (
    <>
      <div className={styles.subtabs} role="tablist" aria-label="Exercícios">
        {items.map((i) => (
          <button
            key={i.id}
            role="tab"
            aria-selected={sub === i.id}
            className={`${styles.chip} ${sub === i.id ? styles.active : ""}`}
            onClick={() => setSub(i.id)}
          >
            {i.label}
          </button>
        ))}
      </div>

      {sub === "today" && <TodayWorkouts />}
      {sub === "history" && <WeekHistory />}
      {sub === "plan" && <WeekPlan />}
    </>
  );
}
