// Lista de músicas "cantáveis" usada pelos modos de cantar (SingSession).
// Editável e persistida em localStorage — mesmo padrão de lib/activities.js.

import { storageGet, storageSet } from "./storage";

const LS_KEY = "singableSongs";

export const DEFAULT_SONGS: string[] = [
  "Bohemian Rhapsody — Queen",
  "Don't Stop Believin' — Journey",
  "Sweet Child O' Mine — Guns N' Roses",
  "Wonderwall — Oasis",
  "Livin' on a Prayer — Bon Jovi",
  "Evidências — Chitãozinho & Xororó",
  "Ai Se Eu Te Pego — Michel Teló",
  "Is This Love — Bob Marley",
  "Take On Me — a-ha",
  "I Want It That Way — Backstreet Boys",
  "Garota de Ipanema — Tom Jobim",
  "Hey Jude — The Beatles",
];

export function getSongs(): string[] {
  const list = storageGet(LS_KEY, null);
  if (!list || !Array.isArray(list)) return [...DEFAULT_SONGS];
  return list as string[];
}

function persist(list: string[]): string[] {
  storageSet(LS_KEY, list);
  return list;
}

export function addSong(name: string): string[] {
  const clean = (name || "").trim();
  const list = getSongs();
  if (!clean || list.includes(clean)) return list;
  return persist([...list, clean]);
}

export function removeSong(name: string): string[] {
  return persist(getSongs().filter((s) => s !== name));
}

/** Sorteia uma música da lista (opcionalmente diferente de `exclude`). */
export function randomSong(exclude?: string): string | null {
  const list = getSongs();
  if (list.length === 0) return null;
  const pool = list.length > 1 && exclude ? list.filter((s) => s !== exclude) : list;
  return pool[Math.floor(Math.random() * pool.length)];
}
