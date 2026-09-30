import { StrictMode, useState, useEffect, lazy, Suspense } from "react";
import { QueryClientProvider } from "@tanstack/react-query";
import { createRoot } from "react-dom/client";
import "./index.css";
import ErrorBoundary from "./components/ErrorBoundary.jsx";
import { AuthProvider } from "./contexts/AuthContext.jsx";
import { ToastProvider, useToast } from "./components/shared/Toast.jsx";
import { queryClient, setMutationErrorHandler } from "./lib/queryClient.js";
import { warmUpBackend } from "./lib/apiClient.js";
import { initTheme } from "./lib/theme.js";

// Aplica o tema salvo (claro/escuro) antes do render para evitar flash.
initTheme();

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
import { ActiveModeProvider } from "./contexts/ActiveModeContext";
import DailyFocusFloatingCard from "./components/daily-focus/DailyFocusFloatingCard";
import QuickTaskButton from "./components/QuickTaskButton";
import { QuickTaskProvider } from "./contexts/QuickTaskContext";
import UpdatePrompt from "./components/shared/UpdatePrompt";
import PageSkeleton from "./components/shared/PageSkeleton.jsx";
import LoginPage from "./components/auth/LoginPage.jsx";
import { useAuth } from "./hooks/useAuth.js";
import { useRemoteSync } from "./hooks/useRemoteSync.js";
import { useStreakReminder } from "./hooks/useStreakReminder.js";
import { migrateLegacyKeys } from "./lib/migrateLegacyKeys";
import { APP_VERSION, formatBuildDate } from "./version.js";

// Loga versão + data do build no console — diagnóstico rápido de "build antigo?".
console.info(`%cTaskFlow ${APP_VERSION} · ${formatBuildDate()}`, "color:#7c6cf0;font-weight:600");

// Migra chaves legadas do localStorage (sem prefixo) para o padrão "taskflow."
// Executado uma única vez antes do React montar.
migrateLegacyKeys();

// ── Lazy loading de rotas (reduz chunk inicial) ───────────────────────────────
const TasksPage     = lazy(() => import("./pages/TasksPage.jsx"));
const RoutinesPage  = lazy(() => import("./pages/RoutinesPage.jsx"));
const ModesPage     = lazy(() => import("./pages/ModesPage.jsx"));
const DailyFocusApp = lazy(() => import("./DailyFocusApp.jsx"));
const AnalyticsPage = lazy(() => import("./components/analytics/AnalyticsPage.jsx"));
const ProfilePage   = lazy(() => import("./components/auth/ProfilePage.jsx"));

// ── 404 page ─────────────────────────────────────────────────────────────────
function NotFoundPage(): JSX.Element {
  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", minHeight: "60vh", gap: "16px", color: "var(--text-muted)" }}>
      <div style={{ fontSize: "48px" }}>🔍</div>
      <div style={{ fontSize: "18px", fontWeight: 700, color: "var(--text)" }}>Página não encontrada</div>
      <div style={{ fontSize: "13px" }}>A rota <code style={{ background: "var(--surface-2)", padding: "2px 6px", borderRadius: "4px" }}>{window.location.hash}</code> não existe.</div>
      <button
        onClick={() => { window.location.hash = "/tasks"; }}
        style={{ padding: "10px 20px", background: "var(--accent)", color: "#fff", border: "none", borderRadius: "var(--radius-sm)", cursor: "pointer", fontWeight: 600, fontSize: "13px" }}
      >
        Ir para Tarefas
      </button>
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
      📡 Sem conexão — alterações novas precisam ser tentadas novamente ao reconectar
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

// ── Tabela de rotas ───────────────────────────────────────────────────────────
// Fonte única da verdade para o roteamento + fallback resiliente.
const KNOWN_ROUTES = new Set<string>([
  "#/tasks",
  "#/routines",
  "#/modes",
  "#/daily-focus",
  "#/dashboard",
  "#/history",
  "#/profile",
]);
// Rota de destino quando a atual é desconhecida. DEVE pertencer a KNOWN_ROUTES.
const DEFAULT_ROUTE = "#/tasks";

// ── Roteador reativo ──────────────────────────────────────────────────────────
function Root(): JSX.Element {
  const [hash, setHash] = useState<string>(window.location.hash || "#/");
  const { user, signIn, signUp, signOut } = useAuth();
  const { showToast } = useToast();
  useEffect(() => {
    const handler = (): void => setHash(window.location.hash || "#/");
    window.addEventListener("hashchange", handler);
    return () => window.removeEventListener("hashchange", handler);
  }, []);

  // Aquece o backend logo após o login (cold start) antes das queries pesadas.
  useEffect(() => { if (user) warmUpBackend(); }, [user]);

  // Sincroniza dados com backend após login
  const remoteSync = useRemoteSync(user);

  // Torna visível quando parte da sincronização inicial falhou (antes só ia pro
  // console) — o usuário sabe que alguns dados podem estar desatualizados.
  // Não faz resync automático aqui para evitar loop caso a falha persista.
  useEffect(() => {
    if (remoteSync.errors.length > 0) {
      showToast(`Alguns dados não sincronizaram (${remoteSync.errors.length}). Verifique a conexão.`, "error");
    }
  }, [remoteSync.errors, showToast]);

  useStreakReminder();

  if (!user) return <LoginPage signIn={signIn} signUp={signUp} />;

  // Redirect resiliente: qualquer rota desconhecida (inclusive a raiz, ou um
  // build antigo cujo router não conhece a rota inicial) cai numa rota que
  // SEMPRE existe neste build — em vez de mostrar a tela 404 na abertura.
  // DEFAULT_ROUTE é obrigatoriamente uma chave de KNOWN_ROUTES, então não há
  // risco de loop de redirect.
  if (!KNOWN_ROUTES.has(hash)) {
    if (hash !== DEFAULT_ROUTE) window.location.replace(DEFAULT_ROUTE);
    // Enquanto o hashchange não dispara, mostra o skeleton do destino.
    return (
      <AppShell currentHash={DEFAULT_ROUTE} onSignOut={signOut}>
        <PageSkeleton type="tasks" />
      </AppShell>
    );
  }

  const skeletonType = hash.includes("tasks") ? "tasks" : hash.includes("routines") ? "routines" : hash.includes("modes") ? "modes" : hash.includes("daily-focus") ? "daily-focus" : hash.includes("dashboard") || hash.includes("history") ? "analytics" : hash.includes("profile") ? "profile" : "generic" as const;
  let Page: JSX.Element;
  if (hash === "#/tasks")             Page = <TasksPage />;
  else if (hash === "#/routines")     Page = <RoutinesPage />;
  else if (hash === "#/modes")        Page = <ModesPage />;
  else if (hash === "#/daily-focus")  Page = <DailyFocusApp />;
  else if (hash === "#/dashboard")    Page = <AnalyticsPage />;
  else if (hash === "#/history")      Page = <AnalyticsPage />;
  else if (hash === "#/profile")      Page = <ProfilePage onSignOut={signOut} />;
  else Page = <NotFoundPage />;

  return (
    <ActiveModeProvider>
      <QuickTaskProvider>
        <OfflineBanner />
        <AppShell currentHash={hash} onSignOut={signOut}>
          <Suspense fallback={<PageSkeleton type={skeletonType} />}>
            {Page}
          </Suspense>
        </AppShell>
        {/* Card persistente do Daily Focus: visível em qualquer página EXCETO na tela
            cheia do próprio Daily Focus. Renderiza null sozinho quando não há sessão. */}
        {hash !== "#/daily-focus" && <DailyFocusFloatingCard />}
        {/* Botão global de captura rápida de tarefas — visível em todas as páginas.
            Na aba Tarefas o FAB é ocultado (já há botão nativo), mas o atalho segue ativo. */}
        <QuickTaskButton hidden={hash === "#/tasks"} />
      </QuickTaskProvider>
    </ActiveModeProvider>
  );
}

createRoot(document.getElementById("root") as HTMLElement).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <ToastProvider>
          <QueryErrorHandler />
          <UpdatePrompt />
          <ErrorBoundary>
            <Root />
          </ErrorBoundary>
        </ToastProvider>
      </AuthProvider>
    </QueryClientProvider>
  </StrictMode>
);
