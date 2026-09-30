# 9 - Cache, Sincronização e Versionamento de Tarefas

Continuação de [[8-Atualizacao-Imediata-de-Tarefas]]. Enquanto a nota 8 corrigiu o
re-render travado, esta nota descreve o endurecimento do fluxo de dados para que
o problema não volte por outros caminhos (cache do navegador, rede lenta ou
edição concorrente).

## Problema
Mesmo com o `TaskCard` re-renderizando, dois riscos permaneciam:
1. **Service Worker** cacheava respostas de `/api/` (`NetworkFirst`, 24h). Com rede
   lenta (>5s) ele servia uma lista antiga e podia misturar dados entre usuários
   no mesmo navegador.
2. As mutações só atualizavam a tela **depois** da resposta do servidor e não
   tinham rollback: se a requisição falhasse, a UI podia ficar inconsistente e
   sem aviso.

## Solução

### 1. Service Worker — `NetworkOnly` para `/api/`
`frontend/src/sw.ts`: a rota de `/api/` passou de `NetworkFirst` para
`NetworkOnly`. Dados autenticados nunca são persistidos pelo SW; o cache de UI é
responsabilidade do React Query (em memória, por usuário/sessão). Assets
estáticos (JS/CSS/fontes) continuam em `CacheFirst`.
No evento `activate`, o SW também apaga o antigo `taskflow-api-cache`, removendo
respostas privadas que possam ter sido gravadas por versões anteriores.

### 2. Updates otimistas com rollback
`frontend/src/hooks/useTasks.ts`: criar, editar e todas as ações de subtarefa
(add/toggle/edit/delete) agora usam `onMutate` (aplica no cache na hora +
snapshot), `onError` (rollback do snapshot + `mutationError`) e `onSettled`
(revalida). A criação insere uma tarefa temporária (`temp-…`) trocada pela real
no `onSuccess`.

### 3. Versão de tarefa (conflito 409)
- `backend/prisma/schema.prisma`: `Task` ganhou `updatedAt` (`@updatedAt`) e
  `version Int @default(0)`. Migração `20260915140000_add_task_updated_at_version`
  (compatível com dados existentes).
- `PATCH /tasks/:id` aceita `version`. Se divergir da armazenada, responde **409**
  com a versão mais recente da tarefa. Cada edição incrementa `version`. Helper
  puro `isVersionConflict` em `backend/src/taskVersion.js` (testado).
- O frontend anexa a `version` em cache ao editar e revalida no `onSettled`
  (recarrega a versão mais nova após um 409).

### 4. Feedback de sincronização
`useTasks` expõe `syncState` (`saving`, `saved`, `offline`, `error`),
`mutationError` e `retryLastMutation`. A tela mostra "Salvando…", "✓ Salvo" e
um botão **Tentar novamente** quando uma operação sofre rollback. Offline não
promete persistência inexistente: informa que a alteração precisa ser repetida.

### 5. Chaves e tipos canônicos
- `frontend/src/lib/taskKeys.ts` concentra as chaves do React Query e separa
  filtro, ordenação e projeto.
- `frontend/src/types/tasks.ts` é o contrato único de tarefa/checklist usado pela
  API e pelo hook. `types/index.ts` reexporta esse contrato para os componentes
  legados.

### 6. Sincronização entre abas e dispositivos
- `frontend/src/lib/taskSync.ts`: `BroadcastChannel("taskflow-tasks")`, com
  fallback pelo evento `storage`, invalida imediatamente as listas nas outras abas.
- Outro dispositivo converge automaticamente por refetch a cada 20 segundos e
  imediatamente quando a janela recupera foco. O polling pausa em background.

### 7. Concorrência realmente atômica
O PATCH agora grava com o predicado `id + userId + version`. Se duas requisições
partirem da mesma versão, apenas uma atualiza a linha; a outra recebe 409. Alterações
de checklist também incrementam `version/updatedAt` em transação e validam que o
item pertence à tarefa do usuário.

### 8. Guard contra reversão por leitura stale (read-after-write)
Sintoma relatado em produção: ao mudar a data de uma tarefa pelo painel
**"Hoje & Atrasadas"**, a mudança só aparecia após **recarregar** a página (o
backend salvava corretamente). Causa: após um save, **três** leituras reescrevem
o cache — o refetch do `onSettled`, o **eco via SSE** (`tasksApi.get` no
handler de `subscribeRemoteTaskEvents`) e o **polling de 20s**. Se qualquer uma
chegasse com dado desatualizado (corrida read-after-write, comum sob carga),
sobrescrevia o valor recém-salvo e ele ficava revertido até um reload "sortudo".

Correção (`frontend/src/hooks/useTasks.ts`): como `version` é monotonicamente
incremental por tarefa, foi criado o helper puro **`keepNewer(existing, incoming)`**
que descarta a escrita quando `incoming.version < existing.version`. Aplicado em:
- **`queryFn`** da lista: mescla o resultado do fetch com o cache anterior por
  versão (um refetch/polling antigo não reverte a tarefa já atualizada).
- **handler SSE** (`setQueriesData` das listas): o eco do próprio save só é
  aplicado se for mais novo.
- **`updateCache`** (`onSuccess` das mutations): a resposta autoritativa do
  servidor (`V+1`) grava e, a partir daí, nenhuma leitura `< V+1` reverte.

O `onMutate` otimista não altera `version`, mas isso é seguro: o `onSuccess`
sempre grava a versão autoritativa no fim, então o estado final converge para o
valor salvo e **permanece**. Ver também [[8-Atualizacao-Imediata-de-Tarefas]].

### 9. Endurecimento contra corridas e ruído de sincronização
Melhorias aplicadas em cima do guard da seção 8, para fechar de vez a classe de
bugs de "edição some/reverte" e reduzir tráfego:

1. **Serialização por `taskId`** (`runSerialUpdate` em `useTasks.ts`): updates da
   mesma tarefa entram numa fila. Antes, duas edições rápidas enviavam a mesma
   `version` antiga e a 2ª tomava **409** (a mudança se perdia). Agora a 2ª só
   parte após o `onSuccess` da 1ª, já com a versão nova.
2. **Guard in-flight** (`inFlightTaskIds`): enquanto o update de uma tarefa está
   em voo, o `queryFn` (refetch/polling) e o handler SSE **não** sobrescrevem o
   valor otimista dela — só o `onSuccess` autoritativo escreve. Fecha a janela
   curta em que uma leitura stale revertia o otimista antes da confirmação.
3. **Invalidação seletiva** (`affectsListShape`): o `onSettled` do update só
   revalida a lista quando o campo pode mudar filtro/ordenação (`due_date`,
   `priority`, `completed`, `recurrence`, `project_id`). Edições de texto e as
   mutations de checklist deixaram de disparar refetch da lista inteira.
4. **SSE com payload da tarefa** (`taskSyncInfrastructure.js` + `taskEventStream.ts`):
   o evento `task-changed` agora carrega o objeto da tarefa (quando a ação é de
   nível de tarefa). O cliente usa direto e **evita o GET extra** por evento e a
   corrida read-after-write. Ações de checklist continuam caindo para o GET.
5. **Polling dinâmico** (`sseConnected`): com o stream SSE conectado, o
   `refetchInterval` sobe para 60s (economiza rede/bateria no PWA); cai para 15s
   como fallback quando o stream cai. O status vem de um callback `onStatus` novo
   em `subscribeRemoteTaskEvents`.
6. **nginx SSE** (`frontend/nginx.conf`): `proxy_buffering off`, `proxy_cache off`,
   `proxy_read_timeout 3600s` e `Connection ''` na `location /api/` — reforço
   contra proxies intermediários (o backend já manda `X-Accel-Buffering: no`).

Também alinhados os tipos id-based em `TaskList.tsx`/`TaskCard.tsx` (ids são
`string`, não `number | string`) e corrigido `globals.d.ts` (os `declare const`
de build precisavam ficar dentro de `declare global`). Obs.: o `tsc --noEmit` do
projeto tem centenas de erros pré-existentes em arquivos não relacionados — o
build é via Vite/esbuild; deixar o `tsc` limpo é um esforço à parte.

**Testes:** `useTasks.test.tsx` ganhou regressão do `keepNewer` (refetch com
versão antiga não reverte). Suíte frontend 80/80; backend sync 3/3 e rotas 13/13.

## Arquivos
- `frontend/src/sw.ts`
- `frontend/src/hooks/useTasks.ts` + `useTasks.test.tsx`
- `frontend/src/lib/taskKeys.ts`, `taskSync.ts` + `taskSync.test.ts`
- `frontend/src/types/tasks.ts`, `types/index.ts`, `api/tasks.ts`
- `frontend/src/pages/TasksPage.tsx`, `App.module.css`
- `backend/prisma/schema.prisma` + migração `20260915140000_add_task_updated_at_version`
- `backend/src/routes/tasks.js` (`shapeTask`, PATCH), `backend/src/taskVersion.js` + teste

## Testes
- Frontend (`useTasks.test.tsx`): criação otimista, rollback de criação/edição,
  envio da versão, rollback de toggle, nova tentativa, fluxo add/edit/delete de
  subtarefa e isolamento por filtro/ordenação/projeto.
- Frontend (`taskSync.test.ts`): chaves e notificação entre abas via storage.
- Backend (`tasks.test.js`): `isVersionConflict` (sem versão, iguais, defasada).
