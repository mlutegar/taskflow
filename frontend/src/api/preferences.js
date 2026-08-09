/**
 * API client para preferências do usuário e ativações de modo.
 * Todas as chamadas são fire-and-forget no uso normal.
 */
import { api } from "../lib/apiClient";

/**
 * Busca todas as preferências do usuário do backend.
 * @returns {{ customModes, weeklyGoal, activities, estadosCustom, paperReminders }}
 */
export function fetchPreferences() {
  return api.get("/preferences");
}

/**
 * Atualiza campos específicos das preferências (patch parcial).
 * Apenas os campos enviados serão alterados.
 * @param {object} patch
 */
export function updatePreferences(patch) {
  return api.put("/preferences", patch);
}

/**
 * Registra uma ativação de modo no backend.
 * @param {string} modeId
 * @param {string} date  YYYY-MM-DD
 */
export function postModeActivation(modeId, date) {
  return api.post("/preferences/mode-activations", { modeId, date });
}

/**
 * Busca o histórico de ativações de modo (últimos 365 dias).
 * @returns {{ modeId: string, date: string }[]}
 */
export function fetchModeActivations() {
  return api.get("/preferences/mode-activations");
}
