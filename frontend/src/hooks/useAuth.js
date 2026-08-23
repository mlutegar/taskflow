import { useState, useEffect } from "react";
import { api } from "../lib/apiClient";
import { flushQueue } from "../lib/syncQueue";

const BASE_URL  = import.meta.env.VITE_API_URL || "/api";
const TOKEN_KEY = "taskflow.authToken";
const USER_KEY  = "taskflow.authUser";

// Margem para renovar o token 1 dia antes de expirar (token dura 7d)
const REFRESH_MARGIN_MS = 24 * 60 * 60 * 1000;

function loadStored() {
  try {
    const token = localStorage.getItem(TOKEN_KEY);
    const user  = JSON.parse(localStorage.getItem(USER_KEY) || "null");
    return (token && user) ? { token, user } : null;
  } catch {
    return null;
  }
}

function saveSession(token, user) {
  localStorage.setItem(TOKEN_KEY, token);
  localStorage.setItem(USER_KEY, JSON.stringify(user));
}

function clearSession() {
  localStorage.removeItem(TOKEN_KEY);
  localStorage.removeItem(USER_KEY);
}

/** Decodifica o payload do JWT sem verificar assinatura (client-side). */
function decodeToken(token) {
  try {
    const payload = token.split(".")[1];
    return JSON.parse(atob(payload.replace(/-/g, "+").replace(/_/g, "/")));
  } catch {
    return null;
  }
}

/** Drena a fila offline após login. */
async function tryFlushQueue() {
  try {
    await flushQueue();
  } catch { /* silêncio */ }
}

export function useAuth() {
  const stored = loadStored();

  // Garante que o token esteja disponível imediatamente para o apiClient
  if (stored?.token && !window.__authToken) {
    window.__authToken = stored.token;
  }

  const [user, setUser]     = useState(stored?.user ?? null);
  const [loading, setLoading] = useState(false);

  // Auto-refresh: renova o token quando estiver próximo de expirar
  useEffect(() => {
    if (!user) return;

    function scheduleRefresh() {
      const token   = localStorage.getItem(TOKEN_KEY);
      if (!token) return;
      const payload = decodeToken(token);
      if (!payload?.exp) return;

      const expiresInMs = payload.exp * 1000 - Date.now();
      const delay       = Math.max(expiresInMs - REFRESH_MARGIN_MS, 0);

      const timer = setTimeout(async () => {
        try {
          const res = await fetch(`${BASE_URL}/auth/refresh`, {
            method:  "POST",
            headers: {
              "Content-Type":  "application/json",
              "Authorization": `Bearer ${token}`,
            },
          });
          if (!res.ok) return; // silêncio se falhar, próximo login renova
          const data = await res.json();
          saveSession(data.token, data.user);
          window.__authToken = data.token;
          scheduleRefresh(); // agenda o próximo refresh
        } catch { /* sem internet — tenta de novo em 30s */ }
      }, delay);

      return () => clearTimeout(timer);
    }

    const cleanup = scheduleRefresh();
    return cleanup;
  }, [user]);

  async function signIn(email, password) {
    const res = await fetch(`${BASE_URL}/auth/login`, {
      method:  "POST",
      headers: { "Content-Type": "application/json" },
      body:    JSON.stringify({ email, password }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || "Erro ao entrar.");
    saveSession(data.token, data.user);
    window.__authToken = data.token;
    setUser(data.user);
    tryFlushQueue(); // drena fila offline sem bloquear o login
  }

  async function signUp(email, password) {
    const res = await fetch(`${BASE_URL}/auth/register`, {
      method:  "POST",
      headers: { "Content-Type": "application/json" },
      body:    JSON.stringify({ email, password }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || "Erro ao cadastrar.");
    saveSession(data.token, data.user);
    window.__authToken = data.token;
    setUser(data.user);
    tryFlushQueue(); // drena fila offline
    if (data.isNewUser) {
      // Importa dados locais existentes para o novo usuário
      importLocalData().catch(() => {});
    }
  }

  async function signOut() {
    clearSession();
    window.__authToken = null;
    setUser(null);
  }

  return { user, loading, signIn, signUp, signOut };
}

/**
 * Após o cadastro, envia dados locais (localStorage) para o backend.
 * Cobre o caso de usuário que usou o app sem conta e depois criou uma.
 */
async function importLocalData() {

  // 1. Preferências (customModes, activities, etc.)
  try {
    const customModes    = JSON.parse(localStorage.getItem("customModes") || "[]");
    const deletedModeIds = JSON.parse(localStorage.getItem("taskflow.deletedModeIds") || "[]");
    const activities     = JSON.parse(localStorage.getItem("activities") || "[]");
    const estadosCustom  = JSON.parse(localStorage.getItem("estadosCustom") || "[]");

    if (customModes.length || activities.length || estadosCustom.length) {
      await api.put("/preferences", { customModes, deletedModeIds, activities, estadosCustom });
    }
  } catch { /* silêncio */ }

  // 2. Registros de uso de sessão
  try {
    const logs = JSON.parse(localStorage.getItem("sessionUsageLog") || "[]");
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
