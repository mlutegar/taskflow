/** Chaves do React Query para Finanças (prefixo ["financas", …]). */
export const financeKeys = {
  all: ["financas"] as const,
  categories: () => ["financas", "categories"] as const,
  entriesAll: () => ["financas", "entries"] as const,
  entries: (month: string) => ["financas", "entries", month] as const,
  summaryAll: () => ["financas", "summary"] as const,
  summary: (month: string) => ["financas", "summary", month] as const,
  sources: () => ["financas", "sources"] as const,
  expected: () => ["financas", "expected"] as const,
  settings: () => ["financas", "settings"] as const,
  projectionAll: () => ["financas", "projection"] as const,
  projection: (from: string, months: number) => ["financas", "projection", from, months] as const,
};
