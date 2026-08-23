/**
 * syncToBackend.js — Fire-and-forget helper para sincronizar dados com o backend.
 * Usa offline queue para retry automático quando sem conexão.
 */

/**
 * Envia dados ao backend de forma assíncrona (fire-and-forget).
 * @param method  — "POST" | "PUT" | "PATCH"
 * @param endpoint — ex: "/session-usage-logs"
 * @param payload
 */
export function syncToBackend(method: string, endpoint: string, payload: Record<string, unknown>): void {
  import("./syncQueue").then(({ withOfflineFallback }) => {
    withOfflineFallback(method, endpoint, payload);
  });
}
