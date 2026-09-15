# 2 - Modos e Tipos

Voltar ao [[0-Painel]]. Usado em [[1-Tela-Escolher-Modo]].

## Fonte de dados
`frontend/src/data/modes.ts` — `MODES`, `CATEGORY_BY_ID`, `CATEGORY_ORDER`.

## Sem subtipos escondidos dentro do card
Cada variante de um modo é um **card próprio** na tela "Escolher Modo" — não há mais um card
que abre um sub-menu de escolha. Padrão: mesmo `session` + `preset: { variant }`, ids separados
(ex.: `sing_one`/`sing_ten`, `tiktok_fixed`/`tiktok_prog_videos`).

O **Music Mode** foi achatado nesse padrão: o card único `music` (que abria a tela
"Como quer usar a música hoje?") virou 3 cards, todos `session: "music"`:
- `music_hundred` — 🎧 100 Músicas — `preset: { variant: "hundred" }`
- `music_album` — 💿 Escolher um Álbum — `preset: { variant: "album" }`
- `music_playlist` — ✨ Playlist Perfeita de 10 — `preset: { variant: "playlist" }`

`MusicSession.tsx` lê `preset.variant` e entra direto no fluxo (o passo `choose_mode` foi
removido), com persistência por variante (`music:<variant>`). O helper do Daily Focus
(`MusicHelper`) recebe a variante fixa via `defaultState` (registrada em `helpers/index.ts`)
e não mostra mais o seletor.

### Fonte única das variantes de música
`frontend/src/data/musicVariants.ts` — `MUSIC_VARIANTS` (id, variant, emoji, title, initialStep)
e os mapas derivados `MUSIC_STEP_BY_VARIANT` / `MUSIC_HEADER_BY_VARIANT`. Consumido por
`MusicSession` (cabeçalho + passo inicial) e por `helpers/index.ts` (gera os 3 registros de helper).

### Aliases de ids legados
`frontend/src/lib/modeAliases.ts` — `MODE_ID_ALIASES` mapeia ids antigos p/ canônicos
(`music → music_hundred`). Normalizado na leitura de `getUsageLogs()` (sessionUsageLog) e de
`modeActivations`, para estatísticas e "feito hoje" não perderem histórico.

### Subgrupos visuais no picker
Modos podem ter `group` (ex.: "Ouvir", "Cantar", "Playlist"). O `ModePicker` mostra um divisor
`.groupDivider` entre subgrupos **apenas** na ordenação Padrão, dentro de uma categoria e sem busca
ativa (nas demais ordenações os cards se reordenam e o agrupamento perderia sentido).

### Cores por card
Cada card de música tem cor própria pra distinção visual: `music_hundred` roxo (`#7c6ef5`),
`music_album` azul (`#6b8cef`), `music_playlist` violeta (`#a06ef5`).

### Teste de integridade
`frontend/src/data/modes.coverage.test.ts` — garante ids únicos, que os ids de `HELPER_GROUPS`
existem no catálogo, que o card legado `music` sumiu, o alias aponta certo, e que cada variante
de música tem card + helper + sessão coerentes.

## Campos relevantes de um modo
- `type`: `"durante"` (durante o foco) ou `"entre"` (entre tarefas).
- `category` (ou `CATEGORY_BY_ID[id]`): Música, Ciclos, Foco, Memória, Ritual, Mobile, Personalizados.

## Exibição na tela
No `ModePicker`, cada card mostra chips (`.typeBadge`):
- **Categoria** do modo: `modeCategory(m)` = `m.category || CATEGORY_BY_ID[m.id] || "Outros"`, com cor por categoria (`CATEGORY_COLOR`).
- **Tipo** legível via `TYPE_LABEL`: `durante → "Durante o foco"`, `entre → "Entre tarefas"`.
- **Contexto** (`m.context`, ex.: "🖥️ Desktop", "🎧 Música") — até 2 tags.
- Cada chip tem `title` para acessibilidade.
