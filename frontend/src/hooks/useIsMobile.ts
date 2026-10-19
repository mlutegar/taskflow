/**
 * useIsMobile — `true` abaixo do breakpoint mobile do app.
 *
 * Existe `isMobileViewport()` em `lib/continuousActivityUiPrefs`, mas ele lê o
 * valor uma vez e NÃO re-renderiza quando a viewport muda (girar o aparelho,
 * redimensionar no DevTools). Como o redesign mobile troca estrutura de
 * marcação — e não só CSS —, precisamos de um valor reativo.
 *
 * Usa o mesmo `MOBILE_MQ` (max-width: 640px) já adotado no projeto, que é onde
 * a sidebar vira bottom nav.
 */

import { useSyncExternalStore } from "react";
import { MOBILE_MQ } from "../lib/continuousActivityUiPrefs";

function subscribe(onChange: () => void): () => void {
  if (typeof window === "undefined" || !window.matchMedia) return () => {};
  const mql = window.matchMedia(MOBILE_MQ);
  // Safari < 14 não tem addEventListener em MediaQueryList.
  if (mql.addEventListener) {
    mql.addEventListener("change", onChange);
    return () => mql.removeEventListener("change", onChange);
  }
  mql.addListener(onChange);
  return () => mql.removeListener(onChange);
}

function getSnapshot(): boolean {
  return typeof window !== "undefined" && !!window.matchMedia && window.matchMedia(MOBILE_MQ).matches;
}

/** No SSR/teste sem `window`, assume desktop. */
function getServerSnapshot(): boolean {
  return false;
}

export function useIsMobile(): boolean {
  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
}
