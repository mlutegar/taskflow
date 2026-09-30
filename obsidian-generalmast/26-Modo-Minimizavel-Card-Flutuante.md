# 26 - Modo Minimizável — Card Flutuante Persistente

Voltar ao [[0-Painel]] · Relacionados: [[1-Tela-Escolher-Modo]], [[2-Modos-e-Tipos]], [[9-Cache-Sync-e-Versionamento]]

## Problema
A sessão de um modo (ex.: **"Escute 100 músicas"**) era renderizada em **tela cheia** dentro do
`ModesPanel`, cujo estado vive dentro da página `ModesPage`. Como o roteamento é **por hash**
(`main.tsx` troca a página conforme `window.location.hash`), sair da página **desmontava a
`ModesPage` e destruía a sessão ativa**. Não dava para navegar (ex.: voltar às Tarefas) mantendo o
modo rodando.

## Solução
Elevar a sessão de modo único para um **provider global** montado **acima do roteador**, de modo que
ela sobreviva à navegação e possa alternar entre **tela cheia ⇄ minimizada**.

### Fluxo
`Modo` → selecionar "Escute 100 músicas" → ativar → **minimizar** →
**card flutuante** "Escute 100 músicas" fica visível sobre qualquer página →
usuário volta para Tarefas e continua vendo o modo ativo →
clicar no card **expande** de volta para os controles.

## Arquitetura
- **`src/contexts/ActiveModeContext.tsx`** (novo) — provider + hook `useActiveMode()`.
  - Estado: `activeMode`, `intention`, `minimized`.
  - API: `activate(mode, intention?)`, `minimize()`, `expand()`, `close()`.
  - Obtém dados/handlers de tarefas e rotinas via `useTasks`/`useRoutines` (React Query — **cache
    compartilhado** com as páginas, sem duplicar dados).
  - Renderiza via `createPortal(document.body)`:
    - `ModeSession` (overlay tela cheia) quando `activeMode && !minimized`.
    - `FloatingModeCard` quando `activeMode && minimized`.
  - Ao fechar dispara o evento `MODE_SESSION_CLOSED_EVENT`; a contabilização de conclusão de tarefa
    (`logCompletion` + `modeStatsApi.increment`) vive aqui e dispara `modeStatsUpdated`.
- **`src/components/modes/FloatingModeCard.tsx`** (+ `.module.css`, novo) — card fixo no canto
  (`z-index: 950`, entre `MultiCardSession`=900 e modais=1000). Mostra emoji + nome do modo, clique
  expande, X encerra.
- **`src/main.tsx`** — `<Root>` autenticado envolvido por `<ActiveModeProvider>`.
- **`src/components/ModeSession.tsx`** — nova prop `onMinimize?`; botão **▁** (minimizar) no canto
  superior do modal. Minimizar **não** encerra a sessão nem abre o `PostSessionForm`.
- **`src/components/ModesPanel.tsx`** — deixa de ter estado/render local da sessão; usa
  `useActiveMode().activate(...)` em `confirmIntention`, no banner de detox e no "pular intenção".
  Ouve `MODE_SESSION_CLOSED_EVENT`/`modeStatsUpdated` para recarregar ativações, insights e stats.

## Melhorias incluídas
- **Persistência a reload/crash:** snapshot `{modeId, intention, minimized, startedAt}` salvo em
  `SK.ACTIVE_MODE_SESSION` e reidratado no boot do provider (resolve o modo em `MODES` + custom).
- **Cronômetro ao vivo** no card (`⏱ N min` / `Nh mm`) a partir de `startedAt` (atualiza a cada 15s).
- **Arrastar para reposicionar** o card (pointer events), com posição memorizada em
  `SK.FLOATING_CARD_POS` e *clamp* à viewport; clique curto (< 5px) expande.
- **Indicador de sessão ativa** reativo em toda a navegação: ponto no item **🎮 Modos** da
  `Sidebar` (desktop + drawer) e no header da `ModesPage` — todos leem `useActiveMode()`
  (Sidebar/ModesPage estão dentro do provider).
- **Expandir pelo painel:** o botão "● Ver sessão" do `ModeCard` chama `expand()`.
- **Anti-conflito:** iniciar um modo diferente com sessão em andamento pede confirmação
  ("Trocar de modo?") — helper `startMode()` no `ModesPanel`, usado na intenção, no banner de
  detox e no "pular intenção".
- **Gestos/atalhos no `ModeSession`:** swipe curto (>50px) minimiza, swipe longo (>160px) encerra;
  **Esc** minimiza (mantém a sessão viva); tecla **M** minimiza (ignora quando digitando).
- **Constantes centralizadas** em `src/lib/modeEvents.ts` (`MODE_SESSION_CLOSED_EVENT`,
  `MODE_STATS_UPDATED_EVENT`).

## Escopo
- Aplica-se à **sessão de modo único** (`ModeSession`) **e à sessão multi-card**
  (`MultiCardSession`) — ambas gerenciadas pelo `ActiveModeContext`.

## Multi-card minimizável (follow-up)
A sessão multi-card também foi elevada ao `ActiveModeContext` e ganhou o botão **▁** (ao lado de
"Encerrar"):
- **Estado no provider:** `multi` (`cards`, `startedAt`, `initialIndex`, `sessionMode`, `intention`,
  `minimized`), com API `activateMultiCard()`/`minimizeMulti()`/`expandMulti()`/`closeMulti()` e
  `hasActiveSession` (única **ou** multi).
- **Reidratação:** `loadMultiCard()` resolve os ids de `loadActiveSession()` no mount (o restore que
  ficava no `ModesPanel` foi movido para cá). Persistência via `multiCardSessionLog.ts`, agora com
  campo `minimized` (+ helper `updateActiveSessionMinimized`).
- **Preserva o cronômetro:** ao minimizar, o `MultiCardSession` **não é desmontado** — fica dentro de
  um wrapper `display:none`. Além disso, `globalStartRef` passou a derivar de `startedAt` (robustez em
  reload). Atalhos de teclado globais (setas/Esc) são **desativados** quando minimizada (prop
  `minimized`) para não capturar teclas em outras páginas.
- **Card flutuante reutilizado:** `FloatingModeCard` ganhou prop opcional `count` → rótulo
  "Sessão · N modos"; mostra o modo do card atual e o cronômetro.
- **`ModesPanel`:** removido o estado/render/restore local do multi-card; agora chama
  `activateMultiCard()` nos fluxos de intenção.

## Melhorias (segunda rodada)
- **Uma sessão por vez (#2):** `activate()` encerra qualquer multi-card e `activateMultiCard()`
  encerra qualquer modo único — invariante garantida no provider. Nos fluxos de início (`startMode`/
  `startMultiCardSession` do `ModesPanel`) há confirmação "Trocar de sessão?" antes de descartar uma
  em andamento (não perde progresso silenciosamente).
- **Auto-avanço não roda escondido (#1):** o countdown do `MultiCardSession` é pausado quando
  `minimized` (além dos atalhos de teclado, já desativados).
- **Card mostra o modo/progresso certo (#3, #4):** `MultiCardSession` reporta o índice via
  `onIndexChange`; o `FloatingModeCard` exibe "Card i/N" e o modo do card atual.
- **Botão expandir explícito (#5)** (⤢) + **confirmação em 2 passos ao encerrar pelo card (#6)**
  (X → "Encerrar? ✓ ✕").
- **Indicador reativo (#9):** `ModesPage` e `Sidebar` usam `hasActiveSession` do contexto (single OU
  multi) — removido o boilerplate de listeners de `localStorage` na `ModesPage`.
- **Testes (#10):** `multiCardSessionLog.test.ts` cobre save/load/roundtrip com os novos campos e os
  helpers `updateActiveSessionIndex`/`updateActiveSessionMinimized`.

> Nota: a unificação total single+multi num único tipo discriminado (#8) foi avaliada mas **não**
> implementada — o ganho de comportamento (uma sessão por vez, índice correto) já foi obtido de forma
> cirúrgica em #2/#3, sem o risco de um refactor grande de baixo valor para o usuário.

## Melhorias (terceira rodada) — visibilidade, ícones, PWA e deploy
- **Botão minimizar visível:** o botão do `MultiCardSession` deixou de ser o glifo `▁` quase invisível
  e virou um botão bordado **"[icon] Minimizar"** (`.minBtn`, hover accent), agrupado com "Encerrar"
  por um divisor (`.topActions`/`.actionsDivider`).
- **Ícones SVG inline** (`components/shared/icons.tsx`: `MinimizeIcon`/`ExpandIcon`/`CloseIcon`) usados
  no minimizar (multi e single) e no card flutuante (expandir/encerrar) — renderizam igual em qualquer
  SO, sem depender de emoji.
- **Atalho `M` minimiza** a sessão multi-card (dica atualizada: "→ próximo · ← anterior · M minimizar ·
  Esc sair"). O single-mode já tinha.
- **Dica de 1ª vez** ("Dá pra minimizar e continuar navegando") perto do botão, dispensada no clique
  ou no ✕, persistida em `SK.MINIMIZE_HINT_SEEN`.
- **Update do PWA sem refresh manual (#1):** `registerType: "prompt"`; `sw.ts` só faz `skipWaiting()`
  ao receber `SKIP_WAITING`; novo `UpdatePrompt` (`registerSW` de `virtual:pwa-register`) mostra banner
  "Nova versão disponível — Atualizar" e revalida a cada 60s / ao focar. Ver [[33-PWA-Update-e-Deploy]].
- **Script de deploy** `deploy-vps.sh` (raiz do projeto) automatiza tar → backup `.env` → scp →
  extrair → rebuild (`APP_COMMIT` automático) → espera health → relatório. Ver [[33-PWA-Update-e-Deploy]].

## Follow-up
- [[47-Fix-Encerrar-pelo-Card-Registra-Sessao]] — encerrar **pelo card minimizado** não salvava a
  sessão para análise (pulava o `PostSessionForm`); corrigido para expandir e abrir o registro.

## Verificação
1. `cd frontend && npm run dev`, logar.
2. **Modos** → ativar "Escute 100 músicas" → sessão em tela cheia.
3. **Minimizar (▁)** → aparece o card flutuante no canto.
4. Navegar para **Tarefas** → card continua visível.
5. Clicar no card → sessão expande com controles ao vivo.
6. Encerrar (X do card ou da sessão) → fluxo normal de resumo/`PostSessionForm`; card some.
7. `npx vite build` compila sem erros.
