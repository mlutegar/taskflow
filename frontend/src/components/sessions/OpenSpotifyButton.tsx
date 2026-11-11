import styles from "./session.module.css";
import { openSpotify, SPOTIFY_HOME, type SpotifyTarget } from "../../lib/openSpotify";

interface OpenSpotifyButtonProps {
  target?: SpotifyTarget;
  label?: string;
}

/** Botão "Abrir Spotify" (app via `spotify:` com fallback para open.spotify.com). */
export default function OpenSpotifyButton({ target = SPOTIFY_HOME, label = "🟢 Abrir Spotify" }: OpenSpotifyButtonProps) {
  return (
    <button type="button" className={`${styles.btn} ${styles.btnSecondary}`} onClick={() => openSpotify(target)}>
      {label}
    </button>
  );
}
