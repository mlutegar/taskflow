/**
 * Variantes do ritual do café. Mesmo fluxo; mudam só texto, emoji e cor.
 * Usado por CafeRitualSession (preset.variant) e CafeRitualHelper (Daily Focus).
 */
export interface CafeVariantMeta {
  variant: string;
  /** Id do card no catálogo (`modes.ts`). */
  id: string;
  emoji: string;
  title: string;
  color: string;
  border: string;
  /** Como a bebida é chamada nos textos ("um shot de café", "um café com leite"). */
  drinkWithArticle: string;
  /** Forma curta para "outro ...". */
  drinkShort: string;
  /** Chave de persistência da sessão. */
  persistKey: string;
}

export const CAFE_VARIANTS: CafeVariantMeta[] = [
  {
    variant: "ritual", id: "caferitual", emoji: "🫖", title: "Café Ritual",
    color: "#d4960a", border: "rgba(212,150,10,0.3)",
    drinkWithArticle: "um shot de café quente", drinkShort: "shot", persistKey: "caferitual",
  },
  {
    variant: "leite", id: "cafe_com_leite", emoji: "🥛", title: "Café com Leite",
    color: "#b5835a", border: "rgba(181,131,90,0.3)",
    drinkWithArticle: "um café com leite quente", drinkShort: "café com leite", persistKey: "cafe_com_leite",
  },
];

export const DEFAULT_CAFE_VARIANT = "ritual";

export function getCafeVariant(variant?: string): CafeVariantMeta {
  return CAFE_VARIANTS.find((v) => v.variant === variant) ?? CAFE_VARIANTS[0];
}
