// Lista de atividades de recompensa compartilhada entre Splite e Lazy Falcon.
// Editável e persistida em localStorage (paridade com o antigo "Manage Activities"
// do CLI, que guardava a lista em data/activities.json).

const LS_KEY = "taskflow.activities";

// Seed inicial (equivalente ao antigo data/activities.json do CLI)
export const DEFAULT_ACTIVITIES = [
  "Ler diário",
  "Escrever no diário",
  "Beber água",
  "Jogar Spelunky",
  "Ver Twitter",
  "Ver um vídeo",
  "Colocar música",
  "Ler um capítulo de livro",
  "Esticar 5 minutos",
  "Meditar",
  "Fazer exercícios rápidos",
  "Organizar algo",
  "Responder mensagens",
  "Vê tiktoks salvos (limpar galeria)",
  "Escutar Diario",
  "Reels",
  "Reddit",
  "Deitar 1min",
  "Instagram",
];

export function getActivities() {
  try {
    const raw = localStorage.getItem(LS_KEY);
    if (!raw) return [...DEFAULT_ACTIVITIES];
    const list = JSON.parse(raw);
    if (!Array.isArray(list)) return [...DEFAULT_ACTIVITIES];
    return list;
  } catch {
    return [...DEFAULT_ACTIVITIES];
  }
}

function persist(list) {
  localStorage.setItem(LS_KEY, JSON.stringify(list));
  return list;
}

export function addActivity(name) {
  const clean = (name || "").trim();
  const list = getActivities();
  if (!clean || list.includes(clean)) return list;
  return persist([...list, clean]);
}

export function removeActivity(name) {
  return persist(getActivities().filter((a) => a !== name));
}
