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

const LS_KEY  = "taskflow.syncQueue";
const MAX_AGE = 24 * 60 * 60 * 1000; // 24 horas em ms
const MAX_LEN = 200;

function now() { return Date.now(); }

function load() {
  try {
    const raw = localStorage.getItem(LS_KEY);
    if (!raw) return [];
    const items = JSON.parse(raw);
    // Descarta itens expirados
    return items.filter((i) => now() - i.ts < MAX_AGE);
  } catch {
    return [];
  }
}

function save(items) {
  try {
    localStorage.setItem(LS_KEY, JSON.stringify(items.slice(-MAX_LEN)));
  } catch {}
}

/**
 * Adiciona uma requisição à fila offline.
 * @param {"POST"|"PUT"|"PATCH"|"DELETE"} method
 * @param {string} path  ex: "/preferences"
 * @param {any}    body
 */
export function enqueue(method, path, body) {
  const items = load();
  items.push({ method, path, body, ts: now() });
  save(items);
}

/** Retorna o número de itens pendentes na fila. */
export function queueSize() {
  return load().length;
}

let _flushing = false;

/**
 * Tenta reenviar todos os itens da fila.
 * Chamado automaticamente ao voltar online.
 */
export async function flushQueue() {
  if (_flushing) return;
  _flushing = true;

  const items = load();
  if (!items.length) { _flushing = false; return; }

  const failed = [];
  for (const item of items) {
    try {
      await api[item.method.toLowerCase()](item.path, item.body);
    } catch {
      // Se ainda falhar, mantém na fila
      failed.push(item);
    }
  }

  save(failed);
  _flushing = false;
}

// Drena a fila quando o browser volta a ficar online
if (typeof window !== "undefined") {
  window.addEventListener("online", () => {
    // Pequeno delay para garantir que a conexão está estável
    setTimeout(flushQueue, 1_500);
  });
}

/**
 * Wrapper: tenta executar `fn` imediatamente; se falhar por rede,
 * enfileira para retry. Retorna Promise que sempre resolve (nunca rejeita).
 *
 * @param {"POST"|"PUT"|"PATCH"|"DELETE"} method
 * @param {string} path
 * @param {any}    body
 */
export async function withOfflineFallback(method, path, body) {
  try {
    return await api[method.toLowerCase()](path, body);
  } catch (err) {
    // Só enfileira erros de rede/timeout (não erros 4xx/5xx da API)
    const isNetworkErr = !err.message?.startsWith("Erro ") && !(err.message?.includes("401"));
    if (isNetworkErr) {
      enqueue(method, path, body);
    }
    // Não propaga — fire-and-forget com fallback
    return null;
  }
}
