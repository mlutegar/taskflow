# 45 - Sessão Ativa Sincronizada — Daily Focus (cross-device)

> Voltar ao [[0-Painel]] · Relacionadas: [[34-Card-Persistente-Daily-Focus]] · [[39-Tempo-Modo-Sincronizado-Daily-Focus]] · [[9-Cache-Sync-e-Versionamento]]

## Problema

O usuário logava no **PC**, avançava no Daily Focus (escolhia o nível, rodava o
cronômetro) e, ao abrir no **celular** com a mesma conta, **o progresso do cronômetro
não aparecia**. O nível do dia até voltava (isso já sincronizava via `day-state`), mas a
**sessão em andamento** ficava só no `localStorage` do dispositivo onde começou.

### Causa raiz

Três estados viviam **apenas** no `localStorage`, sem endpoint de backend:

| Estado | Chave localStorage | Arquivo |
|---|---|---|
| Snapshot ao vivo (fase, `running`, `remainingSecs`, `anchorTs`) | `taskflow.dailyFocus.live` | `dailyFocusLive.ts` |
| Payload da sessão (`level`, `tasks`, `currentIdx`, `timerRemaining`, …) | `taskflow_sess_daily_focus` | `useSessionPersist.ts` |
| Acumulador de foco efetivo | `taskflow.modeFocusTimer` | `modeFocusTimer.ts` |

O que **já** sincronizava (`day-state`, sessões concluídas, check-ins, emoções,
achievements) usava o padrão `useRemoteSync` + loaders `loadRemote*`. Faltava um
equivalente para a **sessão ativa**.

## Solução

Espelhar o padrão do `day-state`: novo model Prisma + endpoints + client de API +
loader no `useRemoteSync`, gravando de volta nas mesmas chaves de `localStorage` que a
página e o card já leem no boot.

### Modelo "retomar ao abrir" (não espelhamento em tempo real)

A sessão é reidratada quando o outro dispositivo **abre/loga** (ou num resync manual).
Não há WebSocket — coerente com o `fire-and-forget` + `useRemoteSync` já existentes. O
tempo é recalculado a partir da **âncora temporal** (`anchorTs`) via `liveRemaining()`,
então a hora em que o outro device abre é irrelevante (o cronômetro "continua correndo"
descontando o tempo decorrido em background).

### Backend

- **Model** `DailyFocusActiveSession` (`backend/prisma/schema.prisma`): uma linha por
  usuário (PK `userId` → last-write-wins natural). Campos JSON como texto: `live`,
  `session`, `focusTimer` (+ `date`, `updatedAt`).
- **Migração** `20260929050000_add_daily_focus_active_session`.
- **Rotas** (`backend/src/routes/dailyFocus.js`):
  - `GET /daily-focus/active-session` → devolve `{ date, live, session, focusTimer, updatedAt }` (só se `date == hoje`, senão `null`).
  - `PUT /daily-focus/active-session` → `upsert` por `userId` (LWW).
  - `DELETE /daily-focus/active-session` → encerra (idempotente).

### Frontend

- **Client** `frontend/src/api/dailyFocusActiveSession.ts`: `fetchActiveSession`,
  `upsertActiveSession`, `deleteActiveSession` (fire-and-forget, silencioso em falha).
- **Push** em `dailyFocusLive.ts`: `saveDailyFocusLive()` agenda um push **debounced**
  (~2,5s) via `schedulePushActiveSession()`, empacotando o snapshot live + o payload da
  sessão (`taskflow_sess_daily_focus`) + o `modeFocusTimer`.
- **Delete** em: `endDailyFocusSession()` (encerrar pelo card), conclusão da sessão
  (fase `celebrate`) e `handleReset()` — via `endRemoteActiveSession()` (cancela pushes
  pendentes antes de deletar).
- **Restore** `loadRemoteActiveSession()` (registrado no `LOADERS` de
  `useRemoteSync.ts` e chamado em `visibilitychange`/`online`): busca a sessão remota; se
  for de **hoje**, de fase com timer (`work`/`between`) e com **versão** maior que a
  conhecida, grava nas três chaves e dispara `DAILY_FOCUS_LIVE_EVENT`.
- **Reidratação na página** (`DailyFocusPage.tsx`): ouve `DAILY_FOCUS_LIVE_EVENT`,
  aplica o estado remoto com **dedupe por `anchorTs`** (`lastAppliedAnchorRef`), mostra um
  **toast** ("Retomando sua sessão de outro dispositivo") e detecta **encerramento remoto**
  (snapshot some enquanto a aba mostrava o timer → reseta para `prepare`). Se o sync
  terminar antes do mount, os inicializadores de `useState` já leem o `localStorage`.

## Melhorias v2 (robustez)

### Concorrência otimística por versão (imune a relógio)
Cada `PUT` incrementa um contador `version` no servidor. O cliente envia `baseVersion` (a
última versão que sincronizou). Se não bater, o servidor responde **409** com a versão
vigente; o cliente adota essa base e **re-tenta uma vez** (last-writer-wins com base
fresca). A restauração compara **versões**, não `updatedAt`/`anchorTs` — elimina o risco
de um device com relógio adiantado "ganhar" indevidamente. Base guardada em
`SK.DAILY_FOCUS_ACTIVE_VERSION`.

### Flush + beacon (não perde o último estado)
- Push normal é **debounced** (~2,5s); em transições importantes (play/pause, troca de
  tarefa) a página chama `flushActiveSessionPush()` → envio imediato.
- Ao fechar a aba/app, `beaconActiveSessionNow()` usa `fetch(keepalive)` no `pagehide`
  para o último estado sobreviver ao fechamento.
- Edições locais ainda não confirmadas (`hasPendingLocalWrite()`) têm prioridade: a
  restauração não sobrescreve enquanto há push pendente/in-flight.

### Tombstone + higiene
- `DELETE` marca `endedAt` (tombstone) e bump de versão em vez de apagar — o outro device
  detecta o fim no próximo GET/resync e limpa o estado local. `?hard=1` apaga fisicamente.
- O `GET` de **outro dia** apaga a linha (limpeza), evitando lixo acumulando.
- `PUT` valida **tamanho** do payload (413 acima de 128 KB).

### Resync proativo
Além do login (`useRemoteSync`), a página re-sincroniza em `visibilitychange` (aba volta a
ficar visível) e `online` (reconexão) — cobre o device que já estava aberto quando o outro
avançou/encerrou.

## Verificação

1. Backend: `npx prisma migrate deploy` (migrações `..._add_daily_focus_active_session` e
   `..._active_session_version_tombstone`).
2. PC: iniciar Daily Focus, rodar/pausar → conferir `PUT` com `baseVersion` e resposta `version`.
3. Celular/outra janela (mesma conta): reidrata fase, tarefa e tempo restante (toast) —
   inclusive ao trazer a aba de volta (visibilitychange).
4. Concluir/encerrar num device → o outro reseta ao voltar (tombstone), sem sessão fantasma.
5. Testes: `npx vitest run src/lib/dailyFocusActiveSession.test.ts` (versão/LWW/tombstone/
   pending-write/filtro de dia) — 9 casos.
