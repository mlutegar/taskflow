# 5 - Filtros, Ordenação, Favoritos e Densidade

Voltar ao [[0-Painel]]. Faz parte da tela [[1-Tela-Escolher-Modo]].

Melhorias no `frontend/src/components/ModePicker.tsx`. Helpers reutilizáveis extraídos para
`frontend/src/lib/modeUtils.ts` (`modeCategory`, `categoryColor`, `shuffleIds`, `pruneOrder`, favoritos).

## Ordenação (persistida)
Botão **↕ Ordem** cicla 5 modos: `Padrão → A–Z → Mais usados → Menos usados → Aleatória`.
- `most`/`least` usam `usageStats(7)` de `frontend/src/lib/modeLog.ts` (uso nos últimos 7 dias).
- `random`: ordem embaralhada salva (`modePicker.randomOrder`); botão **🎲 Embaralhar** gera outra.
- Escolha persistida em `modePicker.sortMode`.
- **Favoritos ficam sempre no topo**, acima de qualquer ordenação.

## Favoritos (⭐)
- Botão ★/☆ no canto de cada card → `toggleFavorite(id)` em `modeUtils.ts` (chave `modePicker.favorites`).
- Favoritos flutuam para o topo da lista.

## Filtros persistidos
Busca, categoria e "Só não feitos hoje" agora são salvos (`modePicker.search`,
`modePicker.category`, `modePicker.hideUsedToday`). Botão **✕ Limpar** aparece quando há
filtro/ordenação ativos e reseta tudo (mantém favoritos e ordem aleatória).

## Outros
- **Contador de resultados** ("N modos") com `aria-live`.
- **Chip de categoria clicável** no card → filtra por aquela categoria.
- **Mini-stat** `N×/7d` no card quando houve uso na semana.
- **Densidade** (botão ▦/▤ no header): modo compacto oculta chips e reduz o card (`modePicker.compact`).
- **Poda de órfãos**: ids inexistentes são removidos de `randomOrder` ao carregar (`pruneOrder`).

## Ainda em localStorage (não sincronizado)
`sortMode`, `randomOrder`, `favorites`, `compact` e demais filtros são locais ao dispositivo.
Sincronizar via `api/preferences.ts` fica como melhoria futura.

## Testes
`frontend/src/components/ModePicker.test.tsx`: estado vazio, resumo com contagem, filtro
"só não feitos hoje", ciclo+persistência de ordenação, e favoritar+persistência.
