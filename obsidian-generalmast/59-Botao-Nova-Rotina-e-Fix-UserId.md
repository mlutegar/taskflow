# 59 - Botão "Nova rotina" + fix `createdBy` vs `userId`

Dois assuntos que vieram juntos: a aba Tarefas ganhou um ponto de entrada para **criar
rotina**, e para isso foi preciso antes corrigir um bug que derrubava todo o fluxo de
conclusão de tarefas.

Relacionado: [[58-Heatmap-Consistencia-Rotinas]] · [[7-Tarefas-Recorrentes]] · [[12-Troubleshooting-DB-Drift]] · [[0-Painel]]

---

## Parte 1 — O bug `createdBy` vs `userId`

### Sintoma

Ao subir o app local, o console do backend enchia de `PrismaClientValidationError` e
vários endpoints devolviam **500**:

```
Invalid `prisma.taskCompletion.count()`  ... Unknown argument `createdBy`
Invalid `prisma.taskChange.create()`     ... Argument `userId` is missing
Invalid `prisma.task.create()`           ... Unique constraint failed on (`id`)  [P2002]
```

Quebravam: `GET /tasks/completed-today-count`, `GET /tasks/:id/history`, `POST /tasks`,
`POST /tasks/:id/complete`, `/undo-complete`, `/reopen` — ou seja, **não dava para criar
nem concluir tarefa nenhuma**.

### Causa raiz

O schema usa nomes de dono **diferentes por model**, e o código usava um só:

| Model | Campo correto | Coluna |
|---|---|---|
| `Task` | `createdBy` | `created_by` |
| `TaskCompletion` | **`userId`** | `user_id` |
| `TaskChange` | **`userId`** | `user_id` |
| `UserPreferences` | **`userId`** | `user_id` |

`backend/src/routes/tasks.js` passava `createdBy` nos quatro. Para `Task` estava certo;
nos outros o Prisma rejeita o argumento.

O `Argument 'userId' is missing` tinha uma segunda origem: `recordTaskChange({ userId })`
(`backend/src/taskSyncInfrastructure.js:38`) recebia `createdBy:` nos **14** call sites →
chegava `undefined`.

O `P2002` era **efeito colateral**: a task era criada, o `recordTaskChange` seguinte
estourava, o cliente fazia retry com o mesmo `client_id` e batia na constraint.

### Correção

Em `backend/src/routes/tasks.js`, `createdBy` → `userId` em **25 pontos**: 11 queries de
`taskCompletion`/`taskChange`, 14 chamadas de `recordTaskChange` e o
`userPreferences.findUnique` dentro de `requestCalendar` (este último estava mascarado —
só roda quando o cliente **não** manda o header `x-timezone`).

As ~36 ocorrências de `createdBy` em `prisma.task.*` ficaram como estavam.
`backend/src/routes/ical.js:15` também é `prisma.task` → não mexer.

### Guard contra regressão

Novo `backend/src/routes/taskOwnerField.test.js` (6 testes), porque os 35 testes
existentes passavam alegremente — nenhum deles exercita o Prisma de verdade:

1. valida contra o **client gerado** (`Prisma.dmmf`) que `Task` tem `createdBy` e que
   `TaskCompletion`/`TaskChange`/`UserPreferences` têm `userId` e **não** `createdBy`;
2. varre o código de `tasks.js` e falha se alguma chamada a esses models — ou a
   `recordTaskChange` — mencionar `createdBy`;
3. exige que toda chamada de `recordTaskChange` passe `userId`.

> **Lição:** teste que não toca o Prisma não protege contra drift schema↔código.
> Ver também [[12-Troubleshooting-DB-Drift]].

---

## Parte 2 — Botão "Nova rotina"

### O problema

Não havia como criar uma rotina pela aba Tarefas. A única forma era abrir "Nova tarefa" e
achar a recorrência escondida em **Mais opções → Repetição** — nada indicava que era
assim que se criava uma rotina. E, se o usuário não tivesse nenhuma rotina, o painel
"Rotina Diária" simplesmente **sumia** (`if (total === 0) return null`), deixando a tela
sem ponto de entrada nenhum.

### Solução

Botão **"+ Nova rotina"** no cabeçalho do card "Rotina Diária", antes de
"Ocultar feitas"/"Foco", com o mesmo `styles.addBtn` dos vizinhos (zero CSS novo).
Clicar abre um `AddTaskForm` **inline** logo abaixo — mesmo padrão do "+ Novo hábito" da
`RoutinesPage`. O botão vira "✕ Cancelar" enquanto o form está aberto.

Rotina **não é entidade nova**: é `Task` com `recurrence: "daily"`, exatamente o que o
painel e o heatmap já consomem. Nenhum endpoint novo.

### Arquivos

| Arquivo | Mudança |
|---|---|
| `components/AddTaskForm.tsx` | props novas `initialRecurrence` / `initialRecurrenceRule`; com recorrência pré-definida, "Mais opções" já abre **expandido** (senão o usuário não vê que está marcada) |
| `components/DailyRoutinePanel.tsx` | prop opcional `onCreateRoutine`; estado `showForm`; botão + form inline; estado vazio em vez de sumir |
| `pages/TasksPage.tsx` | `handleCreateRoutine` (cria a task e anexa as subtarefas staged) passado ao painel |

Detalhes que importam:

- `onCreateRoutine` é **opcional**: sem ela o botão não aparece. É assim que a
  `RoutinesPage`, que reusa o mesmo painel, continua só-leitura.
- Com `total === 0` o painel agora **só some se não souber criar**
  (`if (total === 0 && !onCreateRoutine) return null`); caso contrário mostra
  "Nenhuma rotina ainda — crie a primeira em 'Nova rotina'" com o botão.
- "Ocultar feitas"/"Foco" ficam escondidos quando não há rotina (não fariam nada).
- Form pré-configurado: `initialRecurrence="daily"`, `enableChecklist`,
  `draftKey="dailyRoutine_draft"`, placeholder "Nome da rotina (ex.: Ler 20 páginas)".

---

## Parte 3 — Fix: rotina criada só aparecia após reload

### Sintoma

Criar uma rotina pelo botão novo funcionava (ia pro banco), mas **ela não aparecia** na
lista do painel nem no heatmap. Só depois de recarregar a página.

### Causa raiz

Os painéis da aba Tarefas não leem a lista do `useTasks` — leem uma query própria:

```ts
useQuery({ queryKey: ["tasks", "today-panel-all"], queryFn: () => tasksApi.list({ sort: "due_date_asc" }) })
```

E as mutações invalidavam só `taskKeys.lists()` = `["tasks", "list"]`. Como
`["tasks","today-panel-all"]` **não** é descendente de `["tasks","list"]`, a invalidação
passava longe. Mesma história para o heatmap (`["tasks","routine-consistency"]`), que
ainda tem `staleTime` de 5 min.

> Armadilha de React Query: invalidar por prefixo só pega chaves que **começam** com
> aquele prefixo. Uma view irmã (`tasks/algo` vs `tasks/list/...`) fica órfã em silêncio
> — nada quebra, o dado só fica velho. Ver [[9-Cache-Sync-e-Versionamento]].

### Correção

1. As duas chaves saíram das strings mágicas e viraram parte do contrato em
   `frontend/src/lib/taskKeys.ts`: **`todayPanelAll()`** e **`routineConsistency()`**,
   com comentário explicando que ficam fora de `lists()` e por isso exigem invalidação
   explícita. `TasksPage` e `RoutinesPage` passaram a usá-las.
2. Novo helper `invalidatePanelViews(affectsRoutines)` em `useTasks`, chamado em:
   - `createMutation.onSettled` — a flag vem da recorrência do payload/retorno;
   - `removeTask` / `restoreTask` — consultando o cache para saber se era rotina;
   - `updateMutation.onSettled` — quando `recurrence` está no patch (tarefa comum
     virando rotina, ou o contrário).

O heatmap só é invalidado quando a tarefa é de fato rotina (`daily`/`weekdays`) — criar
uma tarefa comum não dispara refetch do heatmap à toa.

### Guard

`frontend/src/lib/taskSync.test.ts` ganhou um teste que fixa as duas chaves e **afirma
que elas não são descendentes de `lists()`** — se alguém reorganizar as keys sem ajustar
as invalidações, o teste cai em vez de o bug voltar silencioso. (De quebra, o teste
antigo de `taskKeys.list()` estava desatualizado desde que a nota
[[53-Redesign-Filtros-e-Pagina-Tarefa]] acrescentou as dimensões
`assigned_to`/`priorities`/`due_filter`; atualizado também.)

---

## Como testar

```bash
cd backend  && npm test        # 41 testes (35 antigos + 6 do guard)
cd frontend && npx vitest run src/lib/routineConsistency.test.ts src/hooks/useTasks.test.tsx
cd frontend && npm run build
```

Smoke test do fluxo que estava quebrado (com o backend no ar):

| Passo | Antes | Depois |
|---|---|---|
| `GET /tasks/completed-today-count` | 500 | `{"count":0}` |
| `POST /tasks` (recurrence daily) | 500 + P2002 | 201 |
| `POST /tasks/:id/complete` | 500 | 200 |
| `GET /tasks/:id/history` | 500 | 200, 1 registro |
| `GET /tasks/routines/consistency` | 500 | `{expected:2, completed:1}` |
| `POST /tasks/:id/reopen` | 500 | 200 → `completed:0` |

Manual: aba Tarefas → **"+ Nova rotina"** → criar → **aparece na hora** na lista e no
heatmap, sem reload → marcar/desmarcar → a célula de hoje no card "Consistência das
Rotinas" pinta e despinta. Excluir a rotina → some dos dois na hora.

> ⚠️ **Armadilha de ambiente:** `node --watch` reiniciando pode deixar **dois** processos
> na 3001, e aí as requisições caem no zumbi (404 em tudo, inclusive `/health`). Rode
> `npm run dev:clean`. E, no PowerShell, prefira `127.0.0.1` a `localhost` — a resolução
> IPv6 falha contra o Fastify em `0.0.0.0`. Ver [[19-Ambiente-de-Dev]].
