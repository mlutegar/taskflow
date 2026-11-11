/** Formata quantidades de unidades (1, 0.5, 2.25) sem zeros sobrando. */
export function formatQty(n: number): string {
  return Number.isInteger(n) ? String(n) : n.toFixed(2).replace(/\.?0+$/, "");
}
