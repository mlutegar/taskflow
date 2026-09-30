import { api, ApiError } from "../lib/apiClient";

/**
 * Client da sessão de foco EM ANDAMENTO (cross-device).
 *
 * Espelha o padrão de dailyFocusDayState.ts: fire-and-forget nas escritas,
 * silencioso em falha (a sessão vive primeiro no localStorage; o backend é só
 * o ponto de sincronização entre dispositivos).
 *
 * Concorrência otimística por `version` (contador monotônico do servidor) —
 * imune a divergências de relógio entre dispositivos.
 */

export interface RemoteActiveSession {
  date: string;
  /** Snapshot DailyFocusLive (fase, running, remainingSecs, anchorTs, ...). */
  live: unknown | null;
  /** Payload do useSessionPersist ("taskflow_sess_daily_focus"). */
  session: unknown;
  /** Acumulador modeFocusTimer ("taskflow.modeFocusTimer"). */
  focusTimer: unknown | null;
  /** Versão vigente no servidor (base para o próximo PUT). */
  version: number;
  /** Preenchido quando a sessão foi encerrada (tombstone). */
  endedAt: string | null;
  /** ISO — informativo. */
  updatedAt: string;
}

export type UpsertResult =
  | { status: "ok"; version: number; updatedAt: string }
  | { status: "conflict"; version: number; updatedAt: string }
  | { status: "error" };

const PATH = "/daily-focus/active-session";
const TOKEN_KEY = "taskflow.authToken";

export async function fetchActiveSession(): Promise<RemoteActiveSession | null> {
  try {
    return (await api.get(PATH)) as RemoteActiveSession | null;
  } catch {
    return null;
  }
}

export async function upsertActiveSession(
  live: unknown,
  session: unknown,
  focusTimer: unknown | null,
  baseVersion?: number,
): Promise<UpsertResult> {
  try {
    const res = (await api.put(PATH, { live, session, focusTimer, baseVersion })) as {
      version: number;
      updatedAt: string;
    };
    return { status: "ok", version: res.version, updatedAt: res.updatedAt };
  } catch (e) {
    if (e instanceof ApiError && e.status === 409) {
      const d = (e.data ?? {}) as { version?: number; updatedAt?: string };
      return { status: "conflict", version: d.version ?? 0, updatedAt: d.updatedAt ?? "" };
    }
    return { status: "error" };
  }
}

/** Encerra a sessão (tombstone por padrão; `hard` apaga a linha fisicamente). */
export async function deleteActiveSession(hard = false): Promise<void> {
  try {
    await api.delete(hard ? `${PATH}?hard=1` : PATH);
  } catch {
    // fire-and-forget
  }
}

/**
 * Envio best-effort que sobrevive ao fechamento da aba/app (pagehide) via
 * `fetch(keepalive)`. Usado no flush final para não perder o último estado.
 */
export function beaconActiveSession(
  live: unknown,
  session: unknown,
  focusTimer: unknown | null,
  baseVersion?: number,
): void {
  try {
    const token = localStorage.getItem(TOKEN_KEY);
    const base = (import.meta.env.VITE_API_URL as string) || "/api";
    void fetch(`${base}${PATH}`, {
      method: "PUT",
      headers: {
        "Content-Type": "application/json",
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: JSON.stringify({ live, session, focusTimer, baseVersion }),
      keepalive: true,
    }).catch(() => {});
  } catch {
    // noop
  }
}
