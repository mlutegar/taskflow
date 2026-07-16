const LS_KEY = "daily_focus_achievements";

export const ACHIEVEMENTS = [
  { id: "first_session",  emoji: "🌱", name: "Primeira Sessão",    desc: "Completou sua primeira sessão do Daily Focus" },
  { id: "helper_user",   emoji: "🎵", name: "Com Estilo",          desc: "Usou um Modo de Apoio em uma sessão" },
  { id: "early_bird",    emoji: "⚡", name: "Adiantado",           desc: "Concluiu uma tarefa antes do timer acabar" },
  { id: "rush_master",   emoji: "🚀", name: "Rush Master",         desc: "Completou uma sessão no Modo Rush" },
  { id: "level_3",       emoji: "🔥", name: "Em Chamas",           desc: "Chegou ao Nível 3 (3 tarefas de uma vez)" },
  { id: "level_5",       emoji: "👑", name: "Lenda",               desc: "Chegou ao Nível 5 — quase 4h de trabalho" },
  { id: "five_sessions", emoji: "💪", name: "Consistente",         desc: "5 sessões completas no Daily Focus" },
  { id: "ten_sessions",  emoji: "🏆", name: "Dedicado",            desc: "10 sessões completas no Daily Focus" },
  { id: "level_2",       emoji: "📈", name: "Subindo",             desc: "Chegou ao Nível 2 pela primeira vez" },
];

function getUnlocked() {
  try {
    return JSON.parse(localStorage.getItem(LS_KEY) || "[]");
  } catch {
    return [];
  }
}

function saveUnlocked(list) {
  try {
    localStorage.setItem(LS_KEY, JSON.stringify(list));
  } catch {}
}

export function getAllWithStatus() {
  const unlocked = getUnlocked();
  return ACHIEVEMENTS.map((a) => ({ ...a, unlocked: unlocked.includes(a.id) }));
}

/**
 * Try to unlock one or more achievements.
 * Returns array of newly unlocked achievement objects.
 */
export function tryUnlock(ids) {
  const unlocked = getUnlocked();
  const newlyUnlocked = [];

  for (const id of ids) {
    if (!unlocked.includes(id)) {
      const ach = ACHIEVEMENTS.find((a) => a.id === id);
      if (ach) {
        unlocked.push(id);
        newlyUnlocked.push(ach);
      }
    }
  }

  if (newlyUnlocked.length > 0) {
    saveUnlocked(unlocked);
  }

  return newlyUnlocked;
}

export function isUnlocked(id) {
  return getUnlocked().includes(id);
}
