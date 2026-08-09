/**
 * customModes.js — Gerenciamento centralizado de modos customizados.
 * Persiste em localStorage + sync com backend (fire-and-forget, retry offline).
 *
 * Rastreia `deletedModeIds` para evitar que modos deletados voltem ao fazer merge remoto.
 */

import { withOfflineFallback } from "./syncQueue";

const LS_MODES   = "customModes";          // sem prefixo taskflow. (legado)
const LS_DELETED = "taskflow.deletedModeIds";

// ── Leitura ───────────────────────────────────────────────────────────────────

/** Retorna todos os modos customizados do usuário. */
export function getCustomModes() {
  try {
    const raw = localStorage.getItem(LS_MODES);
    if (!raw) return [];
    const list = JSON.parse(raw);
    return Array.isArray(list) ? list : [];
  } catch {
    return [];
  }
}

/** Retorna o Set de IDs de modos que o usuário deletou. */
export function getDeletedModeIds() {
  try {
    const raw = localStorage.getItem(LS_DELETED);
    if (!raw) return new Set();
    return new Set(JSON.parse(raw));
  } catch {
    return new Set();
  }
}

// ── Escrita ───────────────────────────────────────────────────────────────────

function _persistModes(modes) {
  try { localStorage.setItem(LS_MODES, JSON.stringify(modes)); } catch {}
}

function _persistDeleted(ids) {
  try { localStorage.setItem(LS_DELETED, JSON.stringify([...ids])); } catch {}
}

function _syncToBackend(modes, deletedIds) {
  withOfflineFallback("PUT", "/preferences", {
    customModes:    modes,
    deletedModeIds: [...deletedIds],
  });
}

/** Adiciona um novo modo customizado. */
export function saveCustomMode(newMode) {
  if (!newMode?.id) return;
  const modes = getCustomModes().filter((m) => m.id !== newMode.id);
  const updated = [...modes, newMode];
  _persistModes(updated);

  // Remove da lista de deletados (caso seja recriação)
  const deleted = getDeletedModeIds();
  deleted.delete(newMode.id);
  _persistDeleted(deleted);

  _syncToBackend(updated, deleted);
  return updated;
}

/** Remove um modo customizado pelo ID. */
export function deleteCustomMode(id) {
  if (!id) return;
  const updated = getCustomModes().filter((m) => m.id !== id);
  _persistModes(updated);

  // Marca como deletado para o merge remoto ignorar
  const deleted = getDeletedModeIds();
  deleted.add(id);
  _persistDeleted(deleted);

  _syncToBackend(updated, deleted);
  return updated;
}
