import { api, ApiError, type RequestOptions } from "./apiClient";

export type QueuedMethod = "POST" | "PATCH" | "DELETE";
export interface QueuedTaskMutation {
  id: string;
  ownerId: string | null;
  method: QueuedMethod;
  path: string;
  body?: unknown;
  createdAt: number;
  attempts: number;
  lastError?: string;
}

const DB_NAME = "taskflow-sync";
const STORE = "task-mutations";
const QUEUE_EVENT = "taskflow:offline-queue";

export class QueuedOfflineError extends Error {
  constructor(public queueId: string) {
    super("Alteração guardada para sincronizar quando a conexão voltar.");
    this.name = "QueuedOfflineError";
  }
}

export function isQueuedOfflineError(error: unknown): error is QueuedOfflineError {
  return error instanceof QueuedOfflineError;
}

function currentOwnerId(): string | null {
  try { return JSON.parse(localStorage.getItem("taskflow.authUser") || "null")?.id ?? null; } catch { return null; }
}

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, 1);
    request.onupgradeneeded = () => {
      if (!request.result.objectStoreNames.contains(STORE)) request.result.createObjectStore(STORE, { keyPath: "id" });
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

async function transaction<T>(mode: IDBTransactionMode, work: (store: IDBObjectStore) => IDBRequest<T>): Promise<T> {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, mode);
    const request = work(tx.objectStore(STORE));
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
    tx.oncomplete = () => db.close();
    tx.onerror = () => reject(tx.error);
  });
}

function notify(): void {
  window.dispatchEvent(new Event(QUEUE_EVENT));
}

export async function listQueuedTaskMutations(): Promise<QueuedTaskMutation[]> {
  const rows = await transaction<QueuedTaskMutation[]>("readonly", (store) => store.getAll());
  const owner = currentOwnerId();
  return rows.filter((row) => row.ownerId === owner).sort((a, b) => a.createdAt - b.createdAt);
}

export async function queuedTaskMutationCount(): Promise<number> {
  return (await listQueuedTaskMutations()).length;
}

export async function enqueueTaskMutation(method: QueuedMethod, path: string, body?: unknown, key = crypto.randomUUID()): Promise<string> {
  const item: QueuedTaskMutation = {
    id: key, ownerId: currentOwnerId(), method, path, body, createdAt: Date.now(), attempts: 0,
  };
  await transaction("readwrite", (store) => store.put(item));
  notify();
  return key;
}

async function remove(id: string): Promise<void> {
  await transaction("readwrite", (store) => store.delete(id));
}

async function update(item: QueuedTaskMutation): Promise<void> {
  await transaction("readwrite", (store) => store.put(item));
}

async function execute(item: QueuedTaskMutation): Promise<unknown> {
  const options: RequestOptions = { idempotencyKey: item.id };
  if (item.method === "POST") return api.post(item.path, item.body, options);
  if (item.method === "PATCH") return api.patch(item.path, item.body, options);
  return api.delete(item.path, options);
}

let flushInFlight: Promise<number> | null = null;
export function flushTaskMutationQueue(): Promise<number> {
  if (flushInFlight) return flushInFlight;
  flushInFlight = (async () => {
    if (!navigator.onLine) return queuedTaskMutationCount();
    for (const item of await listQueuedTaskMutations()) {
      try {
        const result = await execute(item);
        await remove(item.id);
        window.dispatchEvent(new CustomEvent("taskflow:queued-mutation-synced", { detail: { item, result } }));
      } catch (error) {
        // 4xx permanentes exigem decisão do usuário; conflitos ficam na fila
        // para poderem ser resolvidos pela interface.
        item.attempts += 1;
        item.lastError = error instanceof Error ? error.message : String(error);
        await update(item);
        if (!(error instanceof ApiError) || error.status >= 500 || error.status === 429) break;
      }
    }
    notify();
    return queuedTaskMutationCount();
  })().finally(() => { flushInFlight = null; });
  return flushInFlight;
}

export function subscribeTaskQueue(listener: (count: number) => void): () => void {
  const refresh = () => queuedTaskMutationCount().then(listener).catch(() => listener(0));
  window.addEventListener(QUEUE_EVENT, refresh);
  window.addEventListener("online", flushTaskMutationQueue);
  window.addEventListener("online", refresh);
  refresh();
  return () => {
    window.removeEventListener(QUEUE_EVENT, refresh);
    window.removeEventListener("online", flushTaskMutationQueue);
    window.removeEventListener("online", refresh);
  };
}

function isTransient(error: unknown): boolean {
  return !navigator.onLine || !(error instanceof ApiError) || error.status >= 500 || error.status === 429;
}

export async function queueableTaskMutation<T>(method: QueuedMethod, path: string, body?: unknown): Promise<T> {
  const key = crypto.randomUUID();
  try {
    const options: RequestOptions = { idempotencyKey: key };
    if (method === "POST") return await api.post(path, body, options) as T;
    if (method === "PATCH") return await api.patch(path, body, options) as T;
    return await api.delete(path, options) as T;
  } catch (error) {
    if (!isTransient(error)) throw error;
    await enqueueTaskMutation(method, path, body, key);
    throw new QueuedOfflineError(key);
  }
}
