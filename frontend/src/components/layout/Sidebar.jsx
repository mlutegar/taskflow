import styles from "./Sidebar.module.css";

const NAV_ITEMS = [
  { icon: "🏠", label: "Início", hash: "#/" },
  { icon: "🎯", label: "Daily Focus", hash: "#/daily-focus" },
  { icon: "📊", label: "Dashboard", hash: "#/dashboard" },
];

export default function Sidebar({ currentHash }) {
  const navigate = (hash) => {
    window.location.hash = hash.replace("#", "");
    window.location.reload();
  };

  return (
    <aside className={styles.sidebar}>
      <div className={styles.logo}>⚡</div>
      <nav className={styles.nav}>
        {NAV_ITEMS.map((item) => (
          <button
            key={item.hash}
            className={`${styles.navItem} ${currentHash === item.hash ? styles.active : ""}`}
            onClick={() => navigate(item.hash)}
            title={item.label}
          >
            <span className={styles.navIcon}>{item.icon}</span>
            <span className={styles.navLabel}>{item.label}</span>
          </button>
        ))}
      </nav>
    </aside>
  );
}
