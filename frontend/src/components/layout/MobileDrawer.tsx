import { Zap, X } from "lucide-react";
import styles from "./Sidebar.module.css";
import { formatBuildDate } from "../../version.js";
import { NAV_ITEMS, navigate, tapHaptic } from "./navItems";

interface MobileDrawerProps {
  currentHash: string;
  streak: number;
  hasActiveSession: boolean;
  open: boolean;
  onClose: () => void;
}

/** Drawer lateral (mobile) com a lista completa de navegação. */
export default function MobileDrawer({
  currentHash,
  streak,
  hasActiveSession,
  open,
  onClose,
}: MobileDrawerProps): JSX.Element {
  const handleNavigate = (hash: string): void => {
    tapHaptic();
    navigate(hash);
    onClose();
  };

  return (
    <>
      {open && (
        <div className={styles.drawerOverlay} onClick={onClose} aria-hidden="true" />
      )}

      <aside
        className={`${styles.drawer} ${open ? styles.drawerOpen : ""}`}
        aria-hidden={!open}
        role="dialog"
        aria-label="Menu de navegação"
      >
        <div className={styles.drawerHeader}>
          <Zap className={styles.drawerLogo} strokeWidth={2.2} aria-hidden="true" />
          <span className={styles.drawerTitle}>TaskFlow</span>
          <button className={styles.drawerClose} onClick={onClose} aria-label="Fechar menu">
            <X size={18} strokeWidth={2.2} aria-hidden="true" />
          </button>
        </div>

        <nav className={styles.drawerNav} aria-label="Navegação">
          {NAV_ITEMS.map((item) => {
            const isActive = currentHash === item.hash;
            const showBadge = item.hash === "#/daily-focus" && streak > 0;
            const Icon = item.Icon;
            return (
              <button
                key={item.hash}
                className={`${styles.drawerNavItem} ${isActive ? styles.active : ""}`}
                onClick={() => handleNavigate(item.hash)}
                aria-current={isActive ? "page" : undefined}
              >
                <span className={styles.navIconWrap}>
                  <Icon className={styles.drawerSvg} strokeWidth={2.2} aria-hidden="true" />
                  {showBadge && <span className={styles.streakBadge}>{streak}</span>}
                  {hasActiveSession && item.hash === "#/modes" && (
                    <span className={styles.modeDot} title="Sessão de modo ativa" aria-hidden="true" />
                  )}
                </span>
                <span className={styles.drawerNavLabel}>{item.label}</span>
                {showBadge && <span className={styles.drawerStreak}>🔥{streak}</span>}
              </button>
            );
          })}
        </nav>

        <div className={styles.drawerFooter}>
          <span className={styles.drawerBuildDate}>{formatBuildDate()}</span>
        </div>
      </aside>
    </>
  );
}
