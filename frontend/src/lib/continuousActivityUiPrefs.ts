// Preferência de UI da Atividade Contínua (chip flutuante do Daily Focus):
// se o indicador começa minimizado (compacto) ou expandido.
//
// Regra:
//  - Se o usuário já escolheu manualmente (persistido), a escolha vence.
//  - Sem preferência salva, minimiza por padrão no mobile e expande no desktop.
//
// Isolado aqui para ser testável sem montar o componente inteiro.

export const CONT_ACT_MIN_KEY = "taskflow.dailyfocus.contActMinimized";
export const MOBILE_MQ = "(max-width: 640px)";

export function isMobileViewport(): boolean {
  return typeof window !== "undefined" && !!window.matchMedia && window.matchMedia(MOBILE_MQ).matches;
}

/** Lê a preferência salva: true=minimizado, false=expandido, null=sem preferência. */
export function readMinimizedPref(): boolean | null {
  try {
    const saved = localStorage.getItem(CONT_ACT_MIN_KEY);
    if (saved === "1") return true;
    if (saved === "0") return false;
  } catch { /* localStorage indisponível */ }
  return null;
}

/** Persiste a escolha manual do usuário. */
export function writeMinimizedPref(min: boolean): void {
  try { localStorage.setItem(CONT_ACT_MIN_KEY, min ? "1" : "0"); } catch { /* ignore */ }
}

/** Estado inicial do chip, combinando preferência salva e viewport. */
export function initialContActMinimized(): boolean {
  const pref = readMinimizedPref();
  if (pref !== null) return pref;
  return isMobileViewport();
}
