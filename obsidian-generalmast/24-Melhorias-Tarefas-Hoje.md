# 24 - Melhorias no painel "Tarefas de Hoje"

← volta para [[0-Painel]] · base: [[23-Fix-Tarefas-Hoje-Fuso]] · relacionado: [[9-Cache-Sync-e-Versionamento]], [[21-Resiliencia-e-Qualidade]]

Conjunto de melhorias aplicadas depois do fix de fuso ([[23-Fix-Tarefas-Hoje-Fuso]]).

## 1. Backend robusto e limite real (`backend/src/routes/dailyTasks.js`)
- **`parseDay(str)`**: valida o formato `YYYY-MM-DD` e converte para meia-noite
  UTC de forma estável (byte-compatível com os registros antigos — nenhuma
  migração necessária). Datas inválidas retornam `400`.
- **Limite diário de 5 no servidor**: o `POST` agora conta os itens do dia e
  retorna **`409`** com `{ error: "limit" }` quando já há 5. Antes o limite
  existia só no front, então outros fluxos (ex.: painel "Hoje & Atrasadas")
  podiam furar.
- **`PUT /:date/reorder`** (body `{ taskIds: string[] }`): reescreve as posições
  numa transação Prisma única, respeitando a ordem recebida.

## 2. API front (`frontend/src/api/dailyTasks.ts`)
- Novo `reorder(taskIds, date = todayISO())`.
- Continua usando **data LOCAL** (`todayISO`) em tudo (ver [[23-Fix-Tarefas-Hoje-Fuso]]).

## 3. TodayPanel (`frontend/src/components/TodayPanel.tsx`)
- **Rollover automático**: um `setInterval` (60s) + `visibilitychange`/`focus`
  detectam a virada do dia local e recarregam o foco do novo dia — antes só
  atualizava com reload manual.
- **Guard no efeito de limpeza**: `if (tasks.length === 0) return;` evita o flash
  de "nenhuma tarefa" enquanto a query `today-panel-all` ainda está carregando.
- **Drag & drop** para reordenar as tarefas do dia (alça `⠿`), com update
  otimista e persistência via `dailyTasksApi.reorder` (rollback + toast no erro).
- **Toast de limite/erro** ao selecionar (usa `useToast`); trata `409`.
- **Celebração** "🎉 Tudo concluído!" quando todas as tarefas do dia estão feitas.
- `DAILY_LIMIT` passou a ser **exportado** para reuso.

## 4. TasksPage (`frontend/src/pages/TasksPage.tsx`)
- `handleAddFocus` agora dá **feedback** (toast de sucesso / de limite `409` /
  de erro) — antes falhava em silêncio.

## 5. Teste de regressão de fuso (`frontend/src/api/dailyTasks.test.ts`)
- Garante que `load`/`add`/`remove`/`reorder` usam `todayISO()` (LOCAL) e nunca
  o dia UTC de `toISOString()`. Trava o bug de [[23-Fix-Tarefas-Hoje-Fuso]] para
  não regredir. (3 testes, passando.)

## Decisão adiada (não implementado de propósito)
- **Unificar com a aba Daily Focus** (`components/daily-focus/`, SlotBoard):
  existem hoje dois conceitos de "5 tarefas do dia". Fundir as fontes de dados é
  uma mudança arquitetural maior e arriscada; ficou **documentada** aqui como
  próximo passo, sem alterar o comportamento atual para não quebrar o SlotBoard.

## Verificação
- `npx vitest run src/api/dailyTasks.test.ts` → 3 passam.
- `npx vite build` → build OK.
- `node --check backend/src/routes/dailyTasks.js` → OK.
