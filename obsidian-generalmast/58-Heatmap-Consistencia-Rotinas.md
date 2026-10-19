# 58 - Heatmap de Consistência das Rotinas

Card **"Consistência das Rotinas"** no topo da aba **Tarefas** (acima de "Rotina Diária"),
no estilo do gráfico de contribuições do GitHub.

Relacionado: [[7-Tarefas-Recorrentes]] · [[20-Modal-Detalhes-na-Rotina]] · [[37-Redesign-Icons-Tela-Tarefas]] · [[42-Melhorias-Habitos-e-Recorrencia]] · [[0-Painel]]

---

## Por que

O painel "Rotina Diária" só mostrava um mini-heatmap de **7 dias por rotina**, dentro de
cada linha. Não existia visão agregada da consistência ao longo do tempo, período
configurável nem estatísticas de sequência.

## Fonte de dados — não precisou de migração

As "rotinas" da aba Tarefas **não** são a entidade `Routine` (essa é da página Hábitos).
São **`Task` com `recurrence` em `daily` ou `weekdays`** — mesmo critério de
`isDailyToday()` em `frontend/src/lib/dailyRoutine.ts`.

O histórico por dia **já existia**: tabela `task_completions` (`TaskCompletion` no Prisma),
com `taskId`, `scheduledFor` (o dia a que a conclusão se refere), `completedAt` e
`undoneAt` (desfazer não apaga o registro, só carimba o timestamp). Cada check/uncheck já
gravava ali via `POST /tasks/:id/complete`, `undo-complete` e `reopen`.

O que faltava era **leitura agregada**: antes era `GET /tasks/:id/history`, uma query por
rotina (`useQueries`), limitada a 90 registros.

> **Limitação assumida:** a recorrência histórica não é versionada. "Quantas rotinas eram
> esperadas no dia D" é reconstruído a partir da recorrência *atual* da tarefa +
> `created_at` (dias anteriores à criação não contam).

## Backend

`GET /tasks/routines/consistency?from=YYYY-MM-DD&to=YYYY-MM-DD`
(`backend/src/routes/tasks.js`)

Duas queries agregadas — nunca uma por célula:

1. `task.findMany` com `recurrence IN ('daily','weekdays')` → `id`, `recurrence`, `createdAt`
2. `taskCompletion.findMany` com `undoneAt: null` e `scheduledFor` na janela

Resposta:

```json
{ "from": "...", "to": "...",
  "routines": [ { "id": "...", "title": "Ler 20 páginas", "recurrence": "daily" } ],
  "days": [ { "date": "2026-10-18", "expected": [0,1,2], "completed": [0,2] } ],
  "best_streak": 14,
  "best_streak_by_routine": [14, 3, 7] }
```

`expected`/`completed` são **índices** na lista `routines`, não contagens. Com isso o
cliente sabe *quais* rotinas entraram em cada dia — o que alimenta o tooltip detalhado e
o filtro por rotina **sem nenhum refetch**. Índices em vez de UUIDs porque o payload de
1 ano × N rotinas precisa continuar pequeno.

`best_streak_by_routine` existe porque, ao filtrar por uma rotina, o "🏆 Melhor
sequência" precisa continuar sendo o recorde de **todo o histórico** daquela rotina — e
o período devolvido em `days` é só a janela pedida.

- `expected` = rotinas cuja recorrência se aplica ao dia da semana **e** já existiam na data
  (`weekdays` não conta sáb/dom).
- Conclusões duplicadas da mesma rotina no mesmo dia são deduplicadas por `Set`.
- `best_streak` varre **todo o histórico** (teto de ~3 anos), não só o período pedido.
- Fuso: `requestCalendar(req)` (header `x-timezone` → preferências → default), o mesmo de
  `completed-today-count`.
- Tetos: período ≤ 400 dias, histórico ≤ 1100 dias.

Helpers novos no topo do arquivo: `ROUTINE_RECURRENCES`, `shiftISO`, `diffISO`,
`bestFullDayStreak`.

## Frontend

| Arquivo | Papel |
|---|---|
| `src/lib/routineConsistency.ts` | **lógica pura**, sem React: grade, níveis, sequências, %, `projectDays` (filtro), `cellRoutines` (detalhe do dia) |
| `src/lib/routineConsistency.test.ts` | 37 testes (Vitest) |
| `src/hooks/useRoutineConsistency.ts` | React Query + memos + período persistido |
| `src/components/routine-heatmap/RoutineConsistencyCard.tsx` | card + cabeçalho + seletor |
| `src/components/routine-heatmap/HeatmapGrid.tsx` | grade, meses, tooltip, scroll |
| `src/components/routine-heatmap/HeatmapStats.tsx` | rodapé + legenda |
| `src/components/routine-heatmap/routineHeatmap.module.css` | tokens e escala de verdes |

Integração: `<RoutineConsistencyCard />` dentro de um `ErrorBoundary` em
`src/pages/TasksPage.tsx`, logo acima de `<DailyRoutinePanel />`. Nada mais na tela mudou.

### Regras de cálculo

- **Nível de cor** (% arredondada de rotinas esperadas concluídas):
  `0%` → cinza (`--surface-2`) · `1–33%` · `34–66%` · `67–99%` · `100%` → `--success`.
- **Dia sem rotina agendada** (`expected === 0`): célula neutra (só borda), **não conta**
  no total e **não quebra** sequência.
- **Dia concluído** = 100% das rotinas esperadas feitas.
- **Sequência atual**: dias concluídos consecutivos até hoje. Se hoje ainda está
  incompleto, **não quebra** — conta até ontem.
- **Dias futuros não aparecem**: a grade termina em hoje.
- Datas sempre em ISO local (`America/Sao_Paulo`), nunca `toISOString()` cru.

### Atualização instantânea

`bumpTodayConsistency(queryClient, taskId, done)` adiciona/remove o **índice daquela
rotina** no `completed` do dia de hoje, via `setQueriesData`. Chamado no `onSuccess` de
`completeMutation` (`done: true`), `undoCompleteMutation` e `reopenMutation`
(`done: false`) em `src/hooks/useTasks.ts`, filtrando por `isRoutineTask()` (só
`daily`/`weekdays`). Sem refetch, sem reload — e como mexe no índice certo, o detalhe do
dia e o filtro por rotina continuam coerentes.

### UI

- Período: "Últimos 30 dias / 3 meses / **6 meses** (padrão) / Último ano", persistido em
  `localStorage` na chave `routineHeatmap_range`.
- **Filtro por rotina** (`<select>` "Todas as rotinas" + uma opção por rotina, só aparece
  com 2+ rotinas). É 100% client-side via `projectDays(days, routineIndex)`: filtrar não
  dispara requisição. Não é persistido — é exploratório, diferente do período.
  Com filtro ativo, dias em que aquela rotina **não** estava agendada viram **neutros**
  (não contam no % nem quebram a sequência), e 🏆 passa a usar `best_streak_by_routine`.
  Se a rotina filtrada é excluída, o filtro volta sozinho para "todas".
- **Detalhe do dia** (hover no desktop, toque no mobile): além de "18 out 2026 · 2 de 3
  rotinas", lista **quais** rotinas estavam agendadas, com ✓ verde nas concluídas e
  círculo vazio nas demais — concluídas primeiro (`cellRoutines`). Teto de 8 linhas +
  "+N outras". O clique **fixa** a célula (`pinned`) para o detalhe não sumir ao mover o
  mouse; clicar fora solta. A área reserva altura fixa para a grade não "pular".
- Scroll horizontal **dentro do card** (`overflow-x: auto` + `overscroll-behavior-x: contain`),
  aberto já na semana mais recente (`useLayoutEffect` → `scrollLeft = scrollWidth`).
- Tooltip no hover **e** no toque (célula fixada; clique fora fecha):
  `"18 out 2026 · 2 de 3 rotinas"`.
- Mobile (≤640px): célula 15px (alvo de toque), rodapé quebra em linhas.
- Skeleton de 26 semanas no loading; mensagem curta quando não há histórico.

## Como testar

```bash
cd frontend && npx vitest run src/lib/routineConsistency.test.ts   # 37 testes
cd backend  && npm test                                            # 41 testes
cd frontend && npm run build
```

Manual: abrir a aba Tarefas → card no topo; marcar/desmarcar uma rotina e ver a célula de
hoje + estatísticas mudarem na hora; passar o mouse numa célula e conferir a lista de
rotinas com ✓; trocar o filtro de rotina (não deve haver requisição nova no Network);
trocar o período e recarregar (deve manter); DevTools em 375px para conferir o scroll
interno e o toque na célula.

Conferência rápida da regra de `weekdays` no payload: numa **data de fim de semana**, a
rotina `weekdays` não pode aparecer em `expected`. No smoke test de 18/10/2026 (domingo),
"Correr[weekdays]" ficou de fora — correto.
