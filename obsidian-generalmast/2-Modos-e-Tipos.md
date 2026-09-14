# 2 - Modos e Tipos

Voltar ao [[0-Painel]]. Usado em [[1-Tela-Escolher-Modo]].

## Fonte de dados
`frontend/src/data/modes.ts` — `MODES`, `CATEGORY_BY_ID`, `CATEGORY_ORDER`.

## Campos relevantes de um modo
- `type`: `"durante"` (durante o foco) ou `"entre"` (entre tarefas).
- `category` (ou `CATEGORY_BY_ID[id]`): Música, Ciclos, Foco, Memória, Ritual, Mobile, Personalizados.

## Exibição na tela
No `ModePicker`, cada card mostra chips (`.typeBadge`):
- **Categoria** do modo: `modeCategory(m)` = `m.category || CATEGORY_BY_ID[m.id] || "Outros"`, com cor por categoria (`CATEGORY_COLOR`).
- **Tipo** legível via `TYPE_LABEL`: `durante → "Durante o foco"`, `entre → "Entre tarefas"`.
- **Contexto** (`m.context`, ex.: "🖥️ Desktop", "🎧 Música") — até 2 tags.
- Cada chip tem `title` para acessibilidade.
