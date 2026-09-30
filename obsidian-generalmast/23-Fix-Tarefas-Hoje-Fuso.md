# 23 - Fix: "Tarefas de Hoje" perdia a tarefa focada no reload (bug de fuso)

← volta para [[0-Painel]] · relacionado: [[7-Tarefas-Recorrentes]], [[3-Modos-Feitos-Hoje]], [[9-Cache-Sync-e-Versionamento]]

## Sintoma
Ao adicionar uma tarefa ao painel **"Tarefas de Hoje"** (foco de até 5 tarefas)
e **recarregar a página**, o painel voltava vazio: `0/5` e
"Nenhuma tarefa para hoje".

## Causa raiz — UTC vs LOCAL
O projeto tem uma convenção **documentada** em `frontend/src/lib/dateUtils.ts`:
> "Todas as funções operam em hora LOCAL (nunca UTC) para evitar bugs de fuso."

Mas a API do painel **violava** isso. `frontend/src/api/dailyTasks.ts` calculava
a data com UTC:
```ts
function todayDate(): string {
  return new Date().toISOString().split("T")[0]; // ← UTC
}
```
enquanto o cache local em `frontend/src/components/TodayPanel.tsx` usa data local:
```ts
function todayKey(): string {
  return `todayTasks_${todayISO()}`; // ← LOCAL (dateUtils)
}
```

**Efeito:** perto da virada do dia (à noite em fusos a oeste de UTC, como o
Brasil), `toISOString()` devolvia uma data diferente de `todayISO()`. A tarefa
era gravada no BD sob uma data-UTC e o `load()` seguinte procurava por outra
data → voltava vazio. Além disso, a chave do `localStorage` (local) nunca batia
com a data usada no BD (UTC), então o cache não servia de fallback.

O backend (`backend/src/routes/dailyTasks.js`) apenas faz
`new Date(req.params.date)` com a string recebida — é consistente desde que o
front sempre mande a mesma data. O bug estava 100% no front.

## Correção
Único arquivo alterado: **`frontend/src/api/dailyTasks.ts`**. Removida a
`todayDate()` UTC; passou a usar a função local reutilizável `todayISO()`:
```ts
import { todayISO } from "../lib/dateUtils";

export const dailyTasksApi = {
  load:   (date = todayISO()) => api.get(`/daily-tasks/${date}`),
  add:    (taskId, date = todayISO()) => api.post(`/daily-tasks/${date}/${taskId}`),
  remove: (taskId, date = todayISO()) => api.delete(`/daily-tasks/${date}/${taskId}`),
};
```
Agora a data enviada ao BD e a chave `todayTasks_<data>` do `localStorage` usam
**a mesma data local**. Sem mudança no backend/schema e sem migração (o foco
diário é efêmero e reseta a cada dia local).

## Cuidado / não confundir
Existe outra área com 5 slots: a aba **Daily Focus** (`components/daily-focus/`,
SlotBoard). Este fix é só do **TodayPanel** ("Tarefas de Hoje", aba Tarefas).

## Verificação
1. `cd frontend && tsc --noEmit` (ou `npm run build`).
2. Adicionar tarefa ao foco → recarregar → deve permanecer `1/5`.
3. DevTools: `GET /daily-tasks/<data>` e a chave `todayTasks_<data>` usam a
   mesma data de hoje.
