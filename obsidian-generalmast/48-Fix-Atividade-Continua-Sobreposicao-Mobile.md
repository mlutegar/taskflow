# 48 - Fix: Sobreposição da Atividade Contínua com o FAB no Mobile

Voltar ao [[0-Painel]] · Relacionados: [[26-Modo-Minimizavel-Card-Flutuante]], [[29-Atividade-Continua-Daily-Focus]], [[34-Card-Persistente-Daily-Focus]], [[43-Concluir-Trocar-Atividade-Continua]]

## Problema
No **mobile**, o card flutuante de **Atividade Contínua** (fase `work`) ficava **atrás do FAB
"Nova tarefa"** (botão + roxo, canto inferior direito). Os dois ficavam praticamente no mesmo
ponto e o FAB vencia por `z-index`, cobrindo os botões da atividade (+1/↗/⧉, ✓, ↻, –), que
ficavam parcialmente inclicáveis.

Causa raiz:
- `.contActChip` / `.contActChipMini`: `position: fixed; right: 12px; bottom: 84px; z-index: 40`
  e **sem nenhuma media query mobile**.
- `.fab` (`QuickTaskButton.module.css`): `z-index: 900` e no mobile (`@media (max-width: 640px)`)
  vira círculo em `right: 16px; bottom: calc(84px + env(safe-area-inset-bottom))`.
- Mesmo canto + `z-index` 40 vs 900 → o FAB fica por cima.

## Solução
Correção isolada no mobile por CSS + ajuste do estado inicial; **desktop inalterado**.
Combina reposicionamento (não colidir com o FAB) + versão compacta que expande ao tocar.

### Arquitetura
- **`src/components/daily-focus/DailyFocus.module.css`**
  - `.contActChip` e `.contActChipMini`: `z-index: 40` → **`950`** (acima do FAB `900`, abaixo do
    modal `1000`).
  - Nova `@media (max-width: 640px)`:
    - `.contActChip` (expandido): `left: 12px; right: 12px; max-width: none;`
      `bottom: calc(84px + 56px + 16px + env(safe-area-inset-bottom))` → ancora **acima** do FAB,
      largura útil, botões totalmente livres.
    - `.contActChipMini`: `right: calc(16px + 56px + 12px)` (ao lado esquerdo do FAB),
      `bottom: calc(84px + env(safe-area-inset-bottom))`.
    - Botões internos (`.contActChipOpen/Minimize/Complete/Swap/Copy`) → `34x34px` para alvo de
      toque confortável.
- **`src/components/daily-focus/DailyFocusPage.tsx`**
  - `contActMinimized` passa a iniciar `true` no mobile:
    `useState(() => typeof window !== "undefined" && window.matchMedia("(max-width: 640px)").matches)`.
    No mobile começa como indicador compacto (mini) e **expande ao tocar** (reaproveita o
    `onClick={() => setContActMinimized(false)}` já existente); no desktop segue expandido.

## Melhorias v2 (robustez, interação e a11y)

Evolução em cima do fix inicial:

- **Tokens de layout globais** (`src/index.css`): `--fab-size`, `--bottomnav-h`, `--safe-bottom`,
  `--z-fab`, `--z-floating-card`. FAB (`QuickTaskButton.module.css`) e chips
  (`DailyFocus.module.css`) passam a consumir os mesmos valores → ajustar um não reintroduz
  sobreposição.
- **Reage a rotação/resize**: listener em `matchMedia(MOBILE_MQ)` reavalia o padrão compacto,
  **exceto** se o usuário já escolheu manualmente.
- **Preferência persistida por dispositivo**: escolha manual (minimizar/expandir) é salva em
  `localStorage` (`taskflow.dailyfocus.contActMinimized`) e vence o padrão do viewport.
  Lógica isolada e testada em `src/lib/continuousActivityUiPrefs.ts`.
- **Auto-minimizar ao abrir a Captura Rápida**: `DailyFocusPage` consome `useQuickTask()`; ao
  abrir o FAB/atalho no mobile, a Atividade Contínua recolhe para não competir.
- **Gestos e clique-fora**: swipe-down (>40px) e toque fora do card (no mobile) minimizam.
- **Animação de revelação** (`@keyframes contActReveal`) com respeito a
  `prefers-reduced-motion`.
- **Anel de progresso da meta** no indicador compacto (`conic-gradient` + mask).
- **A11y**: `aria-expanded`/`aria-label` no mini, `role="group"` + `aria-live="polite"` no card,
  foco movido para o 1º botão ao expandir, e alvos de toque de **40px** no mobile.

Arquivos v2: `src/index.css`, `src/components/QuickTaskButton.module.css`,
`src/components/daily-focus/DailyFocus.module.css`,
`src/components/daily-focus/DailyFocusPage.tsx`,
`src/lib/continuousActivityUiPrefs.ts` (+ `.test.ts`, 5 testes).

## Verificação
1. `cd frontend && npm run dev`, logar, entrar na fase **work** do Daily Focus com uma Atividade
   Contínua definida.
2. **Desktop:** card continua expandido e idêntico ao atual.
3. **Mobile (DevTools ≤640px, ex. iPhone SE):**
   - Atividade Contínua aparece **compacta** por padrão, sem sobrepor o FAB.
   - Tocar expande; todos os botões (+1/↗/⧉, ✓, ↻, –) visíveis e clicáveis, sem cobertura do FAB.
   - FAB "Nova tarefa" continua clicável.
   - Testar com device com notch (`env(safe-area-inset-bottom)`).
4. Regressão: fase `select` (`.contActField`) e CTAs de pausa (`.contActPauseCta`) inalteradas.
5. **v2 — comportamento:**
   - Minimizar/expandir manualmente e recarregar: a escolha é lembrada (localStorage).
   - Girar o device (sem escolha manual): alterna padrão compacto/expandido.
   - Abrir "Nova tarefa" (N / ⌘K / FAB) no mobile: a Atividade Contínua recolhe.
   - Swipe-down no card e toque fora minimizam.
   - `prefers-reduced-motion`: sem animação de revelação.
6. **v2 — testes:** `npx vitest run src/lib/continuousActivityUiPrefs.test.ts` → 5 testes passam.
