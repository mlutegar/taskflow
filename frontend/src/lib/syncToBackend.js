/**
 * syncToBackend.js — Fire-and-forget helper para sincronizar dados com o backend.
 * Usa offline queue para retry automático quando sem conexão.
 */

/**
 * Envia dados ao backend de forma assíncrona (fire-and-forget).
 * @param {string} method  — "POST" | "PUT" | "PATCH"
 * @param {string} endpoint — ex: "/session-usage-logs"
 * @param {object} payload
 */
export function syncToBackend(method, endpoint, payload) {
  import("./syncQueue").then(({ withOfflineFallback }) => {
    withOfflineFallback(method, endpoint, payload);
  });
}
