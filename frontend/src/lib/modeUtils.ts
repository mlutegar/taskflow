/**
 * modeUtils.ts — Helpers reutilizáveis de modos (categoria, cor, ordenação,
 * favoritos). Centraliza o que estava duplicado no ModePicker/ModesPanel/ModeCard.
 */
import { CATEGORY_BY_ID } from "../data/modes";
import { storageGet, storageSet } from "./storage";

export interface ModeLike {
  id: string;
  name: string;
  category?: string;
  type?: string;
  [key: string]: unknown;
}

/** Rótulo legível do tipo de execução do modo. */
export const TYPE_LABEL: Record<string, string> = {
  durante: "Durante o foco",
  entre: "Entre tarefas",
};

/** Cor sutil por categoria (usada nos chips). */
export const CATEGORY_COLOR: Record<string, string> = {
  "Música": "#c084fc",
  "Ciclos": "#f472b6",
  "Foco": "#4ecca3",
  "Memória": "#60a5fa",
  "Ritual": "#fbbf24",
  "Mobile": "#38bdf8",
  "Personalizados": "#9ca3af",
  "Outros": "#9ca3af",
};

/** Categoria de um modo (usa category explícita ou o mapa por id). */
export function modeCategory(m: ModeLike): string {
  return m.category || (CATEGORY_BY_ID as Record<string, string>)[m.id] || "Outros";
}

/** Cor da categoria de um modo. */
export function categoryColor(cat: string): string {
  return CATEGORY_COLOR[cat] || CATEGORY_COLOR["Outros"];
}

/** Embaralha uma lista de ids (Fisher–Yates), sem mutar a original. */
export function shuffleIds(ids: string[]): string[] {
  const arr = [...ids];
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

/**
 * Remove ids que não existem mais no catálogo (poda de órfãos).
 * @param order lista salva de ids
 * @param validIds ids atualmente válidos
 */
export function pruneOrder(order: string[], validIds: Iterable<string>): string[] {
  const valid = validIds instanceof Set ? validIds : new Set(validIds);
  return order.filter((id) => valid.has(id));
}

// ── Favoritos ──────────────────────────────────────────────────────────────
const FAVORITES_KEY = "modePicker.favorites";

export function getFavorites(): string[] {
  const list = storageGet<string[]>(FAVORITES_KEY, []);
  return Array.isArray(list) ? list : [];
}

export function isFavorite(id: string): boolean {
  return getFavorites().includes(id);
}

/** Alterna o favorito e retorna a nova lista. */
export function toggleFavorite(id: string): string[] {
  const cur = getFavorites();
  const next = cur.includes(id) ? cur.filter((x) => x !== id) : [...cur, id];
  storageSet(FAVORITES_KEY, next);
  return next;
}
