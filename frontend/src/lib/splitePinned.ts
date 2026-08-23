// Atividades "fixadas" como cards de Splite na página de Modos.
// Persistidas em localStorage; default = as atividades curadas.

import { storageGet, storageSet } from "./storage";

const LS_KEY           = "splitePinned";
const LS_KEY_DISMISSED = "spliteDismissed"; // removidas intencionalmente — não reaparecem no merge
const LS_KEY_ORDER     = "splitePinnedOrder"; // ordem customizada via drag & drop

export const DEFAULT_PINNED: string[] = [
  "Beber água",
  "Meditar",
  "Ler diário",
  "Esticar 5 minutos",
  "Ler um capítulo de livro",
  "Fazer exercícios rápidos",
  "Dançar tiktok",
  "Orbita: prompt e espera (faz tasks enquanto processa)",
  "Orbita: all in em um projeto (máximo de prompts)",
];

interface ActivityMeta {
  emoji: string;
  color: string;
}

// Metadados (emoji/cor) para atividades conhecidas; fallback genérico para o resto.
const META: Record<string, ActivityMeta> = {
  "Beber água":               { emoji: "💧", color: "#4ea8cc" },
  "Meditar":                  { emoji: "🧘", color: "#7c6ef5" },
  "Ler diário":               { emoji: "📖", color: "#c8874a" },
  "Esticar 5 minutos":        { emoji: "🤸", color: "#4ecca3" },
  "Ler um capítulo de livro": { emoji: "📚", color: "#f0a540" },
  "Fazer exercícios rápidos": { emoji: "🏃", color: "#e05252" },
  "Dançar tiktok":            { emoji: "🕺", color: "#ff4d6d" },
  "Orbita: prompt e espera (faz tasks enquanto processa)": { emoji: "⏳", color: "#7c6ef5" },
  "Orbita: all in em um projeto (máximo de prompts)":      { emoji: "🚀", color: "#f0a540" },
};

const FALLBACK_COLORS: string[] = ["#7c6ef5", "#e05252", "#f0a540", "#4ecca3", "#c8874a", "#b06ef5", "#4ea8cc", "#e07c52"];

export function metaFor(activity: string, index: number = 0): ActivityMeta {
  if (META[activity]) return META[activity];
  return { emoji: "⭐", color: FALLBACK_COLORS[index % FALLBACK_COLORS.length] };
}

// ── Dismissed (removidas intencionalmente — não reaparecem no merge) ─────────
function getDismissed(): Set<string> {
  const list = storageGet(LS_KEY_DISMISSED, []);
  return new Set(Array.isArray(list) ? list : []);
}

function addDismissed(activity: string): void {
  const set = getDismissed();
  set.add(activity);
  storageSet(LS_KEY_DISMISSED, [...set]);
}

function removeDismissed(activity: string): void {
  const set = getDismissed();
  set.delete(activity);
  storageSet(LS_KEY_DISMISSED, [...set]);
}

// ── Pinned list ──────────────────────────────────────────────────────────────
export function getPinned(): string[] {
  const list = storageGet(LS_KEY, null);
  const dismissed = getDismissed();

  if (!list || !Array.isArray(list)) {
    const defaults = DEFAULT_PINNED.filter((a) => !dismissed.has(a));
    return defaults;
  }

  // Injeta novos defaults que ainda não foram vistos nem removidos intencionalmente
  const missing = DEFAULT_PINNED.filter((a) => !list.includes(a) && !dismissed.has(a));
  if (missing.length === 0) return list;
  const merged = [...list, ...missing];
  persist(merged);
  return merged;
}

function persist(list: string[]): string[] {
  storageSet(LS_KEY, list);
  return list;
}

export function isPinned(activity: string): boolean {
  return getPinned().includes(activity);
}

export function pin(activity: string): string[] {
  const list = getPinned();
  if (!activity || list.includes(activity)) return list;
  // Se estava no dismissed, remove (usuário está re-adicionando)
  removeDismissed(activity);
  return persist([...list, activity]);
}

export function unpin(activity: string): string[] {
  addDismissed(activity); // marca como removida intencionalmente
  const updated = getPinned().filter((a) => a !== activity);
  return persist(updated);
}

export function togglePin(activity: string): string[] {
  return isPinned(activity) ? unpin(activity) : pin(activity);
}

// ── Drag & drop order ────────────────────────────────────────────────────────
export function getPinnedOrder(): string[] | null {
  return storageGet(LS_KEY_ORDER, null);
}

export function setPinnedOrder(orderedList: string[]): void {
  storageSet(LS_KEY_ORDER, orderedList);
}

/**
 * Aplica a ordem salva pelo drag & drop sobre a lista atual.
 * Itens novos (não presentes na ordem salva) ficam no final.
 */
export function applyOrder(list: string[]): string[] {
  const order = getPinnedOrder();
  if (!order || !Array.isArray(order)) return list;
  const orderMap: Record<string, number> = Object.fromEntries(order.map((a, i) => [a, i]));
  return [...list].sort((a, b) => {
    const ia = orderMap[a] ?? Infinity;
    const ib = orderMap[b] ?? Infinity;
    return ia - ib;
  });
}
