import { useEffect, useRef, useState } from "react";
import { Menu, X } from "lucide-react";
import styles from "./Sidebar.module.css";
import { NAV_ITEMS, MOBILE_PINNED, navigate, tapHaptic } from "./navItems";

interface BottomNavProps {
  currentHash: string;
  streak: number;
  drawerOpen: boolean;
  onToggleDrawer: () => void;
}

/**
 * Barra de navegação inferior (mobile).
 * - 3 atalhos fixos + botão Menu (abre drawer).
 * - Pill deslizante indica o item ativo.
 * - Botão Menu acende quando a rota atual está "dentro" do drawer.
 * - Auto-oculta ao rolar para baixo, revela ao rolar para cima.
 */
export default function BottomNav({
  currentHash,
  streak,
  drawerOpen,
  onToggleDrawer,
}: BottomNavProps): JSX.Element {
  const pinnedItems = NAV_ITEMS.filter((it) => MOBILE_PINNED.includes(it.hash));
  const SLOTS = pinnedItems.length + 1; // +1 = botão Menu

  // Índice do slot ativo: rota fixada → seu índice; rota do drawer → botão Menu.
  const pinnedIndex = pinnedItems.findIndex((it) => it.hash === currentHash);
  const activeIndex = pinnedIndex >= 0 ? pinnedIndex : pinnedItems.length;
  const menuActive = pinnedIndex < 0 || drawerOpen;

  // ── Auto-hide ao rolar ──────────────────────────────────
  const [hidden, setHidden] = useState<boolean>(false);
  const lastY = useRef<number>(0);

  useEffect(() => {
    lastY.current = window.scrollY;
    const onScroll = (): void => {
      const y = window.scrollY;
      const delta = y - lastY.current;
      // Nunca esconder com o drawer aberto ou perto do topo.
      if (!drawerOpen && y > 80 && delta > 6) setHidden(true);
      else if (delta < -6 || y < 80) setHidden(false);
      lastY.current = y;
    };
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, [drawerOpen]);

  const handlePinned = (hash: string): void => {
    tapHaptic();
    navigate(hash);
  };

  return (
    <nav
      className={`${styles.bottomNav} ${hidden ? styles.bottomNavHidden : ""}`}
      aria-label="Navegação principal"
    >
      {/* Pill deslizante */}
      <span
        aria-hidden="true"
        className={styles.bottomNavPill}
        style={{
          width: `${100 / SLOTS}%`,
          transform: `translateX(${activeIndex * 100}%)`,
        }}
      />

      {pinnedItems.map((item) => {
        const isActive = currentHash === item.hash;
        const showBadge = item.hash === "#/daily-focus" && streak > 0;
        const Icon = item.Icon;
        return (
          <button
            key={item.hash}
            className={`${styles.bottomNavItem} ${isActive ? styles.active : ""}`}
            onClick={() => handlePinned(item.hash)}
            aria-current={isActive ? "page" : undefined}
            aria-label={item.label}
          >
            <span className={styles.navIconWrap}>
              <Icon className={styles.navSvg} strokeWidth={2.2} aria-hidden="true" />
              {showBadge && (
                <span className={styles.streakBadge} title={`🔥 ${streak} dias`}>
                  {streak}
                </span>
              )}
            </span>
            <span className={styles.bottomNavLabel}>{item.label}</span>
          </button>
        );
      })}

      {/* Botão Menu */}
      <button
        className={`${styles.bottomNavItem} ${menuActive ? styles.active : ""}`}
        onClick={() => {
          tapHaptic();
          onToggleDrawer();
        }}
        aria-label={drawerOpen ? "Fechar menu" : "Abrir menu"}
        aria-expanded={drawerOpen}
        aria-current={menuActive && !drawerOpen ? "page" : undefined}
      >
        <span className={styles.navIconWrap}>
          {drawerOpen ? (
            <X className={styles.navSvg} strokeWidth={2.2} aria-hidden="true" />
          ) : (
            <Menu className={styles.navSvg} strokeWidth={2.2} aria-hidden="true" />
          )}
        </span>
        <span className={styles.bottomNavLabel}>Menu</span>
      </button>
    </nav>
  );
}
