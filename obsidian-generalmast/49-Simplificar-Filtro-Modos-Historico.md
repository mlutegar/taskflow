# 49 - Simplificar Filtro de Modos no Histórico

Voltar ao [[0-Painel]]. Relacionado a [[5-Filtros-Ordenacao-Favoritos]] e [[3-Modos-Feitos-Hoje]].

## Problema
Na página **Histórico** (`frontend/src/components/history/HistoryPage.tsx`), as abas
**Modos** e **Uso** mostravam o filtro por modo como uma "pill" (chip) para **cada modo**
presente nos registros. Com ~70 modos, virava uma parede de botões — poluída e difícil de usar.

## Solução — v1 (dropdown)
Primeiro passo: substituída a parede de chips por um `<select>` agrupado por categoria
(`<optgroup>`). Esse `<select>` ainda é usado no **modal de apagar histórico**
(`ClearHistoryDialog`, classe `.filterSelect`).

## Solução — v2 (combobox completo)
O filtro da aba **Uso** virou um **combobox `ModeFilterCombobox`** (componente próprio em
`HistoryPage.tsx`) com todas as melhorias sugeridas:

1. **Busca** — campo de texto que filtra os modos por nome em tempo real.
2. **Contador de resultados** — `N registros` ao lado do filtro, com `aria-live="polite"`.
3. **Ordenação por uso** — categorias e modos mais usados aparecem no topo
   (`usageCountByMode` + sort desc; empate resolve por nome pt-BR).
4. **Persistência** — seleção e período salvos em `localStorage`
   (`history.modeFilter` = array de ids; `history.usagePeriodDays`).
   Estado inicial via `loadSelectedModes()` / `loadPeriod()`.
5. **Multi-seleção** — `modeFilter: string` virou `selectedModes: Set<string>`
   (vazio = todos). Filtro: `selectedModes.has(l.modeId)`.
6. **Seleção por categoria** — cabeçalho de cada grupo alterna todos os modos da categoria
   ("Selecionar todos" / "Remover todos").
7. **Contagem por modo** — cada opção mostra o nº de registros (`countByMode`).
8. **Compõe com o período** — o filtro de período (7/30/90/Tudo) da aba Uso continua e agora
   também é persistido; o contador reflete modo + período aplicados.
9. **Acessibilidade** — `aria-haspopup`/`aria-expanded` no gatilho, `role="listbox"`
   + `aria-multiselectable`, `role="option"`/`aria-selected` nas opções, fechar com
   **Esc** (devolve foco ao gatilho) e clique fora, `aria-label` no "Limpar".

O rótulo continua vindo de `getModeLabel(id)` (emoji + nome). O modal de apagar histórico
recebe `defaultModeId` = o único modo selecionado (ou "all" se 0 ou vários).

## Arquivos
- `frontend/src/components/history/HistoryPage.tsx` — componente `ModeFilterCombobox`,
  helpers `loadSelectedModes`/`loadPeriod`, `usageCountByMode`, `modeGroups` (com contagem +
  ordenação por uso), estado `selectedModes` (Set) + efeitos de persistência.
- `frontend/src/components/history/HistoryPage.module.css` — estilos `.combo*`
  (trigger, painel, busca, lista, grupos, opções, contagem) e `.resultCount`;
  `.filterSelect` mantido (usado pelo modal de apagar).

## Verificação
1. `cd frontend && npm run dev` → Histórico → aba **Uso**: combobox no lugar da parede de chips.
2. Buscar por texto, selecionar 1+ modos e categorias inteiras → lista e contador filtram.
3. Recarregar a página → seleção e período persistem.
4. Testar Esc / clique fora / navegação por teclado.
5. `npx tsc --noEmit` → sem novos erros vindos do combobox/filtro.
