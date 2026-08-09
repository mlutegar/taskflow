/**
 * userPreferences.js
 * Camada de persistência para preferências do usuário.
 * Padrão: localStorage (cache local) + backend SQLite na VPS (fonte da verdade).
 *
 * Chamado no boot do app para mesclar dados remotos com localStorage.
 */

import { fetchPreferences } from "../api/preferences";

const LS_CUSTOM_MODES    = "customModes";
const LS_DELETED_MODES   = "taskflow.deletedModeIds";
const LS_WEEKLY_GOAL     = "taskflow.weeklyGoal";
const LS_ACTIVITIES      = "taskflow.activities";
const LS_ESTADOS_CUSTOM  = "taskflow.checkin.estadosCustom";
const LS_PAPER_REMINDERS = "taskflow.paperReminders";
const LS_LAST_ESTADO     = "taskflow.checkin.lastEstado";
const LS_ONBOARDED       = "taskflow.checkin.onboarded";

function lsGet(key, fallback) {
  try {
    const raw = localStorage.getItem(key);
    if (raw === null) return fallback;
    return JSON.parse(raw);
  } catch {
    return fallback;
  }
}

function lsSet(key, value) {
  try { localStorage.setItem(key, JSON.stringify(value)); } catch {}
}

/**
 * Carrega preferências do backend e mescla com localStorage.
 *
 * Regras de merge:
 * - customModes:    remoto, filtrando IDs que o usuário deletou localmente
 * - deletedModeIds: union de local + remoto
 * - weeklyGoal:     remoto vence (se não houver valor local)
 * - activities:     remoto vence se tiver mais itens
 * - estadosCustom:  remoto vence se não-vazio e local não existe
 * - paperReminders: remoto vence se tiver mais itens
 * - lastEstadoId:   remoto vence se local não existe
 * - onboarded:      remoto vence (true não é revertido)
 */
export async function loadRemotePreferences() {
  try {
    const remote = await fetchPreferences();
    if (!remote) return;

    // deletedModeIds: union de local + remoto
    const localDeletedArr  = lsGet(LS_DELETED_MODES, []);
    const remoteDeletedArr = remote.deletedModeIds ?? [];
    const deletedSet = new Set([...localDeletedArr, ...remoteDeletedArr]);
    if (deletedSet.size > localDeletedArr.length) {
      try { localStorage.setItem(LS_DELETED_MODES, JSON.stringify([...deletedSet])); } catch {}
    }

    // customModes: mescla por ID, respeitando deletedSet
    if (Array.isArray(remote.customModes) && remote.customModes.length > 0) {
      const localModes  = lsGet(LS_CUSTOM_MODES, []);
      const localIds    = new Set(localModes.map((m) => m.id));
      // Adiciona modos remotos que não existem localmente e não foram deletados
      const incoming = remote.customModes.filter((m) => !localIds.has(m.id) && !deletedSet.has(m.id));
      if (incoming.length > 0) {
        lsSet(LS_CUSTOM_MODES, [...localModes, ...incoming]);
      }
    }

    // weeklyGoal: remoto vence se local não existe
    if ([3, 5, 7].includes(remote.weeklyGoal)) {
      const localGoal = localStorage.getItem(LS_WEEKLY_GOAL);
      if (!localGoal) {
        localStorage.setItem(LS_WEEKLY_GOAL, String(remote.weeklyGoal));
      }
    }

    // activities: pega o maior conjunto
    const localActivities = lsGet(LS_ACTIVITIES, null);
    if (Array.isArray(remote.activities) && remote.activities.length > 0) {
      if (!localActivities || remote.activities.length > localActivities.length) {
        lsSet(LS_ACTIVITIES, remote.activities);
      }
    }

    // estadosCustom: remoto vence se não-vazio e local não existe
    const localEstados = localStorage.getItem(LS_ESTADOS_CUSTOM);
    if (Array.isArray(remote.estadosCustom) && remote.estadosCustom.length > 0 && !localEstados) {
      lsSet(LS_ESTADOS_CUSTOM, remote.estadosCustom);
    }

    // paperReminders: pega o maior conjunto
    const localPaper = lsGet(LS_PAPER_REMINDERS, null);
    if (Array.isArray(remote.paperReminders) && remote.paperReminders.length > 0) {
      if (!localPaper || remote.paperReminders.length > localPaper.length) {
        lsSet(LS_PAPER_REMINDERS, remote.paperReminders);
      }
    }

    // lastEstadoId: remoto vence se local não existe
    if (remote.lastEstadoId && !localStorage.getItem(LS_LAST_ESTADO)) {
      try { localStorage.setItem(LS_LAST_ESTADO, remote.lastEstadoId); } catch {}
    }

    // onboarded: true não é revertido
    if (remote.onboarded && !localStorage.getItem(LS_ONBOARDED)) {
      try { localStorage.setItem(LS_ONBOARDED, "1"); } catch {}
    }

  } catch {
    // falha silenciosa — app funciona offline
  }
}
