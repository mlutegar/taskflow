# 43 - Concluir e Trocar a Atividade Contínua durante o Daily Mode

Voltar ao [[0-Painel]]

## Problema
A [[29-Atividade-Continua-Daily-Focus|atividade contínua]] era definida na fase
`select` e, durante a fase `work`, só permitia **abrir link (+tick)**, ajustar
**progresso** e **minimizar**. Não havia como **concluir** a atividade nem
**trocá-la** por outra sem voltar/reiniciar a sessão.

Cenário real: 3ª rodada do Daily Mode, timers e tarefas ainda ativos; a atividade
contínua do dia era *"responder o Matheus"* → respondi. Quero marcar como concluída
e escolher outra (ex.: Anki) **sem** encerrar o Daily Mode nem mexer na tarefa/timer
em andamento.

## Solução
A atividade contínua é um estado **independente** das tarefas
(`continuousActivity` vs. `tasks`/`currentIdx`/`timerRemaining`), então concluir/
trocar é 100% isolado e não afeta a rodada.

- **Chip da fase `work`** ganhou dois botões:
  - `✓` **Concluir** → `handleCompleteContinuousActivity`: registra a atividade no
    **log do dia**, mantém o **streak** e limpa a atual; abre o **picker inline**.
  - `↻` **Trocar** → apenas abre o picker (substitui sem concluir).
- **Picker inline na `work`**: reaproveita os `CONTINUOUS_PRESETS`, o "↩ Repetir",
  e um input de título. Aparece quando `contActPicking === true` **ou** quando não
  há atividade definida. Escolher/definir fecha o picker (`setContActPicking(false)`).
- Enquanto o picker está aberto, o chip **não** auto-minimiza (guard no
  `useEffect([timerRunning, phase, contActPicking])`).

## Modelo de dados
Novo log **por dia** de conclusões (reseta à meia-noite, via `todayISO()`):
- Chave `taskflow.dailyFocus.continuousActivity.done` → `{ date, items: CompletedEntry[] }`.
- `CompletedEntry`: `title, icon, ticks, progress, goalTarget, goalUnit`.

Novas funções em `continuousActivity.ts`:
- `completeContinuousActivity(): CompletedEntry | null` — push no log do dia +
  `touchHistory` (streak) + `clearContinuousActivity()`.
- `getCompletedToday(): CompletedEntry[]` — lê o log do dia.

## Arquivos
- `frontend/src/lib/continuousActivity.ts` — `DONE_KEY`, `CompletedEntry`,
  `completeContinuousActivity`, `getCompletedToday`.
- `frontend/src/components/daily-focus/DailyFocusPage.tsx` — estado
  `contActPicking`/`contActDoneToday`, `handleCompleteContinuousActivity`,
  botões `✓`/`↻` no chip e o picker inline na fase `work`.
- `frontend/src/components/daily-focus/DailyFocus.module.css` —
  `.contActChipComplete`, `.contActChipSwap`, `.contActPicker*`.

## Verificação
1. Rodar o app (ver [[19-Ambiente-de-Dev]]), definir uma atividade contínua e
   iniciar a sessão.
2. Na `work`, com timer rodando: expandir o chip → `✓ Concluir` → a atividade some
   e o picker aparece; escolher um preset → vira a nova atividade. Confirmar que
   `currentIdx`/tempo restante **não** mudaram.
3. `↻ Trocar` sem concluir → picker abre, seleção substitui a atividade.
4. Recarregar no mesmo dia → atividade atual e "concluídas hoje" persistem; streak
   intacto. Virar o dia → reseta.

## v2 — melhorias
- **Toast com Desfazer**: ao concluir, um toast (`useToast`, [[40-Melhorias-Captura-Rapida]])
  mostra "«atividade» concluída · Nx" com botão **Desfazer** por 6s →
  `uncompleteLast()` remove do log e **restaura** a atividade como atual
  (preserva ticks/progress). Substitui a necessidade de confirmação.
- **Concluídas hoje clicáveis**: no picker viram **chips** que **repetem** aquela
  atividade num clique (não só texto).
- **Auto-concluir ao bater a meta**: quando `progress >= goalTarget`, o chip mostra
  "🎯 Meta batida — concluir?" que dispara a conclusão.
- **Editar link/meta na troca**: o picker inline agora traz link + meta (reaproveitados
  do componente compartilhado), não só o título.
- **Resumo na `celebrate`**: linha "✓ Contínuas concluídas hoje: …" via `getCompletedToday()`.
- **Métricas**: `CompletedEntry` ganhou `link` e `completedAt` (ISO); o histórico do
  streak guarda também `completed` (nº de conclusões/dia) — base para futuros gráficos.
- **Sync cross-device**: o log do dia sincroniza via `day-state`
  (`upsertContinuousCompleted` → coluna `continuous_completed`, migration
  `20260929040000_add_daily_focus_continuous_completed`); merge no boot em
  `loadRemoteContinuousActivity` (adota o remoto se tiver mais itens).
- **Componente extraído**: `ContinuousActivityPicker` remove a duplicação entre as
  fases `select` e `work` (presets, repetir, concluídas, título/link/meta). Prop
  `onPick` faz a troca **substituir** (zera ticks) vs. `onSave` para edição incremental.
- **Testes**: `continuousActivity.test.ts` cobre concluir/desfazer/contagem
  (padrão `modeFocusTimer.test.ts`).

## Arquivos (v2)
- `frontend/src/lib/continuousActivity.ts` — `CompletedEntry` (+`link`/`completedAt`),
  `uncompleteLast`, `getCompletedCountToday`, `writeCompleted` (sync), `touchHistory`
  com `completed`, merge do log em `loadRemoteContinuousActivity`.
- `frontend/src/api/dailyFocusDayState.ts` — `upsertContinuousCompleted`,
  `RemoteDayState.continuousCompleted`.
- `frontend/src/components/daily-focus/components/ContinuousActivityPicker.tsx` — novo.
- `frontend/src/lib/continuousActivity.test.ts` — novo.
- `backend/prisma/schema.prisma` + migration + `backend/src/routes/dailyFocus.js`
  (GET/PUT tratam `continuousCompleted`).

## Verificação (v2)
1. `npm run db:deploy` no backend (aplica a nova migration).
2. `npx vitest run src/lib/continuousActivity.test.ts` → 5 testes verdes.
3. Concluir uma contínua → toast com **Desfazer** funciona (restaura a atividade).
4. Bater a meta (`+` até `progress >= goalTarget`) → botão "🎯 Meta batida — concluir?".
5. Trocar e reabrir picker → chips de "concluídas hoje" repetem a atividade.
6. `celebrate` lista as contínuas concluídas do dia.
7. Cross-device: `GET /daily-focus/day-state` retorna `continuousCompleted`.

Relacionado a [[29-Atividade-Continua-Daily-Focus]] e
[[30-Minha-Sessao-no-Daily-Focus]].
