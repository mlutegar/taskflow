# 1 - Tela "Escolher Modo"

Voltar ao [[0-Painel]].

## Componente
`frontend/src/components/ModePicker.tsx` + `ModePicker.module.css`.

Recebe as props:
- `usedTodayIds: string[]` — IDs dos modos já realizados hoje (calculados no `SlotBoard`).
- `selectedIds`, `onSelect`, `onClose`.

## Layout (de cima para baixo)
1. Header (voltar + título).
2. **Banner "Hoje você já realizou…"** — só aparece se há modos feitos hoje. Ver [[3-Modos-Feitos-Hoje]].
3. Busca.
4. Filtros de categoria (`ALL_CATEGORIES`).
5. Botão "modo aleatório" (prefere modos ainda não usados hoje).
6. Lista de cards. Cada card mostra emoji, nome, tagline, **chips de tipo/categoria** e badge "hoje". Ver [[2-Modos-e-Tipos]].
