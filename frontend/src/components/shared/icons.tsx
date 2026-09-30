/**
 * Ícones SVG inline — renderizam igual em qualquer SO/fonte (ao contrário de
 * emojis como 🗕 ⤢ ✕, que variam ou viram quadrado em alguns dispositivos).
 * Todos usam `currentColor`, então herdam a cor do texto do botão.
 */
import type { SVGProps } from "react";

const base = (props: SVGProps<SVGSVGElement>): SVGProps<SVGSVGElement> => ({
  width: 14,
  height: 14,
  viewBox: "0 0 16 16",
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 1.8,
  strokeLinecap: "round",
  strokeLinejoin: "round",
  "aria-hidden": true,
  focusable: false,
  ...props,
});

/** Minimizar — linha na base (janela recolhida). */
export function MinimizeIcon(props: SVGProps<SVGSVGElement>): JSX.Element {
  return (
    <svg {...base(props)}>
      <line x1="3.5" y1="12" x2="12.5" y2="12" />
    </svg>
  );
}

/** Expandir — setas em diagonal (tela cheia). */
export function ExpandIcon(props: SVGProps<SVGSVGElement>): JSX.Element {
  return (
    <svg {...base(props)}>
      <path d="M9.5 3H13v3.5" />
      <path d="M13 3 8.5 7.5" />
      <path d="M6.5 13H3V9.5" />
      <path d="M3 13l4.5-4.5" />
    </svg>
  );
}

/** Fechar/encerrar — X. */
export function CloseIcon(props: SVGProps<SVGSVGElement>): JSX.Element {
  return (
    <svg {...base(props)}>
      <line x1="4" y1="4" x2="12" y2="12" />
      <line x1="12" y1="4" x2="4" y2="12" />
    </svg>
  );
}
