const CHANNEL_NAME = "taskflow-tasks";
const STORAGE_KEY = "taskflow.tasksChangedAt";
const sourceId = `${Date.now()}-${Math.random().toString(36).slice(2)}`;

type TaskSyncMessage = { type: "tasks-changed"; sourceId: string; at: number };

const channel: BroadcastChannel | null =
  typeof BroadcastChannel !== "undefined" ? new BroadcastChannel(CHANNEL_NAME) : null;

export function broadcastTasksChanged(): void {
  const message: TaskSyncMessage = { type: "tasks-changed", sourceId, at: Date.now() };
  channel?.postMessage(message);
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(message)); } catch { /* storage indisponível */ }
}

export function subscribeToTaskChanges(onChange: () => void): () => void {
  const onMessage = (event: MessageEvent<TaskSyncMessage>): void => {
    if (event.data?.type === "tasks-changed" && event.data.sourceId !== sourceId) onChange();
  };
  const onStorage = (event: StorageEvent): void => {
    if (event.key !== STORAGE_KEY || !event.newValue) return;
    try {
      const message = JSON.parse(event.newValue) as TaskSyncMessage;
      if (message.type === "tasks-changed" && message.sourceId !== sourceId) onChange();
    } catch { /* valor externo inválido */ }
  };

  channel?.addEventListener("message", onMessage);
  window.addEventListener("storage", onStorage);
  return () => {
    channel?.removeEventListener("message", onMessage);
    window.removeEventListener("storage", onStorage);
  };
}
