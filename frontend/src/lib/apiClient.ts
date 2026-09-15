/**
 * apiClient.ts — Cliente HTTP para o backend TaskFlow.
 *
 * - Injeta o JWT (localStorage) em cada requisição.
 * - Timeout por requisição via AbortController.
 * - Refresh reativo em 401: renova o token via POST /auth/refresh e repete a
 *   requisição UMA vez. É single-flight (refreshs concorrentes compartilham a
 *   mesma Promise) e distingue falha de AUTENTICAÇÃO (token inválido → encerra
 *   sessão) de falha de REDE (offline/5xx → mantém a sessão, erro transitório).
 * - Sincroniza entre abas via BroadcastChannel: token renovado e sessão expirada
 *   são propagados para as outras abas.
 *
 * Eventos de window emitidos:
 * - "taskflow:session-refreshed" (detail: { user }) — token renovado com sucesso.
 * - "taskflow:session-expired" — refresh falhou por autenticação; sessão encerrada.
 */
import { API_TIMEOUT_MS } from "../config/constants";

const BASE_URL: string = import.meta.env.VITE_API_URL || "/api";
const TIMEOUT_MS: number = API_TIMEOUT_MS;

const TOKEN_KEY = "taskflow.authToken";
const USER_KEY = "taskflow.authUser";

export const SESSION_REFRESHED_EVENT = "taskflow:session-refreshed";
export const SESSION_EXPIRED_EVENT = "taskflow:session-expired";

// ── Cross-tab (BroadcastChannel) ────────────────────────────────────────────────
type AuthBroadcast =
  | { type: "refreshed"; token: string; user: unknown }
  | { type: "expired" };

const authChannel: BroadcastChannel | null =
  typeof BroadcastChannel !== "undefined" ? new BroadcastChannel("taskflow-auth") : null;

if (authChannel) {
  authChannel.onmessage = (ev: MessageEvent<AuthBroadcast>) => {
    const msg = ev.data;
    if (msg?.type === "refreshed") {
      localStorage.setItem(TOKEN_KEY, msg.token);
      if (msg.user) localStorage.setItem(USER_KEY, JSON.stringify(msg.user));
      dispatchLocal(SESSION_REFRESHED_EVENT, { user: msg.user });
    } else if (msg?.type === "expired") {
      localStorage.removeItem(TOKEN_KEY);
      localStorage.removeItem(USER_KEY);
      dispatchLocal(SESSION_EXPIRED_EVENT);
    }
  };
}

function dispatchLocal(name: string, detail?: unknown): void {
  if (typeof window === "undefined") return;
  window.dispatchEvent(detail !== undefined ? new CustomEvent(name, { detail }) : new Event(name));
}

// ── Sessão ──────────────────────────────────────────────────────────────────────
function getToken(): string | null {
  return localStorage.getItem(TOKEN_KEY);
}

function persistSession(token: string, user: unknown): void {
  localStorage.setItem(TOKEN_KEY, token);
  if (user) localStorage.setItem(USER_KEY, JSON.stringify(user));
  dispatchLocal(SESSION_REFRESHED_EVENT, { user });
  authChannel?.postMessage({ type: "refreshed", token, user });
}

function endSession(): void {
  localStorage.removeItem(TOKEN_KEY);
  localStorage.removeItem(USER_KEY);
  dispatchLocal(SESSION_EXPIRED_EVENT);
  authChannel?.postMessage({ type: "expired" });
}

export type RefreshResult =
  | { status: "ok"; token: string }
  | { status: "auth" }      // token inválido/rejeitado → encerrar sessão
  | { status: "network" };  // offline/5xx → manter sessão, transitório

// Single-flight: apenas 1 refresh por vez.
let refreshInFlight: Promise<RefreshResult> | null = null;

export function refreshSession(): Promise<RefreshResult> {
  if (refreshInFlight) return refreshInFlight;

  refreshInFlight = (async (): Promise<RefreshResult> => {
    const token = getToken();
    if (!token) return { status: "auth" };

    let res: Response;
    try {
      res = await fetch(`${BASE_URL}/auth/refresh`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      });
    } catch {
      // Erro de rede: não sabemos se o token é válido → NÃO encerrar sessão.
      return { status: "network" };
    }

    // 5xx: problema do servidor, transitório.
    if (res.status >= 500) return { status: "network" };
    // 401/403 (ou similar): token realmente inválido → encerrar sessão.
    if (!res.ok) return { status: "auth" };

    const data = (await res.json().catch(() => null)) as { token?: string; user?: unknown } | null;
    if (!data?.token) return { status: "auth" };

    persistSession(data.token, data.user);
    return { status: "ok", token: data.token };
  })();

  return refreshInFlight.finally(() => { refreshInFlight = null; });
}

// ── HTTP ──────────────────────────────────────────────────────────────────────
async function doFetch(
  method: string,
  path: string,
  body: unknown,
  timeoutMs: number | undefined,
  token: string | null,
): Promise<Response> {
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (token) headers["Authorization"] = `Bearer ${token}`;

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs ?? TIMEOUT_MS);
  try {
    return await fetch(`${BASE_URL}${path}`, {
      method,
      headers,
      body: body !== undefined ? JSON.stringify(body) : undefined,
      signal: controller.signal,
    });
  } finally {
    clearTimeout(timer);
  }
}

function toError(err: unknown): Error {
  if ((err as { name?: string })?.name === "AbortError") {
    return new Error("Timeout: servidor não respondeu a tempo");
  }
  return err instanceof Error ? err : new Error(String(err));
}

async function request(method: string, path: string, body?: unknown, timeoutMs?: number): Promise<unknown> {
  const isRefreshCall = path === "/auth/refresh";

  let res: Response;
  try {
    res = await doFetch(method, path, body, timeoutMs, getToken());
  } catch (err: unknown) {
    throw toError(err);
  }

  // 401 → tenta renovar o token e repetir a requisição uma única vez.
  if (res.status === 401 && !isRefreshCall) {
    const refresh = await refreshSession();
    if (refresh.status === "ok") {
      try {
        res = await doFetch(method, path, body, timeoutMs, refresh.token);
      } catch (err: unknown) {
        throw toError(err);
      }
    } else if (refresh.status === "network") {
      // Transitório: mantém a sessão; deixa o usuário tentar de novo.
      throw new Error("Sem conexão para renovar a sessão. Tente novamente.");
    } else {
      endSession();
      throw new Error("Sua sessão expirou. Entre novamente.");
    }
  }

  if (res.status === 204) return null;

  const data = await res.json().catch(() => null);

  if (!res.ok) {
    const d = data as { message?: string; error?: string } | null;
    throw new Error(d?.message || d?.error || `Erro ${res.status}`);
  }

  return data;
}

export const api = {
  get:    (path: string): Promise<unknown>               => request("GET",    path),
  post:   (path: string, body?: unknown, timeoutMs?: number): Promise<unknown> => request("POST",   path, body, timeoutMs),
  patch:  (path: string, body?: unknown): Promise<unknown> => request("PATCH",  path, body),
  put:    (path: string, body?: unknown): Promise<unknown> => request("PUT",    path, body),
  delete: (path: string): Promise<unknown>               => request("DELETE", path),
};
