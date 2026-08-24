/**
 * Constantes de chaves do localStorage.
 * Centraliza todos os nomes usados no app para evitar typos e inconsistências.
 *
 * SK  — sufixos para usar com storageGet/storageSet (que prefixam "taskflow." automaticamente).
 *       Ex: storageGet(SK.MODE_STATS)  →  lê "taskflow.modeStats"
 *
 * STORAGE_KEYS — chaves completas (legado, mantidas para compatibilidade com código
 *                que ainda usa localStorage diretamente com a chave total).
 */

// ── Sufixos (use com storageGet / storageSet) ─────────────────────────────────
export const SK = {
  // Auth
  AUTH_TOKEN:            "authToken",
  AUTH_USER:             "authUser",

  // App / navegação
  ACTIVE_TAB:                  "activeTab",
  ACTIVE_MULTI_CARD_SESSION:   "activeMultiCardSession",
  MULTI_CARD_SESSION_LOG:      "multiCardSessionLog",

  // Modes Panel
  MODES_SORT_BY:        "modesSortBy",
  MODES_CATEGORY:       "modesCategory",
  MODES_SEQUENCE:       "sequenceStarted",
  MODES_SAVED_SHUFFLES: "savedShuffles",
  MODES_GUIDED:         "guidedMode",
  MODES_SMART_SHUFFLE:  "smartShuffle",
  MODES_RANDOM_SEED:    "modesRandomSeed",
  MODES_FAVORITE:       "favoriteModes",
  MODE_STATS:           "modeStats",
  MODE_LOG:             "modeLog",
  MODE_COMBO_LOGS:      "modeComboLogs",
  MODE_ACTIVATIONS:     "modeActivations",

  // Custom modes
  CUSTOM_MODES:         "customModes",
  DELETED_MODE_IDS:     "deletedModeIds",

  // Check-in / Daily Focus
  CHECKIN_LAST_ESTADO:  "checkin.lastEstado",
  CHECKIN_ONBOARDED:    "checkin.onboarded",
  CHECKIN_ESTADOS_CUSTOM: "checkin.estadosCustom",
  CHECKIN_LOG:          "checkinLog",
  CHECKIN_FEEDBACK:     "checkinFeedback",
  DAILY_FOCUS_DAY:      "dailyFocus.day",
  DAILY_FOCUS_HISTORY:  "dailyFocus.history",
  DAILY_FOCUS_ACHIEVEMENTS: "dailyFocus.achievements",
  DAILY_FOCUS_MAX_LEVEL:   "dailyFocus.maxLevel",
  DAILY_FOCUS_MAX_CYCLES:  "dailyFocus.maxCycles",

  // Preferências
  WEEKLY_SUMMARY_LAST_SHOWN: "weeklySummary.lastShown",
  WEEKLY_GOAL:          "weeklyGoal",
  WEEKLY_INTENTIONS:    "weeklyIntentions",
  PAPER_REMINDERS:      "paperReminders",
  SESSION_REMINDERS:    "sessionReminders",

  // Activities / estados
  ACTIVITIES:           "activities",
  ESTADOS_CUSTOM:       "estadosCustom",

  // Session
  SESSION_USAGE_LOG:    "sessionUsageLog",
  SESSION_MODE:         "sessionMode",
  SESSION_STARTED_AT:   "sessionStartedAt",  // timestamp ISO de início da sessão ativa
  SESSION_TEMPLATES:    "sessionTemplates",
  AUTO_ADVANCE_MINUTES: "autoAdvanceMinutes",

  // Sync
  SYNC_QUEUE:           "syncQueue",
  SYNC_QUEUE_LOCK:      "syncQueue.flushLock",
  OFFLINE_SESSION_LOGS: "offlineSessionLogs",

  // RPG / Notificações
  RPG_SAVE:             "rpgSave",
  NOTIFICATION_PREF:    "notificationPref",
  STREAK_NOTIFIED_DATE: "streakNotifiedDate",

  // UI State
  TODAY_PANEL_COLLAPSED: "todayPanel.collapsed",
  SLOT_BOARD:           "slotBoard",
  SLOT_BOARD_TEMPLATES: "slotBoard.templates",
  SLOT_BOARD_MODE:      "slotBoard.mode",

  // Sing
  SINGABLE_SONGS:       "singableSongs",
  SING_LIST:            "singList",

  // Splite
  SPLITE_PINNED:        "splite.pinned",
  SPLITE_DISMISSED:     "splite.dismissed",
  SPLITE_PINNED_ORDER:  "splite.pinnedOrder",
  SPLITE_RECORD:        "splite.record",

  // Lazy Falcon
  LAZYFAL_SAVED:        "lazyfalSaved",

  // Task Slot presets (daily focus)
  TASK_SLOT_PRESETS:    "taskSlot.presets",
} as const;

// ── Chaves completas (legado — preferir SK acima para código novo) ────────────
export const STORAGE_KEYS: Record<string, string> = {
  AUTH_TOKEN:          "taskflow.authToken",
  AUTH_USER:           "taskflow.authUser",
  CHECKIN_LAST_ESTADO: "taskflow.checkin.lastEstado",
  DAILY_FOCUS_STATE:   "taskflow.dailyFocus.state",
  WEEKLY_GOAL:         "taskflow.weeklyGoal",
  FAVORITE_MODES:      "taskflow.favoriteModes",
  CUSTOM_MODES:        "taskflow.customModes",
  DELETED_MODE_IDS:    "taskflow.deletedModeIds",
  SYNC_QUEUE:          "taskflow.syncQueue",
  OFFLINE_SESSION_LOGS: "taskflow.offlineSessionLogs",
};
