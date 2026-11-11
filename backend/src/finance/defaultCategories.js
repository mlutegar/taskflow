/** Categorias padrão criadas na primeira leitura de cada usuário. */
export const DEFAULT_CATEGORIES = [
  ...[
    ["Moradia", "🏠"], ["Mercado", "🛒"], ["Transporte", "🚌"], ["Alimentação fora", "🍔"],
    ["Saúde", "💊"], ["Lazer", "🎮"], ["Assinaturas", "📺"], ["Educação", "📚"], ["Outros", "📦"],
  ].map(([name, emoji]) => ({ name, emoji, kind: "expense" })),
  ...[
    ["Salário", "💼"], ["Freelas", "💻"], ["Vendas", "🏷️"], ["Outros", "📦"],
  ].map(([name, emoji]) => ({ name, emoji, kind: "income" })),
];
