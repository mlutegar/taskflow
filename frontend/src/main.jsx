import { StrictMode, useState, useEffect } from "react";
import { createRoot } from "react-dom/client";
import "./index.css";
import App from "./App.jsx";
import DailyFocusApp from "./DailyFocusApp.jsx";
import DashboardPage from "./components/dashboard/DashboardPage.jsx";
import AppShell from "./components/layout/AppShell.jsx";

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

// ── Roteador reativo (fix #5 — sem reload) ────────────────────────────────────
function Root() {
  const [hash, setHash] = useState(window.location.hash || "#/");

  useEffect(() => {
    const handler = () => setHash(window.location.hash || "#/");
    window.addEventListener("hashchange", handler);
    return () => window.removeEventListener("hashchange", handler);
  }, []);

  let Page;
  if (hash === "#/daily-focus") Page = <DailyFocusApp />;
  else if (hash === "#/dashboard") Page = <DashboardPage />;
  else if (hash === "#/" || hash === "#") Page = <App />;
  else Page = <NotFoundPage />;

  return <AppShell currentHash={hash}>{Page}</AppShell>;
}

createRoot(document.getElementById("root")).render(
  <StrictMode>
    <Root />
  </StrictMode>
);
