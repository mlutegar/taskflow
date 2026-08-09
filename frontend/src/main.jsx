import { StrictMode, useState, useEffect, useRef } from "react";
import { createRoot } from "react-dom/client";
import "./index.css";
import App from "./App.jsx";
import DailyFocusApp from "./DailyFocusApp.jsx";
import DashboardPage from "./components/dashboard/DashboardPage.jsx";
import AppShell from "./components/layout/AppShell.jsx";
import LoginPage from "./components/auth/LoginPage.jsx";
import ProfilePage from "./components/auth/ProfilePage.jsx";
import { useAuth } from "./hooks/useAuth.js";
import { loadRemoteSessions } from "./lib/dailyFocusHistory.js";
import { loadRemoteTodayState } from "./lib/dailyFocusDay.js";
import { loadRemoteAchievements } from "./lib/dailyFocusAchievements.js";
import { loadRemoteCheckins } from "./lib/checkinLog.js";
import { loadRemotePreferences } from "./lib/userPreferences.js";
import { loadRemoteModeActivations } from "./lib/modeActivations.js";
import { loadRemoteUsageLogs } from "./lib/sessionUsageLog.js";

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

// ── Roteador reativo (fix #5 — sem reload) ────────────────────────────────────
function Root() {
  const [hash, setHash] = useState(window.location.hash || "#/");
  const { user, loading, signIn, signUp, signOut } = useAuth();
  const syncedRef = useRef(false);

  useEffect(() => {
    const handler = () => setHash(window.location.hash || "#/");
    window.addEventListener("hashchange", handler);
    return () => window.removeEventListener("hashchange", handler);
  }, []);

  // Sincroniza dados do Daily Focus com Supabase após login
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
    ]).catch(() => {});
  }, [user]);

  // Aguarda verificação de sessão
  if (loading) return <LoadingScreen />;

  // Não autenticado → tela de login
  if (!user) return <LoginPage signIn={signIn} signUp={signUp} />;

  let Page;
  if (hash === "#/daily-focus") Page = <DailyFocusApp />;
  else if (hash === "#/dashboard") Page = <DashboardPage />;
  else if (hash === "#/profile") Page = <ProfilePage onSignOut={signOut} />;
  else if (hash === "#/" || hash === "#") Page = <App />;
  else Page = <NotFoundPage />;

  return <AppShell currentHash={hash} onSignOut={signOut}>{Page}</AppShell>;
}

createRoot(document.getElementById("root")).render(
  <StrictMode>
    <Root />
  </StrictMode>
);
