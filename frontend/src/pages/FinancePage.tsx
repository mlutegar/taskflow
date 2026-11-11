import { useState } from "react";
import { BarChart3, ChevronLeft, ChevronRight, List, Minus, Plus, Tags, TrendingUp, Wallet, HandCoins } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import ErrorBoundary from "../components/ErrorBoundary";
import MonthTab from "../components/finance/MonthTab";
import EntriesTab from "../components/finance/EntriesTab";
import CategoriesTab from "../components/finance/CategoriesTab";
import IncomesTab from "../components/finance/IncomesTab";
import ProjectionTab from "../components/finance/ProjectionTab";
import QuickAddSheet from "../components/finance/QuickAddSheet";
import type { FinanceType } from "../api/financas";
import { currentMonth, monthTitle, shiftMonth } from "../lib/financeFormat";
import { todayISO } from "../lib/dateUtils";
import styles from "../components/finance/Finance.module.css";

type SectionId = "month" | "entries" | "incomes" | "projection" | "categories";

const SECTIONS: { id: SectionId; label: string; Icon: LucideIcon }[] = [
  { id: "month", label: "Mês", Icon: BarChart3 },
  { id: "entries", label: "Lançamentos", Icon: List },
  { id: "incomes", label: "Rendas", Icon: HandCoins },
  { id: "projection", label: "Projeção", Icon: TrendingUp },
  { id: "categories", label: "Categorias", Icon: Tags },
];

export default function FinancePage(): JSX.Element {
  const [section, setSection] = useState<SectionId>("month");
  const [month, setMonth] = useState(currentMonth());
  const [adding, setAdding] = useState<FinanceType | null>(null);

  return (
    <main className={styles.page}>
      <header className={styles.header}>
        <h1>
          <Wallet size={22} aria-hidden="true" /> Finanças
        </h1>
        <p>Gastos, rendas, visão do mês e projeção.</p>
      </header>

      <div className={styles.tabs} role="tablist" aria-label="Seções de finanças">
        {SECTIONS.map(({ id, label, Icon }) => (
          <button key={id} role="tab" aria-selected={section === id} className={`${styles.tab} ${section === id ? styles.active : ""}`} onClick={() => setSection(id)}>
            <Icon size={16} aria-hidden="true" /> {label}
          </button>
        ))}
      </div>

      {(section === "month" || section === "entries") && (
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
        {section === "month" && <MonthTab month={month} onAdd={setAdding} />}
        {section === "entries" && <EntriesTab month={month} />}
        {section === "incomes" && <IncomesTab />}
        {section === "projection" && <ProjectionTab />}
        {section === "categories" && <CategoriesTab />}
      </ErrorBoundary>

      <div className={styles.addBar}>
        <button type="button" className={`${styles.addBtn} ${styles.addExpense}`} onClick={() => setAdding("expense")}>
          <Minus size={20} aria-hidden="true" /> Gasto
        </button>
        <button type="button" className={`${styles.addBtn} ${styles.addIncome}`} onClick={() => setAdding("income")}>
          <Plus size={20} aria-hidden="true" /> Ganho
        </button>
      </div>
      {adding && <QuickAddSheet defaultDate={todayISO()} initialType={adding} onClose={() => setAdding(null)} />}
    </main>
  );
}
