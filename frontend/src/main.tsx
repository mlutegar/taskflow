import { StrictMode, useState, useEffect, useRef, lazy, Suspense } from "react";
import { QueryClientProvider } from "@tanstack/react-query";
import { createRoot } from "react-dom/client";
import "./index.css";
import ErrorBoundary from "./components/ErrorBoundary.jsx";
import { AuthProvider } from "./contexts/AuthContext.jsx";
import { ToastProvider, useToast } from "./components/shared/Toast.jsx";
import { queryClient, setMutationErrorHandler } from "./lib/queryClient.js";

// ── Web Vitals ────────────────────────────────────────────────────────────────
// web-vitals não está instalado. Para ativar o monitoramento de CLS, LCP, FID,
// FCP e TTFB, instale com:  npm install web-vitals
// Depois substitua este bloco por:
//
// import { onCLS, onLCP, onFID, onFCP, onTTFB } from "web-vitals";
// const reportVital = (metric) => console.log("[web-vitals]", metric.name, metric.value);
// onCLS(reportVital);
// onLCP(reportVital);
// onFID(reportVital);
// onFCP(reportVital);
// onTTFB(reportVital);
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
import { loadRemoteModeLog } from "./lib/modeLog.js";
import { loadRemoteModeComboLog } from "./lib/modeComboLog.js";
import { useStreakReminder } from "./hooks/useStreakReminder.js";

// ── Lazy loading de rotas (reduz chunk inicial) ───────────────────────────────
const App           = lazy(() => import("./App.jsx"));
const DailyFocusApp = lazy(() => import("./DailyFocusApp.jsx"));
const DashboardPage = lazy(() => import("./components/dashboard/DashboardPage.jsx"));
const ProfilePage   = lazy(() => import("./components/auth/ProfilePage.jsx"));
const HistoryPage   = lazy(() => import("./components/history/HistoryPage.jsx"));

// ── 404 page ─────────────────────────────────────────────────────────────────
function NotFoundPage(): JSX.Element {
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
function LoadingScreen(): JSX.Element {
  return (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "center", minHeight: "100vh", background: "var(--bg)", flexDirection: "column", gap: "16px" }}>
      <div style={{ fontSize: "36px" }}>⚡</div>
      <div style={{ fontSize: "13px", color: "var(--text-muted)" }}>Carregando…</div>
    </div>
  );
}

// ── Banner offline ────────────────────────────────────────────────────────────
function OfflineBanner(): JSX.Element | null {
  const [offline, setOffline] = useState<boolean>(!navigator.onLine);

  useEffect(() => {
    const goOffline = (): void => setOffline(true);
    const goOnline  = (): void => setOffline(false);
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

// ── Registra handler de erros de mutação no QueryClient ──────────────────────
// Componente interno ao ToastProvider para ter acesso ao showToast.
function QueryErrorHandler(): null {
  const { showToast } = useToast();
  useEffect(() => {
    setMutationErrorHandler(showToast);
    return () => setMutationErrorHandler(null);
  }, [showToast]);
  return null;
}

// ── Roteador reativo ──────────────────────────────────────────────────────────
function Root(): JSX.Element {
  const [hash, setHash] = useState<string>(window.location.hash || "#/");
  const { user, loading, signIn, signUp, signOut } = useAuth();
  const syncedRef = useRef<boolean>(false);

  useEffect(() => {
    const handler = (): void => setHash(window.location.hash || "#/");
    window.addEventListener("hashchange", handler);
    return () => window.removeEventListener("hashchange", handler);
  }, []);

  // Sincroniza dados com backend após login
  useEffect(() => {
    if (!user || syncedRef.current) return;
    syncedRef.current = true;

    const loaders: Array<{ name: string; fn: () => Promise<unknown> }> = [
      { name: "sessions",       fn: loadRemoteSessions },
      { name: "todayState",     fn: loadRemoteTodayState },
      { name: "achievements",   fn: loadRemoteAchievements },
      { name: "checkins",       fn: loadRemoteCheckins },
      { name: "preferences",    fn: loadRemotePreferences },
      { name: "modeActivations",fn: loadRemoteModeActivations },
      { name: "usageLogs",      fn: loadRemoteUsageLogs },
      { name: "modeLog",        fn: loadRemoteModeLog },
      { name: "modeComboLog",   fn: loadRemoteModeComboLog },
    ];

    Promise.allSettled(loaders.map(({ fn }) => fn())).then((results) => {
      results.forEach((result, i) => {
        if (result.status === "rejected") {
          console.warn(`[sync] Falha ao carregar "${loaders[i].name}":`, result.reason);
        }
      });
    });
  }, [user]);

  useStreakReminder();

  if (loading) return <LoadingScreen />;
  if (!user)   return <LoginPage signIn={signIn} signUp={signUp} />;

  let Page: JSX.Element;
  if (hash === "#/daily-focus")       Page = <DailyFocusApp />;
  else if (hash === "#/dashboard")    Page = <DashboardPage />;
  else if (hash === "#/profile")      Page = <ProfilePage onSignOut={signOut} />;
  else if (hash === "#/history")      Page = <HistoryPage />;
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

createRoot(document.getElementById("root") as HTMLElement).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <ToastProvider>
          <QueryErrorHandler />
          <ErrorBoundary>
            <Root />
          </ErrorBoundary>
        </ToastProvider>
      </AuthProvider>
    </QueryClientProvider>
  </StrictMode>
);
