/**
 * AuthContext.jsx — Contexto de autenticação do TaskFlow.
 *
 * Substitui o padrão `window.__authToken` (variável global) por um React Context
 * adequado. O estado de auth é inicializado uma única vez no AuthProvider e
 * compartilhado via Context, eliminando a releitura do localStorage a cada render.
 *
 * O apiClient.js já usa supabase.auth.getSession() internamente, portanto não
 * depende de window.__authToken — essas atribuições eram código morto.
 */

import { createContext, useContext, useState, useEffect, ReactNode } from "react";
import { api } from "../lib/apiClient";
import { flushQueue } from "../lib/syncQueue";

const BASE_URL          = import.meta.env.VITE_API_URL || "/api";
const TOKEN_KEY         = "taskflow.authToken";
const USER_KEY          = "taskflow.authUser";
const REFRESH_MARGIN_MS = 24 * 60 * 60 * 1000; // renova 1 dia antes de expirar

interface AuthUser {
  id: string;
  email: string;
  [key: string]: unknown;
}

interface StoredSession {
  token: string;
  user: AuthUser;
}

interface AuthContextValue {
  user: AuthUser | null;
  loading: boolean;
  signIn: (email: string, password: string) => Promise<void>;
  signUp: (email: string, password: string) => Promise<void>;
  signOut: () => Promise<void>;
}

// ── helpers de persistência ───────────────────────────────────────────────────

function loadStored(): StoredSession | null {
  try {
    const token = localStorage.getItem(TOKEN_KEY);
    const user  = JSON.parse(localStorage.getItem(USER_KEY) || "null") as AuthUser | null;
    return token && user ? { token, user } : null;
  } catch {
    return null;
  }
}

function saveSession(token: string, user: AuthUser): void {
  localStorage.setItem(TOKEN_KEY, token);
  localStorage.setItem(USER_KEY, JSON.stringify(user));
}

function clearSession(): void {
  localStorage.removeItem(TOKEN_KEY);
  localStorage.removeItem(USER_KEY);
}

function decodeToken(token: string): Record<string, unknown> | null {
  try {
    const payload = token.split(".")[1];
    return JSON.parse(atob(payload.replace(/-/g, "+").replace(/_/g, "/"))) as Record<string, unknown>;
  } catch {
    return null;
  }
}

async function tryFlushQueue(): Promise<void> {
  try { await flushQueue(); } catch { /* silêncio */ }
}

// ── Context ───────────────────────────────────────────────────────────────────

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const stored = loadStored();
  const [user, setUser]       = useState<AuthUser | null>(stored?.user ?? null);
  const [loading, setLoading] = useState<boolean>(false);

  // Auto-refresh: renova o token quando estiver próximo de expirar
  useEffect(() => {
    if (!user) return;

    function scheduleRefresh(): (() => void) | undefined {
      const token = localStorage.getItem(TOKEN_KEY);
      if (!token) return;
      const payload = decodeToken(token);
      if (!payload?.exp) return;

      const expiresInMs = (payload.exp as number) * 1000 - Date.now();
      const delay       = Math.max(expiresInMs - REFRESH_MARGIN_MS, 0);

      const timer = setTimeout(async () => {
        try {
          const res = await fetch(`${BASE_URL}/auth/refresh`, {
            method:  "POST",
            headers: {
              "Content-Type":  "application/json",
              Authorization: `Bearer ${token}`,
            },
          });
          if (!res.ok) return; // silêncio — próximo login renova
          const data = await res.json() as { token: string; user: AuthUser };
          saveSession(data.token, data.user);
          scheduleRefresh(); // agenda próxima renovação
        } catch { /* sem internet */ }
      }, delay);

      return () => clearTimeout(timer);
    }

    const cleanup = scheduleRefresh();
    return cleanup;
  }, [user]);

  async function signIn(email: string, password: string): Promise<void> {
    setLoading(true);
    try {
      const res = await fetch(`${BASE_URL}/auth/login`, {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({ email, password }),
      });
      const data = await res.json() as { token: string; user: AuthUser; error?: string };
      if (!res.ok) throw new Error(data.error || "Erro ao entrar.");
      saveSession(data.token, data.user);
      setUser(data.user);
      tryFlushQueue();
    } finally {
      setLoading(false);
    }
  }

  async function signUp(email: string, password: string): Promise<void> {
    setLoading(true);
    try {
      const res = await fetch(`${BASE_URL}/auth/register`, {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({ email, password }),
      });
      const data = await res.json() as { token: string; user: AuthUser; error?: string; isNewUser?: boolean };
      if (!res.ok) throw new Error(data.error || "Erro ao cadastrar.");
      saveSession(data.token, data.user);
      setUser(data.user);
      tryFlushQueue();
      if (data.isNewUser) {
        importLocalData().catch(() => {});
      }
    } finally {
      setLoading(false);
    }
  }

  async function signOut(): Promise<void> {
    clearSession();
    setUser(null);
  }

  return (
    <AuthContext.Provider value={{ user, loading, signIn, signUp, signOut }}>
      {children}
    </AuthContext.Provider>
  );
}

/**
 * Hook para consumir o contexto de autenticação.
 * Deve ser usado dentro de <AuthProvider>.
 */
export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth deve ser usado dentro de <AuthProvider>");
  return ctx;
}

// ── Importação de dados locais após cadastro ──────────────────────────────────

async function importLocalData(): Promise<void> {
  try {
    const customModes    = JSON.parse(localStorage.getItem("customModes") || "[]") as unknown[];
    const deletedModeIds = JSON.parse(localStorage.getItem("taskflow.deletedModeIds") || "[]") as unknown[];
    const activities     = JSON.parse(localStorage.getItem("activities") || "[]") as unknown[];
    const estadosCustom  = JSON.parse(localStorage.getItem("estadosCustom") || "[]") as unknown[];

    if (customModes.length || activities.length || estadosCustom.length) {
      await api.put("/preferences", { customModes, deletedModeIds, activities, estadosCustom });
    }
  } catch { /* silêncio */ }

  try {
    const logs = JSON.parse(localStorage.getItem("sessionUsageLog") || "[]") as Array<{
      modeId: string;
      date: string;
      hour: number;
      worked: number;
      focusedMinutes: number;
      idleMinutes: number;
      idleReason: string;
      feeling: string;
    }>;
    if (logs.length) {
      const entries = logs.map((e) => ({
        mode_id:         e.modeId,
        date:            e.date,
        hour:            e.hour,
        worked:          e.worked,
        focused_minutes: e.focusedMinutes,
        idle_minutes:    e.idleMinutes,
        idle_reason:     e.idleReason,
        feeling:         e.feeling,
      }));
      await api.post("/session-usage-logs/bulk", { entries });
    }
  } catch { /* silêncio */ }
}
