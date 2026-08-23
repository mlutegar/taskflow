/**
 * historyCache.js — Cache em memória com TTL para dados remotos do Histórico.
 *
 * Evita re-fetches desnecessários ao navegar entre páginas enquanto os dados
 * ainda estão frescos. O cache vive apenas na sessão (sem persistência).
 */

const TTL_MS = 60_000; // 1 minuto

interface CacheEntry {
  data: unknown;
  ts: number;
}

const _cache = new Map<string, CacheEntry>();

/** Retorna dado em cache se ainda válido, ou null se expirado/ausente. */
export function cacheGet(key: string): unknown {
  const entry = _cache.get(key);
  if (!entry) return null;
  if (Date.now() - entry.ts > TTL_MS) {
    _cache.delete(key);
    return null;
  }
  return entry.data;
}

/** Armazena dado no cache com timestamp atual. */
export function cacheSet(key: string, data: unknown): void {
  _cache.set(key, { data, ts: Date.now() });
}

/** Invalida uma chave específica (ou todo o cache se key omitida). */
export function cacheInvalidate(key?: string): void {
  if (key !== undefined) _cache.delete(key);
  else _cache.clear();
}
