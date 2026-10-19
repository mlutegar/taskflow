# 60 - Redesign mobile (PWA) da tela de Tarefas

Novo layout da aba Tarefas **no breakpoint mobile (≤ 640px)**. O desktop ficou intacto.

Relacionado: [[58-Heatmap-Consistencia-Rotinas]] · [[59-Botao-Nova-Rotina-e-Fix-UserId]] · [[37-Redesign-Icons-Tela-Tarefas]] · [[53-Redesign-Filtros-e-Pagina-Tarefa]] · [[0-Painel]]

---

## Problemas que motivaram

| Problema | Causa |
|---|---|
| Heatmap colapsava para **uma célula** | bug de dados (ver abaixo) |
| Dois seletores empilhados comendo altura | sem layout mobile |
| Estatísticas + legenda empilhadas | idem |
| 3 botões espremendo o título da Rotina Diária | idem |
| FAB "+" por cima do conteúdo | FAB próprio da `TasksPage` |

## O bug do heatmap de uma célula

Não era CSS. `GET /tasks/routines/consistency` montava os dias a partir de
`start = max(rotina mais antiga, teto de histórico)` e só então filtrava `>= from`. Com a
rotina mais antiga criada **hoje**, a resposta tinha **um único dia** — e a grade
desenhava uma célula.

Corrigido em duas camadas:

1. **Backend** (`backend/src/routes/tasks.js`): `start = min(from, history)`, então `days`
   cobre o período pedido por inteiro. Dias anteriores à criação da rotina saem com
   `expected: []` → célula neutra, que é o correto. Usuário **sem rotina nenhuma** também
   passou a receber o período em branco em vez de `days: []`.
2. **Frontend** (`routineConsistency.ts`): `buildHeatmapGrid(days, today, from?)` ancora a
   grade em `from` em vez do primeiro dia com dado — a grade fica certa mesmo com cache
   velho ou offline.

Verificado: `?from=2026-04-22&to=2026-10-18` → **180 dias**, 179 neutros.

## Arquitetura: como o desktop não foi afetado

Duas camadas, nenhuma tocando caminho de desktop:

1. **CSS** — todo estilo novo dentro de `@media (max-width: 640px)`, e quase todo ele
   prefixado por `.panelMobile`, classe que só é aplicada no mobile.
2. **Estrutura** — o que muda de marcação fica atrás de **`useIsMobile()`**.

### `useIsMobile` (novo, `src/hooks/useIsMobile.ts`)

Já existia `isMobileViewport()` em `lib/continuousActivityUiPrefs`, mas ele lê o valor
**uma vez e não re-renderiza**. Como o redesign troca marcação (não só CSS), precisava ser
reativo: `useSyncExternalStore` + `matchMedia(MOBILE_MQ)`, com fallback `addListener` para
Safari antigo. Reaproveita o mesmo `MOBILE_MQ` (640px) já adotado no projeto.

## Componentes

### Novos

| Arquivo | Papel |
|---|---|
| `hooks/useIsMobile.ts` | breakpoint reativo |
| `components/tasks-mobile/MobileHeader.tsx` | "Meu dia" + data por extenso + botão "+" |
| `components/tasks-mobile/TodayProgressCard.tsx` | card "Seu progresso hoje" |
| `components/routine-heatmap/HeatmapOptionsSheet.tsx` | bottom sheet de opções |

### Alterados

`index.css` (tokens), `TasksPage.tsx`, `RoutineConsistencyCard`, `HeatmapGrid`,
`HeatmapStats`, `routineHeatmap.module.css`, `routineConsistency.ts`,
`DailyRoutinePanel.tsx`, `TodayPanel.tsx`, `TodayPanel.module.css`, `navItems.tsx`,
`BottomNav.tsx`, `Sidebar.module.css`, `backend/src/routes/tasks.js`.

## Tokens

Em `src/index.css`, para não espalhar hex pelos componentes:

```css
--radius-lg: 24px;   --card-pad: 20px;
--progress: var(--success);   /* verde-água */
--streak:   var(--warning);   /* laranja */
--hm-0..4                      /* escala do heatmap, agora no tema */
```

A escala `--hm-*` **saiu do CSS module e foi para o tema**, o que permitiu dar aos verdes
translúcidos mais corpo no **tema claro** (sobre fundo branco eles sumiam).

## Detalhes de implementação que importam

- **Célula responsiva:** `HeatmapGrid` mede o container com `ResizeObserver` e calcula
  `cell = floor((largura - rótulos) / semanas) - gap`, limitado a **[7px, 14px]**,
  escrevendo em `--hm-cell`. 6 meses cabem sem scroll; "Último ano" não cabe no mínimo e
  **volta a rolar**, já posicionado no fim.
- **Pill + sheet:** no mobile os dois `<select>` viram um pill que abre o
  `HeatmapOptionsSheet` (período, filtro de rotina, 🏆 melhor sequência, legenda
  Menos/Mais). O estado continua em `useRoutineConsistency`.
- **Rodapé:** uma linha — tendência à esquerda, `% concluídos` em verde-água à direita.
  O rodapé inteiro é um `<button>` que abre o sheet.
- **Menu "⋯"** na Rotina diária: o container faz `stopPropagation` no `pointerdown`,
  senão o listener de "clique fora" desmontava o menu antes do `onClick` do item disparar.
- **`isCollapsed`:** no mobile não há botão de recolher; um `collapsed: true` herdado do
  desktop (localStorage) travaria o card sem conteúdo e sem saída. Por isso
  `const isCollapsed = isMobile ? false : collapsed` nos dois painéis.
- **FAB:** deixa de ser renderizado quando `isMobile` — quem cria tarefa é o "+" do
  cabeçalho. O CSS do `.fab` continua lá (inócuo, já era `display:none` no desktop).
- **`shortLabel`:** "Daily Focus" vira "Foco" **só** na bottom nav. Renomear o `label` em
  `navItems.tsx` teria mudado também a sidebar do desktop, que lê o mesmo campo.
- **Safe area:** `.pageArea` ganhou +16px no `padding-bottom` para o último card não
  encostar na bottom nav.
- **`isEmpty`** passou a significar "não há rotina nenhuma" (antes era "não há dias") —
  com a correção, a grade nunca mais vem vazia.

## Como testar

```bash
cd frontend && npx vitest run       # 198 passando (ModePicker falha, pré-existente)
cd backend  && npm test             # 41
cd frontend && npm run build
```

DevTools em **375×812**: grade de 6 meses inteira sem scroll; "Último ano" rola no fim;
um seletor só; rodapé em uma linha abrindo o sheet; marcar rotina move "Seu progresso
hoje"; sem FAB; nav com "Foco"; último card livre da nav.
Em **1440px**: comparar com o estado anterior — nada deve mudar.

> Conferência do fix de dados:
> `GET /tasks/routines/consistency?from=2026-04-22&to=2026-10-18` → `days.length === 180`.
