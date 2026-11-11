/** Chaves do React Query para Finanças (prefixo ["financas", …]). */
export const financeKeys = {
  all: ["financas"] as const,
  categories: () => ["financas", "categories"] as const,
  entriesAll: () => ["financas", "entries"] as const,
  entries: (month: string) => ["financas", "entries", month] as const,
  summaryAll: () => ["financas", "summary"] as const,
  summary: (month: string) => ["financas", "summary", month] as const,
};
