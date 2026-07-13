// Atividades "fixadas" como cards de Splite na página de Modos.
// Persistidas em localStorage; default = as 6 atividades curadas.

const LS_KEY = "taskflow.splitePinned";

export const DEFAULT_PINNED = [
  "Beber água",
  "Meditar",
  "Ler diário",
  "Esticar 5 minutos",
  "Ler um capítulo de livro",
  "Fazer exercícios rápidos",
];

// Metadados (emoji/cor) para atividades conhecidas; fallback genérico para o resto.
const META = {
  "Beber água":               { emoji: "💧", color: "#4ea8cc" },
  "Meditar":                  { emoji: "🧘", color: "#7c6ef5" },
  "Ler diário":               { emoji: "📖", color: "#c8874a" },
  "Esticar 5 minutos":        { emoji: "🤸", color: "#4ecca3" },
  "Ler um capítulo de livro": { emoji: "📚", color: "#f0a540" },
  "Fazer exercícios rápidos": { emoji: "🏃", color: "#e05252" },
};

const FALLBACK_COLORS = ["#7c6ef5", "#e05252", "#f0a540", "#4ecca3", "#c8874a", "#b06ef5", "#4ea8cc", "#e07c52"];

export function metaFor(activity, index = 0) {
  if (META[activity]) return META[activity];
  return { emoji: "🔪", color: FALLBACK_COLORS[index % FALLBACK_COLORS.length] };
}

export function getPinned() {
  try {
    const raw = localStorage.getItem(LS_KEY);
    if (!raw) return [...DEFAULT_PINNED];
    const list = JSON.parse(raw);
    if (!Array.isArray(list)) return [...DEFAULT_PINNED];
    return list;
  } catch {
    return [...DEFAULT_PINNED];
  }
}

function persist(list) {
  localStorage.setItem(LS_KEY, JSON.stringify(list));
  return list;
}

export function isPinned(activity) {
  return getPinned().includes(activity);
}

export function pin(activity) {
  const list = getPinned();
  if (!activity || list.includes(activity)) return list;
  return persist([...list, activity]);
}

export function unpin(activity) {
  return persist(getPinned().filter((a) => a !== activity));
}

export function togglePin(activity) {
  return isPinned(activity) ? unpin(activity) : pin(activity);
}
