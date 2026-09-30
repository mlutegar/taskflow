# 27 - Redesign do Bottom Nav (mobile)

Voltar ao [[0-Painel]].

## Contexto
O menu inferior de navegação no mobile estava "flat": ícones emoji crus, indicador
de ativo era apenas uma barrinha fina no topo do item, altura de 64px sem hierarquia
visual e pouco feedback de toque. Objetivo: modernizar mantendo o design system
existente (CSS Modules + tokens roxos em `index.css`, tema escuro).

## Arquivos
- `frontend/src/components/layout/Sidebar.tsx` — componente (não alterado; estrutura mantida)
- `frontend/src/components/layout/Sidebar.module.css` — **todas as mudanças aqui**, no
  bloco `@media (max-width: 640px)`
- Tokens: `frontend/src/index.css` (`--accent #7c6ef5`, `--surface`, `--text-muted`)

## O que mudou (CSS-only)
1. **Barra (`.bottomNav`)** — altura 68px, fundo semi-transparente
   (`color-mix` + `backdrop-filter: blur(14px) saturate`), borda superior mais sutil
   e sombra mais suave/elevada.
2. **Pill de ativo** — removida a barrinha `::before` do topo. Agora o `.navIconWrap`
   dentro do bottom nav vira uma pill arredondada (52×30, radius 16) que, no estado
   ativo, ganha fundo `rgba(124,110,245,0.16)` + glow/box-shadow do accent.
3. **Micro-interações** — ícone ativo com `scale(1.06)`; feedback de toque
   (`:active` → `scale(0.9)` na pill); `min-height: 48px` por item (acessibilidade),
   `-webkit-tap-highlight-color: transparent`.
4. **Tipografia** — label 10.5px com `letter-spacing`; peso 600 quando ativo.
5. **Badge de streak** — reposicionado para caber dentro da pill (Daily Focus).
6. **`prefers-reduced-motion`** — desabilita transforms/transições adicionadas.
7. `.pageArea` padding inferior 64px → 68px para acompanhar a nova altura.

## Notas
- Sem nova dependência: os ícones seguem sendo emoji Unicode.
- O 4º item continua sendo o botão **Menu** (☰ / ✕) que abre o drawer lateral;
  o "9 pendentes/cloud" visto no screenshot é indicador de sync (outro componente),
  fora do escopo desta mudança.

## Fase 2 — Refatoração + melhorias avançadas
Segunda leva de melhorias (todas implementadas):

**Ícones SVG (lucide-react)** — substituídos todos os emojis da navegação por ícones
`lucide-react` (`CheckSquare`, `Repeat`, `Target`, `Gamepad2`, `BarChart3`, `User`,
`Menu`, `X`, `Zap`). Herdam a cor via `currentColor`, ficam nítidos e consistentes
entre SO. Já estava no `package.json` (`^1.33.0`).

**Refatoração em componentes** — `Sidebar.tsx` foi dividido:
- `navItems.tsx` — config única (`NAV_ITEMS`, `MOBILE_PINNED`, `navigate`, `tapHaptic`)
- `BottomNav.tsx` — barra inferior mobile
- `MobileDrawer.tsx` — drawer lateral (estilos inline movidos para o CSS Module)
- `Sidebar.tsx` — sidebar desktop + compõe os dois acima

**Pill deslizante** (`.bottomNavPill`) — um único indicador que desliza entre os slots
via `transform: translateX(index*100%)` com easing "spring", em vez de pill por item.

**Ativo "sob o Menu"** — quando a rota atual está no drawer (Modos/Análises/Perfil),
o botão **Menu** acende (`menuActive`), então o usuário sempre sabe onde está.

**Auto-hide ao rolar** — a barra some ao rolar para baixo (`.bottomNavHidden`) e
reaparece ao subir / perto do topo; nunca esconde com o drawer aberto.

**Haptics** — `navigator.vibrate(8)` no toque (`tapHaptic`, com guarda de suporte).

**Acessibilidade** — `aria-current="page"` no item ativo, `aria-label`,
`aria-expanded` no Menu, `role="dialog"` no drawer, `<nav aria-label>`.

**Tokenização** — criado `--accent-rgb: 124, 110, 245` em `index.css`; todos os
`rgba(124,110,245,…)` hardcoded viraram `rgba(var(--accent-rgb), …)`.

Arquivos novos: `navItems.tsx`, `BottomNav.tsx`, `MobileDrawer.tsx`.
Build de produção (`vite build`) validado.

Relacionado: [[15-Redesign-Card-Nova-Tarefa]], [[16-Redesign-Form-Adicionar-Projeto]],
[[10-Rolagem-da-Pagina]].
