/**
 * Aliases de ids de modos que foram renomeados/desmembrados.
 * Ao ler históricos (uso, ativações, logs), normalizamos ids legados para o
 * id canônico atual — assim estatísticas e "feito hoje" mantêm continuidade
 * mesmo após o card antigo deixar de existir.
 *
 * Ex.: o antigo card único `music` foi achatado em `music_hundred`/`music_album`/
 * `music_playlist`; registros antigos com `music` passam a contar como `music_hundred`.
 */
export const MODE_ID_ALIASES: Record<string, string> = {
  music: "music_hundred",
};

/** Retorna o id canônico atual para um modeId (aplicando aliases). */
export function canonicalModeId(id: string): string {
  return MODE_ID_ALIASES[id] ?? id;
}
