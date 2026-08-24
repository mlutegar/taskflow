import { useState, useEffect, useCallback } from "react";
import { getStreak } from "../../lib/dailyFocusHistory";
import styles from "./Sidebar.module.css";
import { formatBuildDate } from "../../version.js";

interface NavItem {
  icon: string;
  label: string;
  hash: string;
}

// Todos os itens da navegação
const NAV_ITEMS: NavItem[] = [
  { icon: "✅", label: "Tarefas",     hash: "#/tasks" },
  { icon: "🔄", label: "Rotinas",     hash: "#/routines" },
  { icon: "🎯", label: "Daily Focus", hash: "#/daily-focus" },
  { icon: "🎮", label: "Modos",       hash: "#/modes" },
  { icon: "📊", label: "Análises",    hash: "#/dashboard" },
  { icon: "👤", label: "Perfil",      hash: "#/profile" },
];

// Os 3 atalhos fixos no bottom nav mobile
const MOBILE_PINNED = ["#/tasks", "#/routines", "#/daily-focus"];

function navigate(hash: string): void {
  window.location.hash = hash.slice(1);
}

interface SidebarProps {
  currentHash: string;
  onSignOut: () => void;
}

export default function Sidebar({ currentHash, onSignOut }: SidebarProps): JSX.Element {
  const streak: number = getStreak();
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
    return () => { document.body.style.overflow = ""; };
  }, [drawerOpen]);

  const handleNavigate = useCallback((hash: string) => {
    navigate(hash);
    setDrawerOpen(false);
  }, []);

  const pinnedItems = NAV_ITEMS.filter((it) => MOBILE_PINNED.includes(it.hash));

  return (
    <>
      {/* ── Sidebar desktop ── */}
      <aside className={styles.sidebar}>
        <div className={styles.logo}>⚡</div>
        <nav className={styles.nav}>
          {NAV_ITEMS.map((item) => {
            const isActive  = currentHash === item.hash;
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

      {/* ── Bottom nav mobile ── */}
      <nav className={styles.bottomNav}>
        {/* 3 atalhos fixos */}
        {pinnedItems.map((item) => {
          const isActive  = currentHash === item.hash;
          const showBadge = item.hash === "#/daily-focus" && streak > 0;
          return (
            <button
              key={item.hash}
              className={`${styles.bottomNavItem} ${isActive ? styles.active : ""}`}
              onClick={() => navigate(item.hash)}
            >
              <span className={styles.navIconWrap}>
                <span className={styles.navIcon}>{item.icon}</span>
                {showBadge && (
                  <span className={styles.streakBadge} title={`🔥 ${streak} dias`}>{streak}</span>
                )}
              </span>
              <span className={styles.bottomNavLabel}>{item.label}</span>
            </button>
          );
        })}

        {/* Botão menu */}
        <button
          className={`${styles.bottomNavItem} ${drawerOpen ? styles.active : ""}`}
          onClick={() => setDrawerOpen((v) => !v)}
          aria-label="Menu"
        >
          <span className={styles.navIconWrap}>
            <span className={styles.navIcon}>{drawerOpen ? "✕" : "☰"}</span>
          </span>
          <span className={styles.bottomNavLabel}>Menu</span>
        </button>
      </nav>

      {/* ── Drawer overlay ── */}
      {drawerOpen && (
        <div
          className={styles.drawerOverlay}
          onClick={() => setDrawerOpen(false)}
          aria-hidden="true"
        />
      )}

      {/* ── Drawer panel ── */}
      <aside className={`${styles.drawer} ${drawerOpen ? styles.drawerOpen : ""}`}>
        <div className={styles.drawerHeader}>
          <span style={{ fontSize: 20 }}>⚡</span>
          <span style={{ fontWeight: 700, fontSize: 15, color: "var(--text)" }}>TaskFlow</span>
          <button
            className={styles.drawerClose}
            onClick={() => setDrawerOpen(false)}
            aria-label="Fechar menu"
          >
            ✕
          </button>
        </div>

        <nav className={styles.drawerNav}>
          {NAV_ITEMS.map((item) => {
            const isActive  = currentHash === item.hash;
            const showBadge = item.hash === "#/daily-focus" && streak > 0;
            return (
              <button
                key={item.hash}
                className={`${styles.drawerNavItem} ${isActive ? styles.active : ""}`}
                onClick={() => handleNavigate(item.hash)}
              >
                <span className={styles.navIconWrap}>
                  <span style={{ fontSize: 20 }}>{item.icon}</span>
                  {showBadge && (
                    <span className={styles.streakBadge}>{streak}</span>
                  )}
                </span>
                <span style={{ fontSize: 14, fontWeight: 500 }}>{item.label}</span>
                {showBadge && (
                  <span style={{ marginLeft: "auto", fontSize: 12, color: "var(--warning)" }}>
                    🔥{streak}
                  </span>
                )}
              </button>
            );
          })}
        </nav>

        <div style={{ padding: "12px 16px", borderTop: "1px solid var(--border)", marginTop: "auto" }}>
          <div style={{ fontSize: 11, color: "var(--text-muted)", opacity: 0.5 }}>{formatBuildDate()}</div>
        </div>
      </aside>
    </>
  );
}
