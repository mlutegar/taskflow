/// <reference types="vite-plugin-pwa/client" />
// @types/react v19 removeu o namespace global `JSX` (movido para React.JSX).
// O código usa `JSX.Element` em toda parte; reexpomos o namespace para o compilador.
import type { JSX as ReactJSX } from "react";
declare global {
  // Globais injetados em tempo de build pelo Vite (`define` em vite.config.js).
  // Precisam ficar DENTRO de `declare global` porque o `import type` acima torna
  // este arquivo um módulo — `declare const` no topo seria escopo de módulo.
  const __BUILD_DATE__: string;
  const __APP_VERSION__: string;

  namespace JSX {
    type Element = ReactJSX.Element;
    type ElementClass = ReactJSX.ElementClass;
    type ElementAttributesProperty = ReactJSX.ElementAttributesProperty;
    type ElementChildrenAttribute = ReactJSX.ElementChildrenAttribute;
    type IntrinsicAttributes = ReactJSX.IntrinsicAttributes;
    type IntrinsicClassAttributes<T> = ReactJSX.IntrinsicClassAttributes<T>;
    type IntrinsicElements = ReactJSX.IntrinsicElements;
    type LibraryManagedAttributes<C, P> = ReactJSX.LibraryManagedAttributes<C, P>;
  }
}
