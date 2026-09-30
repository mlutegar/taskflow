# 25 - Fix: Loading Infinito no Primeiro Acesso

[[0-Painel]] · relacionado: [[9-Cache-Sync-e-Versionamento]] · [[21-Resiliencia-e-Qualidade]] · [[13-Deploy-e-Build]]

## Sintoma
Ao abrir o app pela **primeira vez** na aba **Tarefas**, a lista ficava presa no
skeleton de carregamento para sempre. Trocar para outra aba (ex. Rotinas) e
voltar resolvia.

## Causa raiz
O skeleton visível é `TaskList loading={tasksLoading}` em `pages/TasksPage.tsx`,
onde `tasksLoading` é o `isLoading` do React Query em `hooks/useTasks.ts`.

No React Query, uma query que **dá erro** vira estado `error` e o skeleton some.
Para ficar preso, a query precisa **nunca resolver nem rejeitar**. Sequência:

1. Entre sessões o **access token JWT expira** (token curto).
2. No primeiro acesso, `GET /tasks` responde **401**.
3. `request()` em `lib/apiClient.ts` chama `refreshSession()` para renovar o token
   e repetir a requisição uma vez.
4. **Defeito:** `refreshSession()` fazia `fetch("/auth/refresh")` **sem
   AbortController/timeout**, ao contrário de `doFetch()` (que aborta em
   `API_TIMEOUT_MS` = 9s, `config/constants.ts`).
5. Com backend "frio"/primeira conexão lenta, esse fetch travava indefinidamente
   → `refreshSession()` nunca resolvia → `request()` nunca resolvia → a `queryFn`
   nunca settlava → `isLoading` ficava `true` **para sempre**.

Trocar de aba desmonta a `TasksPage`, aquece o backend (Rotinas + `useRemoteSync`
disparam outras chamadas) e, ao voltar, uma query **nova** roda com o backend
quente e o token renovado → resolve na hora.

> O service worker (`sw.ts`) usa `NetworkOnly` para `/api/` e não cacheia
> respostas autenticadas — **não** era a causa. A causa era a assimetria de
> timeout entre `refreshSession` e `doFetch`.

## Correção (em camadas)
1. **Principal — `lib/apiClient.ts` (`refreshSession`):** adicionado
   `AbortController` + `setTimeout(TIMEOUT_MS)` ao `fetch("/auth/refresh")`,
   com `finally { clearTimeout }` (paridade com `doFetch`). Se o refresh travar,
   aborta em 9s → cai em `{ status: "network" }` (transitório, não encerra
   sessão) → `request()` rejeita → query vira `error` (branch `Erro:` já existe
   em `TasksPage.tsx`), nunca skeleton eterno.
2. **Blindagem — `lib/queryClient.ts`:** `retry: 1` → `retry: 2` +
   `retryDelay` com backoff exponencial (`min(1000 * 2**n, 8000)`), dando tempo
   do backend aquecer/refresh concluir antes de desistir.
3. **UX — `hooks/useTasks.ts`:** `refetchOnMount: "always"`, tornando
   determinístico o revalidar ao voltar para a aba.

## Verificação
- Forçar 401 (JWT inválido/vencido no `localStorage` → `taskflow.authToken`) e
  recarregar em `#/tasks`: agora carrega em ≤9s ou mostra `Erro:`, nunca trava.
- Simular backend lento (throttling / latência em `/auth/refresh`): skeleton dá
  lugar a dados/erro.
- Regressão: login e navegação entre abas seguem instantâneos; refresh
  401→sucesso continua repetindo a requisição uma vez.

## Melhorias adicionais (hardening)
Além do fix principal, foram implementadas melhorias de resiliência:

1. **`fetchWithTimeout` (fonte única) — `apiClient.ts`:** extraído o padrão
   AbortController+timeout; `doFetch` e `refreshSession` agora usam o mesmo
   helper, evitando que uma futura chamada "esqueça" o timeout (origem do bug).
2. **Single-flight com guarda de token — `apiClient.ts`:** `refreshSession`
   guarda o token em renovação (`refreshInFlightToken`). Se o token do
   localStorage mudar no meio (troca de conta/aba), inicia um refresh novo em
   vez de reusar um irrelevante; o `finally` só limpa o singleton se ainda for
   o mesmo refresh.
3. **Retry por tipo de erro — `queryClient.ts`:** `retry` agora é função —
   erros definitivos (`400/401/403/404/409/422` via `ApiError`) falham na hora;
   só transitórios repetem (até 2×) com backoff. Evita esperar 3×9s em erros
   de negócio.
4. **Botão "Tentar novamente" — `TasksPage.tsx`:** estados de erro e de
   timeout agora têm botão que chama `refetchTasks()` (exposto por `useTasks`);
   o usuário não precisa mais trocar de aba.
5. **Salvaguarda visual de skeleton — `TasksPage.tsx`:** após ~12s carregando,
   troca o skeleton por aviso "está demorando…" + retry.
6. **Warm-up do backend — `apiClient.ts` + `main.tsx`:** `warmUpBackend()`
   dispara `GET /api/health` logo após o login, absorvendo cold start antes das
   queries pesadas (best-effort, ignora erros).
7. **Erros de `useRemoteSync` visíveis — `main.tsx`:** falhas da sincronização
   inicial (antes só `console.warn`) viram toast informativo.

Testes de regressão adicionados em `apiClient.test.js`: refresh travado aborta
em ~9s (não fica pendente) e `warmUpBackend` engole erros.

## Débito conhecido
`npx tsc --noEmit` acusa ~328 erros de tipo **pré-existentes** (App.tsx/TasksPage
com `unknown`/`TaskRecord`). O build usa esbuild (não bloqueia), mas vale um
mutirão futuro e ligar `tsc` no CI para não crescer. Ver [[21-Resiliencia-e-Qualidade]].

## Arquivos tocados
- `frontend/src/lib/apiClient.ts` — timeout no refresh, `fetchWithTimeout`, guarda de token, `warmUpBackend`
- `frontend/src/lib/queryClient.ts` — retry por tipo de erro + backoff
- `frontend/src/hooks/useTasks.ts` — `refetchOnMount: "always"` + expõe `refetchTasks`
- `frontend/src/pages/TasksPage.tsx` — botão de retry + salvaguarda de timeout visual
- `frontend/src/main.tsx` — warm-up pós-login + toast de erros de sync
- `frontend/src/lib/apiClient.test.js` — testes de regressão
