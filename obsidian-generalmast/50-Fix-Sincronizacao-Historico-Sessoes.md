# 50 - Fix: Sincronização do Histórico de Sessões

> Voltar ao [[0-Painel]]

## Sintoma
Na tela **Histórico → Sessões** aparecia um buraco de ~1 mês (ex.: 30/ago → 29/set):
sessões concluídas nesse período simplesmente "não salvavam".

## Causa-raiz
O salvamento era **fire-and-forget sem retry**:

- Ao concluir uma sessão, `completeSession` chama `addSession()`
  (`frontend/src/components/daily-focus/DailyFocusPage.tsx`).
- `addSession` gravava no `localStorage` e disparava `saveSession()` ao backend com
  `catch` silencioso (`frontend/src/api/dailyFocusSessions.ts`).
- Se a requisição falhasse (offline, token expirado, servidor fora, PWA em background),
  **a sessão nunca era reenviada** — ficava só naquele navegador. Ao trocar de
  dispositivo, limpar dados ou reinstalar o PWA, essas sessões sumiam.

O backend **não** expira sessões (`GET /daily-focus/sessions` retorna tudo, sem cutoff;
Supabase sem TTL). Logo, o problema era 100% de sincronização no cliente.

Agravante secundário: `fetchSessions()` buscava só a **1ª página (máx. 50)**, mascarando
histórico antigo além disso.

## Solução (outbox + retry + carga paginada)
- **Flag `synced`** em cada `HistoryEntry` (`frontend/src/lib/dailyFocusHistory.ts`).
  `addSession` grava `synced:false`; ao confirmar no backend, `markSynced()` marca `true`.
- **`flushUnsyncedSessions()`**: reenvia todas as entradas `synced !== true`. Chamada:
  - no boot, **antes** de `loadRemoteSessions` (`frontend/src/hooks/useRemoteSync.ts`);
  - ao voltar a ficar online (`window.addEventListener("online", ...)`).
- **`saveSession()` agora retorna `boolean`** (sucesso/erro) para o chamador decidir se
  marca como sincronizada.
- **`fetchSessions()` pagina** até esgotar `pagination.totalPages` (limit 200), trazendo
  todo o histórico — não só as 50 mais recentes.
- `loadRemoteSessions` marca as entradas vindas do backend como `synced:true`.
- `MAX_ENTRIES` do cache local subiu para **1000** (cache write-through; fonte de verdade
  é o backend).
- **Feedback visual 🔄** na aba Sessões para entradas ainda não sincronizadas
  (`frontend/src/components/history/HistoryPage.tsx`), reaproveitando o padrão `_local` já
  usado na aba Modos.

## Arquivos
- `frontend/src/api/dailyFocusSessions.ts` — `saveSession` com retorno; `fetchSessions` paginado.
- `frontend/src/lib/dailyFocusHistory.ts` — outbox (`synced`, `markSynced`, `flushUnsyncedSessions`), dedupe por `entryKey`.
- `frontend/src/hooks/useRemoteSync.ts` — flush no boot + listener `online`.
- `frontend/src/components/history/HistoryPage.tsx` — indicador 🔄 na aba Sessões.
- `backend/src/routes/dailyFocus.js` — sem mudanças (já persiste tudo).

## v2 — Robustez (idempotência, backoff, concorrência, UX)
Evolução do fix inicial, endereçando o risco de **duplicatas** que o próprio retry poderia
gerar e tornando a fila mais resiliente:

- **Idempotência (clientId + upsert).** Cada sessão ganha um `clientId` (UUID) no cliente
  (`genClientId` em `dailyFocusHistory.ts`). O backend faz **upsert por `userId+clientId`**
  (`backend/src/routes/dailyFocus.js`), então reenvio/offline/multi-dispositivo nunca cria
  duplicata. Schema: `clientId String? @@unique([userId, clientId])` + migração
  `20260930000000_daily_focus_session_client_id` (índice único; NULLs distintos no SQLite →
  registros antigos não colidem). `GET /sessions` passa a devolver `clientId`.
- **Backoff exponencial + tipo de erro.** `saveSession` retorna `{ ok, permanent }`:
  4xx de validação = **permanente** (marca `failedPermanent`, para de tentar); rede/5xx/
  408/429 = **transitório** (agenda `nextRetryAt` com backoff 30s→1h, `retryCount`).
- **Guard de concorrência.** `flushUnsyncedSessions` tem flag `flushing` — boot, `online`,
  `visibilitychange` e o intervalo periódico podem coexistir sem reprocessar a mesma entrada.
- **Gatilhos extras de flush** (`useRemoteSync.ts`): além de boot e `online`, agora também
  `visibilitychange` (voltar o foco) e **a cada 5 min** com a aba aberta.
- **Reconciliação no load.** `loadRemoteSessions` marca como `synced` entradas locais
  pendentes que já existem no backend (dedupe por `clientId`) — cobre o caso de POST cuja
  resposta se perdeu.
- **UX de diagnóstico.** Banner "🔄 N sessões aguardando sincronização" + botão
  **"Tentar agora"** (`retrySessionsNow`, ignora backoff e falhas permanentes) na aba
  Sessões (`HistoryPage.tsx`). `getPendingCount()` é a fonte de verdade.
- **Ordenação correta.** O merge remoto+local na `HistoryPage` agora ordena por data real
  (`parsePtBR`), não por string `DD/MM/YYYY` (que embaralhava meses).
- **Testes.** `frontend/src/lib/dailyFocusHistory.test.ts` (9 casos): synced no sucesso,
  pendente+backoff no transitório, `failedPermanent` no 4xx, flush marca synced, respeita
  backoff, `retrySessionsNow` força, guard de concorrência, reconciliação e não-duplicação.

## Como testar
1. **Offline→online:** desligar rede, concluir sessão → aparece com 🔄; religar rede
   (ou disparar evento `online`) → 🔄 some e `GET /daily-focus/sessions` passa a retorná-la.
2. **Troca de dispositivo:** após sync, abrir em outro navegador/limpar localStorage →
   `loadRemoteSessions` traz todo o histórico (inclusive >50, via paginação).
3. **Falha transitória:** simular 401/500 em `saveSession` → entrada segue `synced:false`
   e é reenviada no próximo boot/`online`.
4. `cd frontend && npm run build` (OK).
