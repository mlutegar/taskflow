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

export interface RequestOptions {
  timeoutMs?: number;
  idempotencyKey?: string;
}

export class ApiError extends Error {
  constructor(message: string, public status: number, public data: unknown) {
    super(message);
    this.name = "ApiError";
  }
}

export function apiConnection(): { baseUrl: string; token: string | null } {
  return { baseUrl: BASE_URL, token: getToken() };
}

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

// Single-flight: apenas 1 refresh por vez. Guardamos também o token que está
// sendo renovado — se o token do localStorage mudar no meio (troca de conta ou
// outra aba renovou), o refresh em voo é irrelevante e iniciamos um novo.
let refreshInFlight: Promise<RefreshResult> | null = null;
let refreshInFlightToken: string | null = null;

export function refreshSession(): Promise<RefreshResult> {
  const current = getToken();
  if (refreshInFlight && refreshInFlightToken === current) return refreshInFlight;

  refreshInFlightToken = current;
  const p = (async (): Promise<RefreshResult> => {
    const token = getToken();
    if (!token) return { status: "auth" };

    let res: Response;
    // Timeout via fetchWithTimeout (paridade com doFetch). Sem isso, um
    // /auth/refresh travado (backend frio/rede lenta na primeira conexão)
    // deixaria a Promise pendente para sempre → a query que aguarda o refresh
    // nunca settla e a UI fica presa no skeleton. Abortando, cai em { network }.
    try {
      res = await fetchWithTimeout(`${BASE_URL}/auth/refresh`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: "{}",
      });
    } catch {
      // Erro de rede OU abort por timeout: não sabemos se o token é válido →
      // NÃO encerrar sessão (transitório).
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

  refreshInFlight = p;
  // Só limpa o singleton se ainda for este refresh (evita que o finally de um
  // refresh antigo apague um novo iniciado após troca de token).
  p.finally(() => {
    if (refreshInFlight === p) { refreshInFlight = null; refreshInFlightToken = null; }
  });
  return p;
}

/**
 * Aquece o backend com uma chamada leve e sem auth logo após o login,
 * absorvendo a latência de cold start antes das queries pesadas. Best-effort:
 * qualquer falha é ignorada (o retry/backoff do React Query cobre o resto).
 */
export function warmUpBackend(): void {
  fetchWithTimeout(`${BASE_URL}/health`, { method: "GET" }).catch(() => {});
}

// ── HTTP ──────────────────────────────────────────────────────────────────────
/**
 * fetch com timeout via AbortController. Fonte única do padrão de timeout —
 * usado por doFetch e refreshSession para evitar chamadas que "esquecem" o
 * timeout (origem do bug de skeleton infinito).
 */
async function fetchWithTimeout(
  url: string,
  init: RequestInit,
  timeoutMs: number = TIMEOUT_MS,
): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, { ...init, signal: controller.signal });
  } finally {
    clearTimeout(timer);
  }
}

async function doFetch(
  method: string,
  path: string,
  body: unknown,
  options: RequestOptions,
  token: string | null,
): Promise<Response> {
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (token) headers["Authorization"] = `Bearer ${token}`;
  if (options.idempotencyKey) headers["X-Idempotency-Key"] = options.idempotencyKey;
  try {
    headers["X-Timezone"] = Intl.DateTimeFormat().resolvedOptions().timeZone || "America/Sao_Paulo";
  } catch {
    headers["X-Timezone"] = "America/Sao_Paulo";
  }

  return fetchWithTimeout(
    `${BASE_URL}${path}`,
    {
      method,
      headers,
      body: body !== undefined ? JSON.stringify(body) : undefined,
    },
    options.timeoutMs ?? TIMEOUT_MS,
  );
}

function toError(err: unknown): Error {
  if ((err as { name?: string })?.name === "AbortError") {
    return new Error("Timeout: servidor não respondeu a tempo");
  }
  return err instanceof Error ? err : new Error(String(err));
}

async function request(method: string, path: string, body?: unknown, options: RequestOptions = {}): Promise<unknown> {
  const isRefreshCall = path === "/auth/refresh";

  let res: Response;
  try {
    res = await doFetch(method, path, body, options, getToken());
  } catch (err: unknown) {
    throw toError(err);
  }

  // 401 → tenta renovar o token e repetir a requisição uma única vez.
  if (res.status === 401 && !isRefreshCall) {
    const refresh = await refreshSession();
    if (refresh.status === "ok") {
      try {
        res = await doFetch(method, path, body, options, refresh.token);
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
    throw new ApiError(d?.message || d?.error || `Erro ${res.status}`, res.status, data);
  }

  return data;
}

export const api = {
  get:    (path: string): Promise<unknown>               => request("GET",    path),
  post:   (path: string, body?: unknown, timeoutOrOptions?: number | RequestOptions): Promise<unknown> =>
    request("POST", path, body, typeof timeoutOrOptions === "number" ? { timeoutMs: timeoutOrOptions } : timeoutOrOptions),
  patch:  (path: string, body?: unknown, options?: RequestOptions): Promise<unknown> => request("PATCH", path, body, options),
  put:    (path: string, body?: unknown, options?: RequestOptions): Promise<unknown> => request("PUT", path, body, options),
  delete: (path: string, options?: RequestOptions): Promise<unknown> => request("DELETE", path, undefined, options),
};
