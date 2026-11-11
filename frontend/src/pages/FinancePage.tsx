import { useState } from "react";
import { BarChart3, ChevronLeft, ChevronRight, List, Plus, Tags, Wallet } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import ErrorBoundary from "../components/ErrorBoundary";
import MonthTab from "../components/finance/MonthTab";
import EntriesTab from "../components/finance/EntriesTab";
import CategoriesTab from "../components/finance/CategoriesTab";
import QuickAddSheet from "../components/finance/QuickAddSheet";
import { currentMonth, defaultDateFor, monthTitle, shiftMonth } from "../lib/financeFormat";
import styles from "../components/finance/Finance.module.css";

type SectionId = "month" | "entries" | "categories";

const SECTIONS: { id: SectionId; label: string; Icon: LucideIcon }[] = [
  { id: "month", label: "Mês", Icon: BarChart3 },
  { id: "entries", label: "Lançamentos", Icon: List },
  { id: "categories", label: "Categorias", Icon: Tags },
];

export default function FinancePage(): JSX.Element {
  const [section, setSection] = useState<SectionId>("month");
  const [month, setMonth] = useState(currentMonth());
  const [adding, setAdding] = useState(false);

  return (
    <main className={styles.page}>
      <header className={styles.header}>
        <h1>
          <Wallet size={22} aria-hidden="true" /> Finanças
        </h1>
        <p>Gastos, rendas e visão do mês.</p>
      </header>

      <div className={styles.tabs} role="tablist" aria-label="Seções de finanças">
        {SECTIONS.map(({ id, label, Icon }) => (
          <button key={id} role="tab" aria-selected={section === id} className={`${styles.tab} ${section === id ? styles.active : ""}`} onClick={() => setSection(id)}>
            <Icon size={16} aria-hidden="true" /> {label}
          </button>
        ))}
      </div>

      {section !== "categories" && (
        <div className={styles.monthNav}>
          <button className={`${styles.btn} ${styles.btnIcon}`} onClick={() => setMonth((m) => shiftMonth(m, -1))} aria-label="Mês anterior">
            <ChevronLeft size={18} aria-hidden="true" />
          </button>
          <span className={styles.monthTitle}>{monthTitle(month)}</span>
          <button className={`${styles.btn} ${styles.btnIcon}`} onClick={() => setMonth((m) => shiftMonth(m, 1))} aria-label="Próximo mês">
            <ChevronRight size={18} aria-hidden="true" />
          </button>
        </div>
      )}

      <ErrorBoundary>
        {section === "month" && <MonthTab month={month} />}
        {section === "entries" && <EntriesTab month={month} />}
        {section === "categories" && <CategoriesTab />}
      </ErrorBoundary>

      <button className={styles.fab} onClick={() => setAdding(true)} aria-label="Novo lançamento">
        <Plus size={26} aria-hidden="true" />
      </button>
      {adding && <QuickAddSheet defaultDate={defaultDateFor(month)} onClose={() => setAdding(false)} />}
    </main>
  );
}
