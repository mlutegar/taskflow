import { useState } from "react";
import { Pill, Sparkles, Utensils, Dumbbell, HeartPulse } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import ErrorBoundary from "../components/ErrorBoundary";
import MedicationsSection from "../components/health/MedicationsSection";
import SkincareSection from "../components/health/SkincareSection";
import NutritionSection from "../components/health/NutritionSection";
import ExerciseSection from "../components/health/ExerciseSection";
import styles from "../components/health/Health.module.css";

type SectionId = "meds" | "skin" | "food" | "workout";

interface Section {
  id: SectionId;
  label: string;
  Icon: LucideIcon;
}

const SECTIONS: Section[] = [
  { id: "meds", label: "Remédios", Icon: Pill },
  { id: "skin", label: "Pele", Icon: Sparkles },
  { id: "food", label: "Comida", Icon: Utensils },
  { id: "workout", label: "Treino", Icon: Dumbbell },
];

export default function HealthPage(): JSX.Element {
  const [section, setSection] = useState<SectionId>("meds");

  return (
    <main className={styles.page}>
      <header className={styles.header}>
        <h1>
          <HeartPulse size={22} aria-hidden="true" /> Saúde
        </h1>
        <p>Remédios, pele, alimentação e exercícios.</p>
      </header>

      <div className={styles.tabs} role="tablist" aria-label="Seções de saúde">
        {SECTIONS.map(({ id, label, Icon }) => (
          <button
            key={id}
            role="tab"
            aria-selected={section === id}
            className={`${styles.tab} ${section === id ? styles.active : ""}`}
            onClick={() => setSection(id)}
          >
            <Icon size={16} aria-hidden="true" /> {label}
          </button>
        ))}
      </div>

      <ErrorBoundary>
        {section === "meds" && <MedicationsSection />}
        {section === "skin" && <SkincareSection />}
        {section === "food" && <NutritionSection />}
        {section === "workout" && <ExerciseSection />}
      </ErrorBoundary>
    </main>
  );
}
