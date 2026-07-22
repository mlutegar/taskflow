import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "./index.css";
import App from "./App.jsx";
import DailyFocusApp from "./DailyFocusApp.jsx";
import DashboardPage from "./components/dashboard/DashboardPage.jsx";
import AppShell from "./components/layout/AppShell.jsx";

const hash = window.location.hash;

function Root() {
  if (hash === "#/daily-focus") return <AppShell><DailyFocusApp /></AppShell>;
  if (hash === "#/dashboard")   return <AppShell><DashboardPage /></AppShell>;
  return <AppShell><App /></AppShell>;
}

createRoot(document.getElementById("root")).render(
  <StrictMode>
    <Root />
  </StrictMode>
);
