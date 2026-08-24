/**
 * migrateLegacyKeys — Migra chaves legadas do localStorage para o padrão "taskflow.".
 * Arquivo propositalmente SEM imports externos para compatibilidade com vite-plugin-pwa.
 * Deve ser chamado UMA VEZ no boot da aplicação (main.tsx), antes do React montar.
 */
export function migrateLegacyKeys(): void {
  const PREFIX = "taskflow.";

  // [chave antiga, sufixo novo]
  const migrations: [string, string][] = [
    // Sem prefixo
    ["customModes",           "customModes"],
    ["modeStats",             "modeStats"],
    ["modeLog",               "modeLog"],
    ["modeComboLogs",         "modeComboLogs"],
    ["modeActivations",       "modeActivations"],
    ["activities",            "activities"],
    ["estadosCustom",         "estadosCustom"],
    ["sessionUsageLog",       "sessionUsageLog"],
    ["checkinLog",            "checkinLog"],
    ["checkinFeedback",       "checkinFeedback"],
    ["splitePinned",          "splite.pinned"],
    ["spliteDismissed",       "splite.dismissed"],
    ["splitePinnedOrder",     "splite.pinnedOrder"],
    ["singableSongs",         "singableSongs"],
    ["singList",              "singList"],
    ["multiCardSessionLog",   "multiCardSessionLog"],
    ["activeMultiCardSession","activeMultiCardSession"],
    // Underscore (formato legado)
    ["taskflow_rpg_save",         "rpgSave"],
    ["taskflow_notification_pref","notificationPref"],
    ["taskflow_lazyfal_saved",    "lazyfalSaved"],
    // Underscore sem prefixo
    ["todayPanel_collapsed",   "todayPanel.collapsed"],
    ["daily_focus_history",    "dailyFocus.history"],
    ["daily_focus_achievements","dailyFocus.achievements"],
    ["daily_focus_max_level",  "dailyFocus.maxLevel"],
    ["daily_focus_max_cycles", "dailyFocus.maxCycles"],
  ];

  for (const [oldKey, newSuffix] of migrations) {
    try {
      const newKey = PREFIX + newSuffix;
      if (localStorage.getItem(newKey) !== null) continue;
      const value = localStorage.getItem(oldKey);
      if (value === null) continue;
      localStorage.setItem(newKey, value);
      localStorage.removeItem(oldKey);
    } catch {
      // silently fail
    }
  }
}
