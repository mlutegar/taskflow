# 42 - Melhorias em Hábitos: modal, feedback, recorrência e renomeação

> Ver também: [[0-Painel]] · [[35-Rotina-Diaria-na-Pagina-Rotinas]] · [[7-Tarefas-Recorrentes]] · [[20-Modal-Detalhes-na-Rotina]]

## Motivação
Após trazer o painel "🔁 Rotina Diária" para `#/routines` ([[35-Rotina-Diaria-na-Pagina-Rotinas]]),
um conjunto de melhorias fecha as pontas soltas e resolve a confusão de nomes
"Rotinas" × "Rotina Diária".

## O que mudou

### 1. Modal de detalhes no painel da página Hábitos
O `DailyRoutinePanel` em `#/routines` agora recebe `onOpenDetail`, reaproveitando o
`useTaskDetail` + `TaskDetailModal` (mesmo padrão de `TasksPage`). Clicar numa tarefa
diária abre o modal de detalhes/edição (deep-link `?task=`), com projetos e checklist.
Arquivos: `frontend/src/pages/RoutinesPage.tsx`.

### 2. Feedback de conclusão consistente
Concluir uma tarefa diária no painel agora mostra o toast **"✅ … · Desfazer"**
(`CompletionToast` + `handleUndoCompleteTask`), igual à página de Tarefas, em vez de
conclusão silenciosa.

### 3. Cache de tarefas compartilhado (menos fetch)
O painel e o modal usam a **mesma `queryKey`** `["tasks","today-panel-all"]` da página de
Tarefas → navegar Tarefas ⇆ Hábitos não refaz o fetch.

### 4. `?filter=today` e filtro "Hoje"
`RoutinesPage` lê `?filter=` da URL (`initialRoutineFilter`). Novo filtro **"Hoje"**
(`status=today`) lista só hábitos válidos hoje pela recorrência. Assim
`?filter=today#/routines` passa a ter efeito previsível.

### 5. Renomeação "Rotinas" → "Hábitos"
Para separar do painel "Rotina Diária" (que é de *tarefas* recorrentes), a aba/página do
rastreador de hábitos virou **"Hábitos"**:
- `frontend/src/components/layout/navItems.tsx` (label do menu).
- `frontend/src/pages/RoutinesPage.tsx` (cabeçalho, botão "Novo hábito", toast).
- A **rota permanece `#/routines`** (sem quebra de links).

### 6. Recorrência/agendamento de hábitos (backend + UI)
Hábitos agora podem ter recorrência opcional (antes eram sempre "todo dia").
- **Schema:** coluna `recurrence String?` em `Routine`
  (`backend/prisma/schema.prisma`) + migração
  `backend/prisma/migrations/20260929020000_add_routine_recurrence/migration.sql`.
- **Backend** (`backend/src/routes/routines.js`): helper `appliesToday(recurrence)`
  (espelha `lib/dailyRoutine.ts`: `null/none` = sempre; `daily` = todo dia;
  `weekdays` = seg–sex). `shapeRoutine` expõe `recurrence` e `applies_today`.
  `POST`/`PATCH` aceitam `recurrence`. `GET /routines?status=today` filtra por `applies_today`.
- **Frontend:** seletor "Quando praticar" em `AddRoutineForm.tsx`
  (`Sempre`/`Diária`/`Dias úteis`), campo `recurrence` em `lib/schemas.ts`, e badge
  `🔁 diária` / `🔁 dias úteis` no `RoutineCard.tsx`.

### 7. Dívida de tipos (contida)
`RoutinesPage` estava com 6 erros `tsc` pré-existentes (`routines` como
`NoInfer<TQueryFnData>`). Resolvidos com anotação local `routines as any[]` e tipagem dos
handlers de delete. O arquivo agora fecha **sem erros** de tipo.

### 8. Testes
Novo `frontend/src/lib/dailyRoutine.test.ts` (Vitest) cobrindo `isDailyToday`
(daily/weekdays/desconhecida), `computeStreak`, `completedDateSet` e `last7Days` — 8 casos.

## Verificação
1. `cd backend && npm run db:deploy` (migração `add_routine_recurrence` aplicada) + `npm run db:generate`.
2. `cd frontend && npx vitest run src/lib/dailyRoutine.test.ts` → 8 passam.
3. `npx vite build` → build OK.
4. Manual: em `#/routines`, criar hábito com "Dias úteis"; conferir badge, filtro "Hoje"
   (some no fim de semana), painel "Rotina Diária" com modal/feedback ao concluir.

## Follow-ups possíveis
- Split `useTaskMutations` para o painel não instanciar a query interna de `useTasks`.
- Recorrências por dias específicos (seg/qua/sex) no schema (`days_of_week`).
