// Lista pessoal de músicas/álbuns que o usuário gosta de cantar.
// Usada pelo CantarHelper (Modo de Apoio: "Cantar pra destravar").
// Persistida em localStorage — sem autenticação, device-local.

import { storageGet, storageSet } from "./storage";

const LS_KEY = "singList";

// Sugestão pré-definida para novos usuários
export const DEFAULT_LIST = ['Álbum "Caos" - Alê'];

export function getList() {
  const list = storageGet(LS_KEY, null);
  if (!list || !Array.isArray(list) || list.length === 0) return [...DEFAULT_LIST];
  return list;
}

function persist(list) {
  storageSet(LS_KEY, list);
  return list;
}

export function addAlbum(name) {
  const clean = (name || "").trim();
  const list = getList();
  if (!clean || list.includes(clean)) return list;
  return persist([...list, clean]);
}

export function removeAlbum(name) {
  return persist(getList().filter((a) => a !== name));
}

/**
 * Retorna um item aleatório da lista, diferente do atual (quando possível).
 * @param {string|null} current - sugestão atual (para evitar repetição imediata)
 */
export function getRandomSuggestion(current = null) {
  const list = getList();
  if (list.length === 0) return DEFAULT_LIST[0];
  if (list.length === 1) return list[0];
  const others = list.filter((item) => item !== current);
  const pool = others.length > 0 ? others : list;
  return pool[Math.floor(Math.random() * pool.length)];
}
