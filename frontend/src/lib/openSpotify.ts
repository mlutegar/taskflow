/**
 * Abre o Spotify: tenta o app via esquema `spotify:` e, se o app não assumir o foco
 * (a página continua visível após o timeout), abre a versão web em nova aba.
 */
export interface SpotifyTarget {
  /** URI do app, ex.: "spotify:collection:tracks". */
  uri: string;
  /** Fallback web, ex.: "https://open.spotify.com/collection/tracks". */
  web: string;
}

export const SPOTIFY_HOME: SpotifyTarget = { uri: "spotify:", web: "https://open.spotify.com/" };

const FALLBACK_DELAY_MS = 1500;

export function openSpotify(target: SpotifyTarget = SPOTIFY_HOME): void {
  let appOpened = false;
  const onHide = (): void => {
    if (document.visibilityState === "hidden") appOpened = true;
  };
  document.addEventListener("visibilitychange", onHide);
  window.addEventListener("blur", () => { appOpened = true; }, { once: true });

  window.location.href = target.uri;

  window.setTimeout(() => {
    document.removeEventListener("visibilitychange", onHide);
    if (!appOpened) window.open(target.web, "_blank", "noopener,noreferrer");
  }, FALLBACK_DELAY_MS);
}
