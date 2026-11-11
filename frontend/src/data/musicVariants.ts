/**
 * Fonte única de verdade para as variantes do Music Mode.
 * Usado por MusicSession (cabeçalho + passo inicial) e pelo registro de helpers
 * do Daily Focus (helpers/index.ts). Os cards em `modes.ts` seguem os mesmos
 * ids/variantes (`music_<variant>`).
 */
export interface MusicVariantMeta {
  /** Sufixo/valor da variante (bate com `preset.variant`). */
  variant: string;
  /** Id do card no catálogo (`modes.ts`). */
  id: string;
  emoji: string;
  title: string;
  /** Passo inicial do fluxo em MusicSession. */
  initialStep: string;
  /** Textos do passo "hundred_finding" (variantes que reutilizam o fluxo de 100 Músicas). */
  find?: { pill: string; title: string; text: string; button: string };
  /** Destino do botão "Abrir Spotify" (app via `spotify:` com fallback web). */
  spotify?: { uri: string; web: string };
}

export const MUSIC_VARIANTS: MusicVariantMeta[] = [
  { variant: "hundred",  id: "music_hundred",  emoji: "🎧", title: "100 Músicas",            initialStep: "hundred_finding" },
  { variant: "album",    id: "music_album",    emoji: "💿", title: "Escolher um Álbum",      initialStep: "album_choose"   },
  { variant: "playlist", id: "music_playlist", emoji: "✨", title: "Playlist Perfeita de 10", initialStep: "playlist_hunt"  },
  {
    variant: "liked", id: "music_liked", emoji: "💚", title: "Músicas Curtidas", initialStep: "hundred_finding",
    find: {
      pill: "💚 Músicas Curtidas",
      title: "💚 Escolha uma música das suas curtidas",
      text: "Abra a playlist \"Músicas Curtidas\" no Spotify e ouça ~100 músicas dela (a ordem não importa). Quando uma ressoar, volte aqui e faça 1 tarefa.",
      button: "💚 Escolhi minha música!",
    },
    spotify: { uri: "spotify:collection:tracks", web: "https://open.spotify.com/collection/tracks" },
  },
  {
    variant: "dj", id: "music_dj", emoji: "🎙️", title: "DJ do Spotify", initialStep: "hundred_finding",
    find: {
      pill: "🎙️ DJ do Spotify",
      title: "🎙️ Deixe o DJ tocar",
      text: "Ative o DJ do Spotify e deixe a voz de IA conduzir ~100 músicas (é um objetivo, não uma fila). A cada música que ressoar, volte aqui e faça 1 tarefa.",
      button: "🎙️ Música tocando — bora!",
    },
    spotify: { uri: "spotify:search:DJ", web: "https://open.spotify.com/search/DJ" },
  },
];

/** Variantes que usam o fluxo "hundred" (contador/instrução de ~100 músicas). */
export const HUNDRED_LIKE_VARIANTS: string[] = ["hundred", "liked", "dj"];

/** Passo inicial por variante. */
export const MUSIC_STEP_BY_VARIANT: Record<string, string> = Object.fromEntries(
  MUSIC_VARIANTS.map((v) => [v.variant, v.initialStep])
);

/** Cabeçalho (emoji + título) por variante. */
export const MUSIC_HEADER_BY_VARIANT: Record<string, { emoji: string; title: string }> = Object.fromEntries(
  MUSIC_VARIANTS.map((v) => [v.variant, { emoji: v.emoji, title: v.title }])
);
