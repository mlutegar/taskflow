/**
 * syncQueue.js — Fila offline para requisições que falharam por falta de conexão.
 *
 * Como funciona:
 * - Ao chamar `enqueue(method, path, body)`, o item é salvo no localStorage.
 * - Quando o browser volta a ficar online (evento "online"), `flushQueue()` drena
 *   a fila e tenta reenviar cada item.
 * - Apenas métodos mutáveis (POST, PUT, PATCH, DELETE) são enfileirados.
 * - Itens com mais de 24h são descartados automaticamente.
 *
 * Uso: chamado internamente por `withOfflineFallback()`. Não usar diretamente.
 */

import { api } from "./apiClient";
import { SYNC_QUEUE_MAX } from "../config/constants";

type MutableMethod = "POST" | "PUT" | "PATCH" | "DELETE";

interface QueueItem {
  method: MutableMethod;
  path: string;
  body: unknown;
  ts: number;
}

interface OfflineFallbackResult {
  ok: boolean;
  queued: boolean;
  result?: unknown;
}

const bc: BroadcastChannel | null = typeof BroadcastChannel !== "undefined" ? new BroadcastChannel("taskflow.sync") : null;

const LS_KEY  = "taskflow.syncQueue";
const MAX_AGE = 24 * 60 * 60 * 1000; // 24 horas em ms
const MAX_LEN: number = SYNC_QUEUE_MAX;
const LOCK_KEY = "taskflow.syncQueue.flushLock";
const LOCK_TTL = 10_000;

function now(): number { return Date.now(); }

function load(): QueueItem[] {
  try {
    const raw = localStorage.getItem(LS_KEY);
    if (!raw) return [];
    const items: QueueItem[] = JSON.parse(raw);
    // Descarta itens expirados
    return items.filter((i) => now() - i.ts < MAX_AGE);
  } catch {
    return [];
  }
}

function save(items: QueueItem[]): void {
  const payload = JSON.stringify(items.slice(-MAX_LEN));
  try {
    localStorage.setItem(LS_KEY, payload);
  } catch (err: any) {
    // localStorage cheio (QuotaExceededError): tenta salvar versão reduzida
    if (err?.name === "QuotaExceededError" || err?.code === 22) {
      try {
        // Mantém apenas os últimos 10 itens para liberar espaço
        localStorage.setItem(LS_KEY, JSON.stringify(items.slice(-10)));
        console.warn("[syncQueue] localStorage cheio — fila reduzida para os últimos 10 itens.");
      } catch {
        // Impossível salvar: descarta silenciosamente para não travar o app
        console.error("[syncQueue] Impossível salvar fila offline: localStorage indisponível.");
      }
    }
  }
}

/**
 * Adiciona uma requisição à fila offline.
 * @param method
 * @param path  ex: "/preferences"
 * @param body
 */
export function enqueue(method: MutableMethod, path: string, body: unknown): void {
  const items = load();
  items.push({ method, path, body, ts: now() });
  save(items);
  try { bc?.postMessage("enqueued"); } catch {}
}

/** Retorna o número de itens pendentes na fila. */
export function queueSize(): number {
  return load().length;
}

function acquireLock(): boolean {
  try {
    const ts = Number(localStorage.getItem(LOCK_KEY) || "0");
    const elapsed = performance.now() - ts;
    if (elapsed < LOCK_TTL && ts > 0) return false;
    localStorage.setItem(LOCK_KEY, String(performance.now()));
    return true;
  } catch { return true; }
}

function releaseLock(): void {
  try { localStorage.removeItem(LOCK_KEY); } catch {}
}

/**
 * Tenta reenviar todos os itens da fila.
 * Chamado automaticamente ao voltar online.
 */
export async function flushQueue(): Promise<void> {
  if (!acquireLock()) return;
  const items = load();
  if (!items.length) { releaseLock(); return; }
  const failed: QueueItem[] = [];
  for (const item of items) {
    try {
      await (api as any)[item.method.toLowerCase()](item.path, item.body);
    } catch {
      failed.push(item);
    }
  }
  save(failed);
  releaseLock();
}

// Drena a fila quando o browser volta a ficar online
if (typeof window !== "undefined") {
  window.addEventListener("online", () => {
    // Pequeno delay para garantir que a conexão está estável
    setTimeout(flushQueue, 1_500);
  });
  if (bc) { bc.onmessage = () => {}; }
}

/**
 * Wrapper: tenta executar a requisição imediatamente; se falhar por rede,
 * enfileira para retry. Sempre resolve (nunca rejeita).
 *
 * @param method
 * @param path
 * @param body
 * @returns {Promise<{ok: boolean, queued: boolean, result?: unknown}>}
 */
export async function withOfflineFallback(method: MutableMethod, path: string, body: unknown): Promise<OfflineFallbackResult> {
  try {
    const result = await (api as any)[method.toLowerCase()](path, body);
    return { ok: true, queued: false, result };
  } catch (err: any) {
    // Só enfileira erros de rede/timeout (não erros 4xx/5xx da API)
    const isNetworkErr = !err.message?.startsWith("Erro ") && !(err.message?.includes("401"));
    if (isNetworkErr) {
      enqueue(method, path, body);
      return { ok: false, queued: true };
    }
    return { ok: false, queued: false };
  }
}
