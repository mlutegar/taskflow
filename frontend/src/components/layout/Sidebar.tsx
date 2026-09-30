import { useState, useEffect } from "react";
import { Zap } from "lucide-react";
import { getStreak } from "../../lib/dailyFocusHistory";
import styles from "./Sidebar.module.css";
import { formatBuildDate } from "../../version.js";
import { useActiveMode } from "../../contexts/ActiveModeContext";
import { NAV_ITEMS, navigate } from "./navItems";
import BottomNav from "./BottomNav";
import MobileDrawer from "./MobileDrawer";

interface SidebarProps {
  currentHash: string;
  onSignOut: () => void;
}

export default function Sidebar({ currentHash }: SidebarProps): JSX.Element {
  const streak: number = getStreak();
  const { hasActiveSession } = useActiveMode();
  const [drawerOpen, setDrawerOpen] = useState<boolean>(false);

  // Fechar drawer ao navegar
  useEffect(() => {
    setDrawerOpen(false);
  }, [currentHash]);

  // Fechar drawer com Escape
  useEffect(() => {
    if (!drawerOpen) return;
    const onKey = (e: KeyboardEvent): void => {
      if (e.key === "Escape") setDrawerOpen(false);
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [drawerOpen]);

  // Travar scroll do body quando drawer está aberto
  useEffect(() => {
    if (drawerOpen) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }
    return () => {
      document.body.style.overflow = "";
    };
  }, [drawerOpen]);

  return (
    <>
      {/* ── Sidebar desktop ── */}
      <aside className={styles.sidebar}>
        <div className={styles.logo}>
          <Zap className={styles.logoSvg} strokeWidth={2.2} aria-hidden="true" />
        </div>
        <nav className={styles.nav} aria-label="Navegação principal">
          {NAV_ITEMS.map((item) => {
            const isActive = currentHash === item.hash;
            const showBadge = item.hash === "#/daily-focus" && streak > 0;
            const Icon = item.Icon;
            return (
              <button
                key={item.hash}
                className={`${styles.navItem} ${isActive ? styles.active : ""}`}
                onClick={() => navigate(item.hash)}
                title={item.label}
                aria-current={isActive ? "page" : undefined}
              >
                <span className={styles.navIconWrap}>
                  <Icon className={styles.navSvg} strokeWidth={2.2} aria-hidden="true" />
                  {showBadge && (
                    <span className={styles.streakBadge} title={`🔥 ${streak} dias seguidos`}>
                      {streak}
                    </span>
                  )}
                  {hasActiveSession && item.hash === "#/modes" && (
                    <span className={styles.modeDot} title="Sessão de modo ativa" aria-hidden="true" />
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

      {/* ── Bottom nav mobile ── */}
      <BottomNav
        currentHash={currentHash}
        streak={streak}
        drawerOpen={drawerOpen}
        onToggleDrawer={() => setDrawerOpen((v) => !v)}
      />

      {/* ── Drawer mobile ── */}
      <MobileDrawer
        currentHash={currentHash}
        streak={streak}
        hasActiveSession={hasActiveSession}
        open={drawerOpen}
        onClose={() => setDrawerOpen(false)}
      />
    </>
  );
}
