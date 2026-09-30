// Fonte única da paleta de cores e dos emojis usados ao criar/editar projetos.
// Importado por ProjectManager, QuickCreateProject e EmojiPicker para evitar
// divergência de design entre os vários pontos de criação de projeto.

export const PROJECT_COLORS = [
  "#7c6ef5", "#5b8def", "#22b8cf", "#20c997", "#51cf66",
  "#fcc419", "#ff922b", "#ff6b6b", "#f06595", "#cc5de8",
  "#868e96", "#495057",
];

export const PROJECT_EMOJIS = [
  "📁", "📂", "🗂️", "📌", "📝", "✅", "⭐", "🔥", "🚀", "💡",
  "🎯", "📚", "🎓", "💻", "🧠", "💼", "🏠", "🛒", "💰", "📈",
  "🎨", "🎵", "🎮", "🏃", "🍔", "✈️", "❤️", "🌱", "🔧", "⚡",
  "🧩", "📅", "🔔", "🏆", "🐛", "🌍", "☕", "🎁", "🧪", "📦",
];

export const DEFAULT_PROJECT_EMOJI = "📁";
export const DEFAULT_PROJECT_COLOR = "#7c6ef5";

/** Normaliza o emoji digitado/colado: remove espaços e limita o tamanho. */
export function normalizeEmoji(value: string, fallback = DEFAULT_PROJECT_EMOJI): string {
  const trimmed = (value || "").trim();
  if (!trimmed) return fallback;
  return Array.from(trimmed).slice(0, 4).join("");
}
