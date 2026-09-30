// Tema claro/escuro. Persistido em localStorage e aplicado via `data-theme`
// no <html>. O tema padrão é "dark" (paleta original do app).

export type Theme = "dark" | "light";

const THEME_KEY = "taskflow.theme";

export function getStoredTheme(): Theme {
  try {
    const v = localStorage.getItem(THEME_KEY);
    return v === "light" ? "light" : "dark";
  } catch {
    return "dark";
  }
}

export function applyTheme(theme: Theme): void {
  const root = document.documentElement;
  if (theme === "light") root.setAttribute("data-theme", "light");
  else root.removeAttribute("data-theme");
}

export function setTheme(theme: Theme): void {
  try { localStorage.setItem(THEME_KEY, theme); } catch { /* ignore */ }
  applyTheme(theme);
}

export function toggleTheme(): Theme {
  const next: Theme = getStoredTheme() === "light" ? "dark" : "light";
  setTheme(next);
  return next;
}

// Chamar o quanto antes no bootstrap para evitar "flash" do tema errado.
export function initTheme(): void {
  applyTheme(getStoredTheme());
}
