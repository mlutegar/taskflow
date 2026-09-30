# 7 - Tarefas Recorrentes

Voltar ao [[0-Painel]].

## Comportamento de conclusão

Ao concluir uma tarefa recorrente, a ocorrência atual fica com `completed: true` e aparece em
**Concluídas** durante o restante do dia. A `dueDate` já é movida para a próxima ocorrência.

Quando a próxima data chega, `GET /tasks` reativa automaticamente a tarefa (`completed: false`),
limpa `completedAt` e desmarca os itens do checklist para o novo ciclo.

Registros criados pelo comportamento antigo são normalizados automaticamente: se possuem
`completedAt` e a próxima `dueDate` ainda é futura, passam a concluídos até essa data.

Tarefas recorrentes atrasadas são reagendadas a partir de hoje, garantindo que a próxima data
seja futura.

## Filtro Hoje

A tela de tarefas oferece o filtro **Hoje**. Ele mostra apenas tarefas ativas sem data ou com
vencimento até hoje, escondendo tarefas futuras — inclusive a próxima ocorrência de uma tarefa
recorrente.

## Painel "Rotina Diária"

No topo da aba **Tarefas** há o painel **🔁 Rotina Diária** (`DailyRoutinePanel`),
uma visualização rápida que mostra **apenas** as tarefas com recorrência diária.
Objetivo: enxergar de relance as rotinas curtas do dia e reforçar hábitos.

### Filtro
- Considera `recurrence === "daily"` (sempre) e `recurrence === "weekdays"` (só em
  dias úteis, seg–sex) — regra em `lib/dailyRoutine.ts` → `isDailyToday()` /
  `DAILY_RECURRENCES`.
- Lê da lista já carregada em `TasksPage` (query `["tasks","today-panel-all"]`),
  sem chamada extra de API. Some quando não há rotina diária para hoje.

### Recursos
- Contador **N/Total feita(s) hoje** + barra de progresso; mensagem de "rotina
  completa" quando tudo é concluído.
- **Não-feitas primeiro**; toggle **Ocultar/Mostrar feitas**
  (`localStorage["dailyRoutine_hideDone"]`).
- **Arrastar para reordenar** com ordem persistida
  (`localStorage["dailyRoutine_order"]`); ordem sincroniza quando tarefas mudam.
- **Streak por rotina** (🔥 dias seguidos) e **mini-heatmap dos últimos 7 dias**,
  calculados a partir de `GET /tasks/:id/history` via `useQueries`
  (`lib/dailyRoutine.ts`: `computeStreak`, `completedDateSet`, `last7Days`).
- **Subtarefas inline**: expandir e marcar checklist direto no painel
  (reusa `onToggleChecklist`).
- Botão **▶ Foco** leva à sessão de Daily Focus (`#/daily-focus`).
- Conclusão/reabertura em um toque, reusando `handleCompleteWithFeedback` e
  `handleReopenTask` (estado sincronizado com a lista principal).
- Recolhível (`localStorage["dailyRoutinePanel_collapsed"]`).

### Não implementado (próximos passos)
Rota/aba dedicada "Rotinas Diárias", lembretes com horário + notificação push, e
relatório de aderência mensal na `AnalyticsPage` — mudanças mais estruturais,
deixadas para uma etapa futura.

## Painel "Hoje & Atrasadas" + foco minimizado

Na mesma aba Tarefas, abaixo da Rotina Diária:

- **`TodayPanel` (foco das 5 tarefas)** agora inicia **minimizado por padrão**
  (quando não há preferência salva em `localStorage["todayPanel_collapsed"]`).
  Continua funcional — o usuário expande quando quiser.
- **Novo painel `DueTodayPanel` ("📅 Hoje & Atrasadas")** — visualização rápida,
  mesmo estilo dos outros painéis:
  - Lista tarefas não concluídas com `due_date`: **Atrasadas** (`< hoje`, mais antigas
    primeiro) e **Hoje** (`== hoje`). Cabeçalho mostra "N atrasadas · M hoje".
  - **Exclui recorrências diárias** (já estão na Rotina Diária) via `isDailyToday()`.
  - Ações por item: **concluir** em um toque (`handleCompleteWithFeedback`) e
    **redefinir data** inline — atalhos **Hoje**/**Amanhã** + seletor de data,
    via `handleUpdateTask(id, { due_date })`. Badge "atrasada há N dias".
  - **Sinaliza tarefas sem prazo**: bloco expansível "⚠ N sem prazo" (não concluídas,
    `due_date == null`, não recorrentes) com a mesma ação de definir data.
  - Some quando não há nada vencido/hoje nem sem prazo. Colapsável
    (`localStorage["dueTodayPanel_collapsed"]`).

### Melhorias do painel (batch)
- **Adiar em massa**: botão "⤴ Trazer p/ hoje" reagenda todas as atrasadas para hoje.
- **Enviar pro foco**: botão ➕ em cada item adiciona ao painel "Tarefas de Hoje"
  (`dailyTasksApi.add`).
- **Ordenação das atrasadas**: alterna entre "Antigas" e "Críticas"
  (`localStorage["dueTodayPanel_overdueSort"]`).
- **Agrupamento por idade**: "Ontem" / "Esta semana" / "Há mais de 7 dias".
- **Badge de prioridade** por item (🔴🟠🟡🟢) — clique cicla a prioridade.
- **Subtarefas inline** (expandir/marcar) reusando `onToggleChecklist`.
- **Atalhos de data**: Hoje, Amanhã, Próx. seg, +1 semana e **✨ Livre** (dia menos
  carregado nos próximos 7 dias — reagendamento inteligente). Helpers em
  `lib/dailyRoutine.ts` (`addDaysISO`, `daysBetweenISO`, `nextMondayISO`).
- **Badge de atrasadas** no cabeçalho da aba Tarefas (⏳ N).

### Hora de vencimento (`due_time`)
Campo opcional "HH:MM" além do `due_date`.
- Backend: coluna `due_time` (migração `20260919000000_add_task_due_time`), validação
  Zod, `shapeTask`, create/patch e `snapshotToTaskData` em `backend/src/routes/tasks.js`;
  schema em `backend/prisma/schema.prisma` (`dueTime String? @map("due_time")`).
- Frontend: input de hora no `AddTaskForm` e no editor inline do `DueTodayPanel`;
  exibição "⏱ HH:MM" no `TaskCard` e nos painéis; tipos em `types/tasks.ts`.
- **Notificações**: `DueTodayPanel` agenda lembrete (via `lib/notifications.ts`
  `scheduleTaskReminder`) para tarefas de hoje com hora definida, se a permissão de
  notificação estiver concedida (ativável pelo `NotificationBell`).

## Arquivos

- `backend/src/routes/tasks.js` — endpoint `GET /tasks/:id/history`
- `frontend/src/pages/TasksPage.tsx`
- `frontend/src/components/DailyRoutinePanel.tsx` — painel Rotina Diária
- `frontend/src/components/DueTodayPanel.tsx` — painel Hoje & Atrasadas + sem prazo
- `frontend/src/components/TodayPanel.tsx` — painel de foco (agora minimizado por padrão)
- `frontend/src/lib/dailyRoutine.ts` — filtro, streak, janela de 7 dias e helpers de data
- `frontend/src/lib/notifications.ts` — lembretes (reaproveitado para tarefas com hora)
- `frontend/src/components/AddTaskForm.tsx` — input de hora de vencimento
- `frontend/src/components/TaskCard.tsx` — exibe "⏱ HH:MM"
- `backend/prisma/schema.prisma` + migração `add_task_due_time` — coluna `due_time`
- `backend/src/routes/tasks.js` — validação/gravação de `due_time`
- `frontend/src/components/TodayPanel.module.css` — CSS reaproveitado pelos painéis
