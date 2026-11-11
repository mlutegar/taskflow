# 65 - Novos modos: Café com Leite, Músicas Curtidas e DJ

Prompt 01 do `PROMPTS.md`. Voltar ao [[0-Painel]]. Contexto dos modos: [[2-Modos-e-Tipos]], [[63-Exploracao-e-CLAUDE-md]].

## O que foi feito
| Modo | id | Categoria | Sessão (SESSION_MAP) | Preset |
|---|---|---|---|---|
| Café com Leite 🥛 | `cafe_com_leite` | Ritual | `CafeRitualSession` (`session: "caferitual"`; também há chave `cafe_com_leite`) | `{variant: "leite"}` |
| Músicas Curtidas 💚 | `music_liked` | Música | `MusicSession` (`session: "music"`) | `{variant: "liked"}` |
| DJ do Spotify 🎙️ | `music_dj` | Música | `MusicSession` | `{variant: "dj"}` |

Nenhum cai no fallback `SpliteSession`; os três estão em `HELPER_GROUPS` e `getHelper()` devolve helper.

## Decisões
- **Café com Leite**: mesmo fluxo do Café Ritual; muda só texto, emoji e cor. Variantes em `data/cafeVariants.ts` (fonte única). Persistência separada (`cafe_com_leite`) para não misturar com o Café Ritual.
- **Músicas Curtidas / DJ**: reutilizam o fluxo `hundred_*` do `MusicSession` (contagem das "~100 músicas" é só instrução/objetivo, 1 música = 1 tarefa, sem timer). Textos por variante em `musicVariants.ts` (`find`). `HUNDRED_LIKE_VARIANTS` faz o `MusicHelper` mostrar o contador 0–100 também nessas variantes; ao chegar em 100 registra ativação do id da variante.
- **Botão "Abrir Spotify"** nos 3 modos: `lib/openSpotify.ts` tenta `spotify:` e, se a página não perder foco em 1,5 s, abre `open.spotify.com` em nova aba. Componente `OpenSpotifyButton`. Curtidas: `spotify:collection:tracks`; DJ: `spotify:search:DJ` (não há URI estável pública do DJ — abre a busca "DJ"); Café com Leite: home do Spotify.
- Sem Spotify API.

## Melhoria futura
- Adicionar o botão "Abrir Spotify" também aos modos de música existentes (`music_hundred`, `music_album`, `music_playlist`) — **não feito de propósito** neste prompt.
- Trocar o destino do DJ por URI/playlist oficial do DJ, se confirmada.

## Verificação
`modes.coverage.test.ts` + novo `data/modes.newModes.test.ts` (10 testes: catálogo, resolução no SESSION_MAP ≠ SpliteSession, helper). Build ok. Lint (8 erros), `tsc` (234 erros) e 7 testes do `ModePicker.test.tsx` já falhavam antes e continuam iguais (pré-existentes, fora do escopo).

## Arquivos
`data/modes.ts`, `data/musicVariants.ts`, `data/cafeVariants.ts` (novo), `lib/openSpotify.ts` (novo), `components/sessions/{CafeRitualSession,MusicSession,OpenSpotifyButton(novo)}.tsx`, `components/daily-focus/helpers/{index.ts,CafeRitualHelper,MusicHelper}`, `components/ModeSession.tsx`, `data/modes.newModes.test.ts` (novo).
