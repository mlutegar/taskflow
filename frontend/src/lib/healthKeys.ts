/** Chaves do React Query para a página de Saúde. */
export const healthKeys = {
  all: ["saude"] as const,
  medications: (archived = false) => ["saude", "medications", { archived }] as const,
  medicationsAll: () => ["saude", "medications"] as const,
  today: (date: string) => ["saude", "medications-today", date] as const,
  todayAll: () => ["saude", "medications-today"] as const,
  history: (from: string, to: string) => ["saude", "medications-history", from, to] as const,
  historyAll: () => ["saude", "medications-history"] as const,
  // Skincare
  skincareAll: () => ["saude", "skincare"] as const,
  skincareProducts: () => ["saude", "skincare", "products"] as const,
  skincareSteps: () => ["saude", "skincare", "steps"] as const,
  skincareToday: (date: string) => ["saude", "skincare", "today", date] as const,
  // Lista de compras (skincare + remédios): depende dos dois, invalidada por ambos
  shopping: () => ["saude", "shopping"] as const,
};
