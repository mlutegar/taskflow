import { useState } from "react";
import DashboardPage from "../dashboard/DashboardPage";
import HistoryPage from "../history/HistoryPage";
import styles from "./AnalyticsPage.module.css";

const TABS = [
  { id: "dashboard", label: "📊 Análises" },
  { id: "history",   label: "📋 Histórico" },
] as const;

type TabId = typeof TABS[number]["id"];

export default function AnalyticsPage(): JSX.Element {
  const [tab, setTab] = useState<TabId>("dashboard");

  return (
    <div className={styles.root}>
      <div className={styles.tabBar}>
        {TABS.map((t) => (
          <button
            key={t.id}
            className={`${styles.tab} ${tab === t.id ? styles.tabActive : ""}`}
            onClick={() => setTab(t.id)}
          >
            {t.label}
          </button>
        ))}
      </div>
      <div className={styles.content}>
        {tab === "dashboard" ? <DashboardPage /> : <HistoryPage />}
      </div>
    </div>
  );
}
