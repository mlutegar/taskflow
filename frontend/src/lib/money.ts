/** Dinheiro sempre em centavos (inteiro). Nunca float no estado/API; só na exibição. */

/** 123456 → "R$ 1.234,56" (aceita negativo). Formata via inteiros (sem erro de float). */
export function formatBRL(cents: number): string {
  const abs = Math.abs(Math.trunc(cents));
  const reais = Math.floor(abs / 100);
  const frac = String(abs % 100).padStart(2, "0");
  const txt = `R$ ${reais.toLocaleString("pt-BR")},${frac}`;
  return cents < 0 ? `-${txt}` : txt;
}

/**
 * "12,50" | "1.234,5" | "12" | "12.50" → centavos. Retorna null se inválido.
 * Sem parseFloat: trabalha com a string.
 */
export function parseBRL(input: string): number | null {
  let s = input.replace(/[R$\s]/g, "");
  if (!s) return null;
  if (s.includes(",")) s = s.replace(/\./g, "").replace(",", ".");
  else if ((s.match(/\./g) || []).length > 1) s = s.replace(/\./g, "");
  if (!/^\d+(\.\d{1,2})?$/.test(s)) return null;
  const [int, frac = ""] = s.split(".");
  return Number(int) * 100 + Number((frac + "00").slice(0, 2));
}

/** Máscara de digitação estilo caixa: só dígitos → centavos ("1250" = R$ 12,50). */
export function centsFromDigits(digits: string): number {
  const d = digits.replace(/\D/g, "").slice(0, 11);
  return d ? Number(d) : 0;
}

/** Divide total em n parcelas (resto na 1ª) — espelha o backend, só para prévia na UI. */
export function splitCents(total: number, n: number): number[] {
  const base = Math.floor(total / n);
  return Array.from({ length: n }, (_, i) => (i === 0 ? total - base * (n - 1) : base));
}
