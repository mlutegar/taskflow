// Fonte única das faixas de tempo estimado, compartilhada entre filtro e testes.
// Mantido em sincronia com frontend/src/lib/estimatedTime.ts (TIME_BUCKET_BOUNDS).

// Limites superiores (inclusivos) de cada faixa, em minutos.
export const TIME_BUCKET_BOUNDS = { fast: 15, medium: 60 };

export const ALLOWED_TIME_BUCKETS = new Set(["fast", "medium", "long", "none"]);

/** Classifica minutos em uma faixa ('fast' | 'medium' | 'long') ou null se sem estimativa. */
export function bucketOf(minutes) {
  if (minutes == null) return null;
  if (minutes <= TIME_BUCKET_BOUNDS.fast) return "fast";
  if (minutes <= TIME_BUCKET_BOUNDS.medium) return "medium";
  return "long";
}

/**
 * Fragmento `where` do Prisma para filtrar por faixa de tempo estimado.
 * Retorna null quando o bucket é inválido (nenhum filtro aplicado).
 */
export function estimatedTimeWhere(bucket) {
  switch (bucket) {
    case "fast":   return { not: null, lte: TIME_BUCKET_BOUNDS.fast };
    case "medium": return { gt: TIME_BUCKET_BOUNDS.fast, lte: TIME_BUCKET_BOUNDS.medium };
    case "long":   return { gt: TIME_BUCKET_BOUNDS.medium };
    case "none":   return null; // tratado como `estimatedMinutes: null` pelo chamador
    default:       return undefined; // bucket inválido → sem filtro
  }
}
