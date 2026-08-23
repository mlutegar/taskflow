import { getStreak } from "../../lib/dailyFocusHistory";
import styles from "./Sidebar.module.css";
import { formatBuildDate } from "../../version.js";

interface NavItem {
  icon: string;
  label: string;
  hash: string;
}

const NAV_ITEMS: NavItem[] = [
  { icon: "🏠", label: "Início", hash: "#/" },
  { icon: "🎯", label: "Daily Focus", hash: "#/daily-focus" },
  { icon: "📊", label: "Dashboard", hash: "#/dashboard" },
  { icon: "👤", label: "Perfil", hash: "#/profile" },
  { icon: "📋", label: "Histórico", hash: "#/history" },
];

// Fix #5: navegação sem reload via hashchange
function navigate(hash: string): void {
  window.location.hash = hash.slice(1); // remove leading #
}

interface SidebarProps {
  currentHash: string;
  onSignOut: () => void;
}

export default function Sidebar({ currentHash, onSignOut }: SidebarProps): JSX.Element {
  // Fix #6: badge de streak ao lado do Daily Focus
  const streak: number = getStreak();

  return (
    <aside className={styles.sidebar}>
      <div className={styles.logo}>⚡</div>
      <nav className={styles.nav}>
        {NAV_ITEMS.map((item) => {
          const isActive = currentHash === item.hash;
          const showBadge = item.hash === "#/daily-focus" && streak > 0;
          return (
            <button
              key={item.hash}
              className={`${styles.navItem} ${isActive ? styles.active : ""}`}
              onClick={() => navigate(item.hash)}
              title={item.label}
            >
              <span className={styles.navIconWrap}>
                <span className={styles.navIcon}>{item.icon}</span>
                {showBadge && (
                  <span className={styles.streakBadge} title={`🔥 ${streak} dias seguidos`}>
                    {streak}
                  </span>
                )}
              </span>
              <span className={styles.navLabel}>{item.label}</span>
              {showBadge && <span className={styles.streakBadgeInline}>🔥{streak}</span>}
            </button>
          );
        })}
      </nav>

      <div className={styles.buildDate} title={formatBuildDate()}>
        <span className={styles.buildDateText}>{formatBuildDate()}</span>
      </div>
    </aside>
  );
}
