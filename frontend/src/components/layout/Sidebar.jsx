import { getStreak } from "../../lib/dailyFocusHistory";
import styles from "./Sidebar.module.css";

const NAV_ITEMS = [
  { icon: "🏠", label: "Início", hash: "#/" },
  { icon: "🎯", label: "Daily Focus", hash: "#/daily-focus" },
  { icon: "📊", label: "Dashboard", hash: "#/dashboard" },
];

// Fix #5: navegação sem reload via hashchange
function navigate(hash) {
  window.location.hash = hash.slice(1); // remove leading #
}

export default function Sidebar({ currentHash }) {
  // Fix #6: badge de streak ao lado do Daily Focus
  const streak = getStreak();

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
    </aside>
  );
}
