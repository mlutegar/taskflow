# 35 - Painel "Rotina Diária" também na página Rotinas

> Ver também: [[0-Painel]] · [[7-Tarefas-Recorrentes]] · [[20-Modal-Detalhes-na-Rotina]]

## Motivação
Havia **duas features com nomes parecidos** e isso confundia:

1. **Página "Rotinas"** (`#/routines` → `frontend/src/pages/RoutinesPage.tsx`) — é um
   *rastreador de hábitos* (objetos `Routine` com checklist/meta de progresso; backend
   `backend/src/routes/routines.js`). Badge do cabeçalho: `Rotinas N/M`.
2. **Painel "🔁 Rotina Diária"** (`frontend/src/components/DailyRoutinePanel.tsx`) — ficava
   **só** na página **Tarefas** (`#/tasks`). Lista *tarefas* cujo `recurrence` é
   `daily`/`weekdays` válidas para hoje, com o badge `N/M` (ex.: `0/5`).

O item de nav **"Rotinas"** (`navItems.tsx`) aponta para `#/routines`. Ao clicar em
"Rotinas" (ou abrir `?filter=today#/routines`), o usuário caía no rastreador de hábitos e
**não via** as tarefas da "Rotina Diária" — que só existiam em `#/tasks`.

Objetivo: fazer o painel **"🔁 Rotina Diária"** aparecer também no topo da página
`#/routines`, reaproveitando o componente existente (zero duplicação de lógica).

## Implementação
Arquivo alterado: **`frontend/src/pages/RoutinesPage.tsx`**.

- Novos imports: `useQuery` (`@tanstack/react-query`), `tasksApi` (`../api/tasks`),
  `useTasks` (`../hooks/useTasks`), `DailyRoutinePanel` e `ErrorBoundary`.
- Query com **todas** as tarefas (sem filtro) — igual à da página de Tarefas — para o
  painel decidir o que é "de hoje" via `isDailyToday` (`lib/dailyRoutine.ts`):
  ```ts
  const { data: allTasksForToday = [] } = useQuery({
    queryKey: ["tasks", "today-panel-all"],
    queryFn: () => tasksApi.list({ sort: "due_date_asc" }),
    staleTime: 30_000,
  });
  ```
- Mutações de concluir/reabrir/checklist vindas de `useTasks("today", ...)`:
  `handleCompleteTask`, `handleReopenTask`, `handleToggleTaskChecklist`, `completingIds`.
- Render no topo do `<main>`, **antes** de `RoutineTemplates`, dentro de um
  `ErrorBoundary` (padrão de resiliência por painel, ver [[21-Resiliencia-e-Qualidade]]):
  ```tsx
  <ErrorBoundary compact label="painel Rotina Diária">
    <DailyRoutinePanel
      tasks={allTasksForToday}
      onComplete={(id) => handleCompleteTask(id)}
      onReopen={handleReopenTask}
      onToggleChecklist={handleToggleTaskChecklist}
      completingIds={completingIds}
    />
  </ErrorBoundary>
  ```

## Decisões de escopo
- **`onOpenDetail` omitido** nesta versão: o `TaskDetailModal` (ver
  [[20-Modal-Detalhes-na-Rotina]]) é gerido pela página de Tarefas. Aqui, concluir/reabrir
  e o checklist inline funcionam; clicar no título apenas não abre o modal. Portar o modal
  completo fica como follow-up.
- **Auto-ocultação:** `DailyRoutinePanel` retorna `null` quando não há tarefa diária hoje
  (`if (total === 0) return null`), então a página Rotinas não fica poluída quando não há
  rotina diária.
- **`?filter=today`** não precisou de tratamento extra: `isDailyToday` já restringe as
  tarefas ao dia; o hook usa filtro `"today"` para alinhar com a página de Tarefas.
- Sem mudança de backend.

## Verificação manual
1. `cd frontend && npm run dev` e abrir `#/routines`.
2. Ter ao menos 1 tarefa com `recurrence = daily`/`weekdays` (criar em `#/tasks` se preciso).
3. Conferir que o painel "🔁 Rotina Diária N/M" aparece no topo de `#/routines`, lista as
   tarefas do dia, e que concluir/reabrir atualiza o contador.
4. Sem tarefas diárias → painel some (não quebra a página).
5. `npx tsc --noEmit` não introduz novos erros no arquivo (a base do projeto já tinha
   erros de tipo pré-existentes, não relacionados).
