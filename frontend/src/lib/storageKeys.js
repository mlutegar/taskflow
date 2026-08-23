/**
 * Constantes de chaves do localStorage.
 * Centraliza todos os nomes usados no app para evitar typos e inconsistências.
 */
export const STORAGE_KEYS = {
  // Auth
  AUTH_TOKEN: "taskflow.authToken",
  AUTH_USER: "taskflow.authUser",

  // Check-in / Daily Focus
  CHECKIN_LAST_ESTADO: "taskflow.checkin.lastEstado",
  DAILY_FOCUS_STATE: "taskflow.dailyFocus.state",

  // Preferências de usuário (mirror de server-side)
  WEEKLY_GOAL: "taskflow.weeklyGoal",
  FAVORITE_MODES: "taskflow.favoriteModes",

  // Modos customizados
  CUSTOM_MODES: "taskflow.customModes",
  DELETED_MODE_IDS: "taskflow.deletedModeIds",

  // Dados offline / fila de sync
  SYNC_QUEUE: "taskflow.syncQueue",
  OFFLINE_SESSION_LOGS: "taskflow.offlineSessionLogs",
};
