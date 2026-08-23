// notifications.js — Utilitário de Notificações Web para TaskFlow PWA

const STORAGE_KEY = "taskflow_notification_pref";

export function isSupported() {
  return "Notification" in window && "serviceWorker" in navigator;
}

export function getPermission() {
  if (!isSupported()) return "unsupported";
  return Notification.permission; // 'default' | 'granted' | 'denied'
}

export async function requestPermission() {
  if (!isSupported()) return false;
  const result = await Notification.requestPermission();
  return result === "granted";
}

export function savePreference(enabled) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ enabled, updatedAt: Date.now() }));
  } catch {}
}

export function loadPreference() {
  try { return JSON.parse(localStorage.getItem(STORAGE_KEY) || "{}"); } catch { return {}; }
}

export function showNotification(title, options = {}) {
  if (getPermission() !== "granted") return;
  const pref = loadPreference();
  if (pref.enabled === false) return;

  const defaults = {
    icon: "/taskflow/icons/icon-192x192.png",
    badge: "/taskflow/icons/icon-192x192.png",
    tag: "taskflow",
    renotify: false,
    silent: false,
  };

  if ("serviceWorker" in navigator && navigator.serviceWorker.controller) {
    navigator.serviceWorker.ready.then((reg) => {
      reg.showNotification(title, { ...defaults, ...options });
    });
  } else {
    new Notification(title, { ...defaults, ...options });
  }
}

/**
 * Agenda um lembrete 30 minutos antes do prazo da tarefa.
 * Retorna o timeoutId (use clearTimeout para cancelar).
 */
export function scheduleTaskReminder(task) {
  if (!task.due_date || getPermission() !== "granted") return null;
  const dueDate = new Date(task.due_date);
  const reminderTime = dueDate.getTime() - 30 * 60 * 1000;
  const now = Date.now();
  if (reminderTime <= now) return null;

  const timeoutId = setTimeout(() => {
    showNotification(`⏰ Tarefa próxima do prazo: ${task.title}`, {
      body: `Prazo: ${dueDate.toLocaleString("pt-BR")}`,
      tag: `task-reminder-${task.id}`,
      renotify: true,
      data: { taskId: task.id, url: "/taskflow/" },
    });
  }, reminderTime - now);

  return timeoutId;
}

/** Cancela todos os lembretes agendados (chamar no logout). */
export function cancelAllReminders(timeoutIds = []) {
  timeoutIds.forEach((id) => clearTimeout(id));
}
