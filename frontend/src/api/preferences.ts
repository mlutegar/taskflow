/**
 * API client para preferências do usuário e ativações de modo.
 * Todas as chamadas são fire-and-forget no uso normal.
 */
import { api } from "../lib/apiClient";

/**
 * Busca todas as preferências do usuário do backend.
 * @returns {{ customModes, weeklyGoal, activities, estadosCustom, paperReminders }}
 */
export function fetchPreferences(): Promise<unknown> {
  return api.get("/preferences");
}

/**
 * Atualiza campos específicos das preferências (patch parcial).
 * Apenas os campos enviados serão alterados.
 * @param {object} patch
 */
export function updatePreferences(patch: Record<string, unknown>): Promise<unknown> {
  return api.put("/preferences", patch);
}

/**
 * Registra uma ativação de modo no backend.
 * @param {string} modeId
 * @param {string} date  YYYY-MM-DD
 */
export function postModeActivation(modeId: string, date: string): Promise<unknown> {
  return api.post("/preferences/mode-activations", { modeId, date });
}

/**
 * Busca o histórico de ativações de modo (últimos 365 dias).
 * @returns {{ modeId: string, date: string }[]}
 */
export function fetchModeActivations(): Promise<unknown> {
  return api.get("/preferences/mode-activations");
}
