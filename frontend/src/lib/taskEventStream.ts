import { apiConnection } from "./apiClient";
import type { TaskRecord } from "../types/tasks";

export interface TaskServerEvent {
  id: number;
  at: string;
  type: "task-changed" | "task-deleted";
  taskId?: string;
  changeId?: number;
  /** Payload da tarefa (quando a ação é de nível de tarefa) — evita um GET extra. */
  task?: TaskRecord;
}

export function parseSseBlock(block: string): TaskServerEvent | null {
  const data = block.split(/\r?\n/)
    .filter((line) => line.startsWith("data:"))
    .map((line) => line.slice(5).trim())
    .join("\n");
  if (!data) return null;
  try {
    const parsed = JSON.parse(data);
    return parsed?.type === "task-changed" || parsed?.type === "task-deleted" ? parsed : null;
  } catch { return null; }
}

export function subscribeRemoteTaskEvents(
  onEvent: (event: TaskServerEvent) => void,
  onStatus?: (connected: boolean) => void,
): () => void {
  let stopped = false;
  let controller: AbortController | null = null;
  let retryTimer: ReturnType<typeof setTimeout> | null = null;
  let retryMs = 1_000;

  const connect = async () => {
    if (stopped || !navigator.onLine) return;
    const { baseUrl, token } = apiConnection();
    if (!token) return;
    controller = new AbortController();
    try {
      const response = await fetch(`${baseUrl}/tasks/sync/events`, {
        headers: { Authorization: `Bearer ${token}`, Accept: "text/event-stream" },
        signal: controller.signal,
      });
      if (!response.ok || !response.body) throw new Error(`SSE ${response.status}`);
      retryMs = 1_000;
      onStatus?.(true);
      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";
      while (!stopped) {
        const { value, done } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const blocks = buffer.split(/\r?\n\r?\n/);
        buffer = blocks.pop() ?? "";
        for (const block of blocks) {
          const event = parseSseBlock(block);
          if (event) onEvent(event);
        }
      }
    } catch (error) {
      if ((error as { name?: string })?.name === "AbortError") { onStatus?.(false); return; }
    }
    onStatus?.(false);
    if (!stopped) {
      retryTimer = setTimeout(connect, retryMs);
      retryMs = Math.min(retryMs * 2, 30_000);
    }
  };

  const onOnline = () => { controller?.abort(); connect(); };
  window.addEventListener("online", onOnline);
  connect();
  return () => {
    stopped = true;
    controller?.abort();
    if (retryTimer) clearTimeout(retryTimer);
    window.removeEventListener("online", onOnline);
  };
}
