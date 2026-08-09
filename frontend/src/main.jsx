import { StrictMode, useState, useEffect, useRef, lazy, Suspense } from "react";
import { createRoot } from "react-dom/client";
import "./index.css";
import AppShell from "./components/layout/AppShell.jsx";
import LoginPage from "./components/auth/LoginPage.jsx";
import { useAuth } from "./hooks/useAuth.js";
import { loadRemoteSessions } from "./lib/dailyFocusHistory.js";
import { loadRemoteTodayState } from "./lib/dailyFocusDay.js";
import { loadRemoteAchievements } from "./lib/dailyFocusAchievements.js";
import { loadRemoteCheckins } from "./lib/checkinLog.js";
import { loadRemotePreferences } from "./lib/userPreferences.js";
import { loadRemoteModeActivations } from "./lib/modeActivations.js";
import { loadRemoteUsageLogs } from "./lib/sessionUsageLog.js";

// ── Lazy loading de rotas (reduz chunk inicial) ───────────────────────────────
const App          = lazy(() => import("./App.jsx"));
const DailyFocusApp = lazy(() => import("./DailyFocusApp.jsx"));
const DashboardPage = lazy(() => import("./components/dashboard/DashboardPage.jsx"));
const ProfilePage   = lazy(() => import("./components/auth/ProfilePage.jsx"));

// ── 404 page ─────────────────────────────────────────────────────────────────
function NotFoundPage() {
  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", minHeight: "60vh", gap: "16px", color: "var(--text-muted)" }}>
      <div style={{ fontSize: "48px" }}>🔍</div>
      <div style={{ fontSize: "18px", fontWeight: 700, color: "var(--text)" }}>Página não encontrada</div>
      <div style={{ fontSize: "13px" }}>A rota <code style={{ background: "var(--surface-2)", padding: "2px 6px", borderRadius: "4px" }}>{window.location.hash}</code> não existe.</div>
      <button
        onClick={() => { window.location.hash = "/daily-focus"; }}
        style={{ padding: "10px 20px", background: "var(--accent)", color: "#fff", border: "none", borderRadius: "var(--radius-sm)", cursor: "pointer", fontWeight: 600, fontSize: "13px" }}
      >
        Ir para Daily Focus
      </button>
    </div>
  );
}

// ── Loading splash ────────────────────────────────────────────────────────────
function LoadingScreen() {
  return (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "center", minHeight: "100vh", background: "var(--bg)", flexDirection: "column", gap: "16px" }}>
      <div style={{ fontSize: "36px" }}>⚡</div>
      <div style={{ fontSize: "13px", color: "var(--text-muted)" }}>Carregando…</div>
    </div>
  );
}

// ── Banner offline ────────────────────────────────────────────────────────────
function OfflineBanner() {
  const [offline, setOffline] = useState(!navigator.onLine);

  useEffect(() => {
    const goOffline = () => setOffline(true);
    const goOnline  = () => setOffline(false);
    window.addEventListener("offline", goOffline);
    window.addEventListener("online",  goOnline);
    return () => {
      window.removeEventListener("offline", goOffline);
      window.removeEventListener("online",  goOnline);
    };
  }, []);

  if (!offline) return null;

  return (
    <div style={{
      position: "fixed",
      top: 0,
      left: 0,
      right: 0,
      zIndex: 9999,
      background: "#b45309",
      color: "#fff",
      fontSize: 12,
      fontWeight: 600,
      textAlign: "center",
      padding: "6px 12px",
      letterSpacing: "0.3px",
    }}>
      📡 Sem conexão — dados salvos localmente e sincronizados ao voltar online
    </div>
  );
}

// ── Roteador reativo ──────────────────────────────────────────────────────────
function Root() {
  const [hash, setHash] = useState(window.location.hash || "#/");
  const { user, loading, signIn, signUp, signOut } = useAuth();
  const syncedRef = useRef(false);

  useEffect(() => {
    const handler = () => setHash(window.location.hash || "#/");
    window.addEventListener("hashchange", handler);
    return () => window.removeEventListener("hashchange", handler);
  }, []);

  // Sincroniza dados com backend após login
  useEffect(() => {
    if (!user || syncedRef.current) return;
    syncedRef.current = true;
    Promise.all([
      loadRemoteSessions(),
      loadRemoteTodayState(),
      loadRemoteAchievements(),
      loadRemoteCheckins(),
      loadRemotePreferences(),
      loadRemoteModeActivations(),
      loadRemoteUsageLogs(),
    ]).catch(() => {});
  }, [user]);

  if (loading) return <LoadingScreen />;
  if (!user)   return <LoginPage signIn={signIn} signUp={signUp} />;

  let Page;
  if (hash === "#/daily-focus") Page = <DailyFocusApp />;
  else if (hash === "#/dashboard") Page = <DashboardPage />;
  else if (hash === "#/profile")   Page = <ProfilePage onSignOut={signOut} />;
  else if (hash === "#/" || hash === "#") Page = <App />;
  else Page = <NotFoundPage />;

  return (
    <>
      <OfflineBanner />
      <AppShell currentHash={hash} onSignOut={signOut}>
        <Suspense fallback={<LoadingScreen />}>
          {Page}
        </Suspense>
      </AppShell>
    </>
  );
}

createRoot(document.getElementById("root")).render(
  <StrictMode>
    <Root />
  </StrictMode>
);
