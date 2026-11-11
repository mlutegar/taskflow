/** finance/installments.js — divisão de parcelas em centavos (inteiros, sem float). */

/**
 * Divide `totalCents` em `n` parcelas. floor(total/n) em cada uma; o resto de centavos vai
 * na 1ª parcela (a soma sempre fecha exatamente o total).
 */
export function splitInstallments(totalCents, n) {
  if (!Number.isInteger(totalCents) || totalCents < 0) throw new RangeError("totalCents inválido");
  if (!Number.isInteger(n) || n < 1) throw new RangeError("nº de parcelas inválido");
  const base = Math.floor(totalCents / n);
  const rest = totalCents - base * n;
  return Array.from({ length: n }, (_, i) => (i === 0 ? base + rest : base));
}

/** Valor da parcela de índice `index` (0-based). */
export function installmentAmount(totalCents, n, index) {
  return splitInstallments(totalCents, n)[index];
}
