import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "./index.css";
import App from "./App.jsx";
import DailyFocusApp from "./DailyFocusApp.jsx";

const isDailyFocus = window.location.hash === "#/daily-focus";

createRoot(document.getElementById("root")).render(
  <StrictMode>
    {isDailyFocus ? <DailyFocusApp /> : <App />}
  </StrictMode>
);
