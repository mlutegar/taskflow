import { api, ApiError } from "../lib/apiClient";

export interface SaveResult {
  ok: boolean;
  /** true = falha definitiva (4xx de validação); não adianta reenviar. */
  permanent: boolean;
}

/**
 * Envia uma sessão ao backend.
 * - `ok: true`            → confirmada (pode marcar como synced).
 * - `ok:false permanent`  → 4xx de validação; não reenviar (marcar failedPermanent).
 * - `ok:false !permanent` → erro transitório (rede/5xx/timeout/429); reenviar com backoff.
 */
export async function saveSession(session: Record<string, unknown>): Promise<SaveResult> {
  try {
    await api.post("/daily-focus/sessions", session);
    return { ok: true, permanent: false };
  } catch (err) {
    const status = err instanceof ApiError ? err.status : 0;
    // 408 (timeout) e 429 (rate limit) são transitórios apesar de 4xx.
    const permanent = status >= 400 && status < 500 && status !== 408 && status !== 429;
    return { ok: false, permanent };
  }
}

interface SessionsPage {
  data?: unknown[];
  pagination?: { page: number; totalPages: number; total: number };
}

/**
 * Busca TODO o histórico de sessões do backend, paginando até esgotar.
 * Antes carregava apenas a 1ª página (máx. 50), perdendo histórico antigo.
 */
export async function fetchSessions(): Promise<unknown[]> {
  const LIMIT = 200; // teto aceito pelo backend
  const MAX_PAGES = 100; // trava de segurança contra loop
  const all: unknown[] = [];
  try {
    let page = 1;
    let totalPages = 1;
    do {
      const resp = (await api.get(`/daily-focus/sessions?page=${page}&limit=${LIMIT}`)) as
        | SessionsPage
        | unknown[]
        | null;

      if (Array.isArray(resp)) {
        // resposta legada sem paginação
        all.push(...resp);
        break;
      }
      const rows = resp?.data ?? [];
      all.push(...rows);
      totalPages = resp?.pagination?.totalPages ?? 1;
      page += 1;
    } while (page <= totalPages && page <= MAX_PAGES);
    return all;
  } catch {
    return all;
  }
}
