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
}

export const MUSIC_VARIANTS: MusicVariantMeta[] = [
  { variant: "hundred",  id: "music_hundred",  emoji: "🎧", title: "100 Músicas",            initialStep: "hundred_finding" },
  { variant: "album",    id: "music_album",    emoji: "💿", title: "Escolher um Álbum",      initialStep: "album_choose"   },
  { variant: "playlist", id: "music_playlist", emoji: "✨", title: "Playlist Perfeita de 10", initialStep: "playlist_hunt"  },
];

/** Passo inicial por variante. */
export const MUSIC_STEP_BY_VARIANT: Record<string, string> = Object.fromEntries(
  MUSIC_VARIANTS.map((v) => [v.variant, v.initialStep])
);

/** Cabeçalho (emoji + título) por variante. */
export const MUSIC_HEADER_BY_VARIANT: Record<string, { emoji: string; title: string }> = Object.fromEntries(
  MUSIC_VARIANTS.map((v) => [v.variant, { emoji: v.emoji, title: v.title }])
);
