import { useState } from "react";
import { Pill, Sparkles, Utensils, Dumbbell, HeartPulse } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import ErrorBoundary from "../components/ErrorBoundary";
import MedicationsSection from "../components/health/MedicationsSection";
import SkincareSection from "../components/health/SkincareSection";
import NutritionSection from "../components/health/NutritionSection";
import styles from "../components/health/Health.module.css";

type SectionId = "meds" | "skin" | "food" | "workout";

interface Section {
  id: SectionId;
  label: string;
  Icon: LucideIcon;
  /** Fase em que a seção chega (enquanto não existe, mostra um aviso). */
  phase?: string;
}

const SECTIONS: Section[] = [
  { id: "meds", label: "Remédios", Icon: Pill },
  { id: "skin", label: "Pele", Icon: Sparkles },
  { id: "food", label: "Comida", Icon: Utensils },
  { id: "workout", label: "Treino", Icon: Dumbbell, phase: "D" },
];

export default function HealthPage(): JSX.Element {
  const [section, setSection] = useState<SectionId>("meds");
  const current = SECTIONS.find((s) => s.id === section) ?? SECTIONS[0];

  return (
    <main className={styles.page}>
      <header className={styles.header}>
        <h1>
          <HeartPulse size={22} aria-hidden="true" /> Saúde
        </h1>
        <p>Remédios, pele, alimentação e exercícios.</p>
      </header>

      <div className={styles.tabs} role="tablist" aria-label="Seções de saúde">
        {SECTIONS.map(({ id, label, Icon, phase }) => (
          <button
            key={id}
            role="tab"
            aria-selected={section === id}
            className={`${styles.tab} ${section === id ? styles.active : ""}`}
            onClick={() => setSection(id)}
            title={phase ? `Em breve (fase ${phase})` : label}
          >
            <Icon size={16} aria-hidden="true" /> {label}
          </button>
        ))}
      </div>

      <ErrorBoundary>
        {section === "meds" ? (
          <MedicationsSection />
        ) : section === "skin" ? (
          <SkincareSection />
        ) : section === "food" ? (
          <NutritionSection />
        ) : (
          <div className={styles.placeholder}>
            {current.label} chega na fase {current.phase}.
          </div>
        )}
      </ErrorBoundary>
    </main>
  );
}
