# 4 - Preencher Modo com IA

Voltar ao [[0-Painel]]. Relacionado a [[2-Modos-e-Tipos]] (fonte/estrutura dos modos).

## O que é
No modal **✨ Criar Modo Personalizado** (`frontend/src/components/modes/CreateModeModal.tsx`)
existe o botão **"✨ Preencher com IA"**. O usuário digita ao menos o **nome** ou a **tagline**
e a IA gera o restante dos campos (tagline, passos, pré-requisito, "por que funciona",
"quando usar", dica e emoji).

Importante: a IA **só preenche campos vazios** — nunca sobrescreve o que o usuário já digitou.
O emoji só é trocado se ainda estiver no default (`🚀`).

## Fluxo
`CreateModeModal.handleAiFill` → `api.post("/ai/generate-mode", { ...campos }, 70_000)` →
**backend proxy** → **Orbita**.

### Frontend
- `frontend/src/components/modes/CreateModeModal.tsx` — estados `aiLoading`/`aiError`,
  handler `handleAiFill`, botão em `.aiFillBar` / `.aiFillBtn`.
- `frontend/src/lib/apiClient.ts` — `api.post(path, body, timeoutMs?)` agora aceita timeout
  por chamada (a IA usa ~70s; o padrão continua `API_TIMEOUT_MS` ≈ 9s).
- Estilos: `.aiFillBar`, `.aiFillBtn`, `.aiFillError` em `frontend/src/components/ModesPanel.module.css`.

### Backend (proxy)
- `backend/src/routes/ai.js`, registrado em `backend/src/index.js` com prefixo `/ai`.
- `POST /ai/generate-mode` (autenticado): monta um prompt pedindo **JSON puro** à IA,
  chama `https://orbita.mlutegar.com/api/ask?t=<ORBITA_TOKEN>` (token via env, fallback
  `mlute-7q2x9k`), extrai o bloco JSON da resposta (`extractJson`) e normaliza a saída.
- Erros/timeout → `502` com mensagem amigável exibida no modal.

## Por que proxy no backend
Evita CORS no navegador, esconde o token do Orbita e reaproveita o `authenticate` das rotas.

## Erro "Token inválido ou expirado" (sessão, não Orbita)
Sintoma: o modal mostrava **"Token inválido ou expirado"** ao gerar com IA.
Causa: era o **JWT de login do app** vencido (401 de `backend/src/auth.js`), não o Orbita —
a rota `/ai/generate-mode` exige `authenticate`.

Correção — **refresh reativo** no `frontend/src/lib/apiClient.ts`:
- Em qualquer 401, chama `POST /auth/refresh` (aceita token expirado via `ignoreExpiration`),
  salva o novo `taskflow.authToken` e **repete** a requisição uma vez.
- Single-flight: refreshs concorrentes compartilham a mesma Promise; não faz refresh para a
  própria rota `/auth/refresh`; no máximo 1 retry.
- Se o refresh falhar: limpa a sessão e emite `window` event `taskflow:session-expired`.
- `frontend/src/contexts/AuthContext.tsx` escuta esse evento → `setUser(null)` (volta ao login).
- Conserta o modal de IA **e** todas as chamadas autenticadas do app.
- Testes em `frontend/src/lib/apiClient.test.js` (401→refresh→retry; refresh-falha→signout;
  sem refresh para `/auth/refresh`).

## Endurecimento do refresh (robustez + UX)
- **Não desloga em falha transitória:** `refreshSession()` distingue
  **auth** (401/403 → encerra sessão) de **network** (fetch rejeita / 5xx → mantém a sessão
  e lança "Sem conexão para renovar a sessão. Tente novamente."). Evita logout indevido offline.
- **Refresh unificado + single-flight:** `apiClient.refreshSession()` é a única fonte de
  renovação; o `AuthContext` (refresh proativo) e o refresh reativo compartilham a mesma
  Promise em andamento.
- **Sincronização entre abas:** `BroadcastChannel("taskflow-auth")` propaga token renovado
  (`refreshed`) e sessão expirada (`expired`) para as outras abas; eventos de `window`
  `SESSION_REFRESHED_EVENT` / `SESSION_EXPIRED_EVENT`.
- **Margem por TTL:** `AuthContext.refreshMarginMs()` renova a ~20% da vida do token
  (iat→exp), limitado a [1min, 24h], em vez de fixo em 24h.
- **`user` atualizado no refresh:** o `AuthContext` escuta `SESSION_REFRESHED_EVENT` e faz
  `setUser` com o usuário retornado.
- **Toast de sessão expirada:** `SessionExpiredToast` em `App.tsx` mostra aviso ao usuário.
- **Rate limit no `/auth/refresh`:** `refreshLimiter` (60/15min por IP) em
  `backend/src/routes/auth.js`.
- **Testes novos:** offline-no-refresh (mantém sessão), 5xx transitório, single-flight
  (2×401 → 1 refresh), retry ainda 401 propaga erro. 45/45 no front; limpeza do
  "unhandled rejection" no teste de timeout.

## Melhorias (robustez e UX)
### Backend (`backend/src/routes/ai.js`)
- **Retry de JSON:** se a resposta não for parseável, refaz **1 tentativa** com prompt estrito
  ("responda APENAS o JSON"). Timeout/erro de rede não são re-tentados.
- **Prompt few-shot:** inclui um exemplo do JSON esperado e pede também `category`/`type`
  alinhados a `frontend/src/data/modes.ts` (`CATEGORY_ORDER` + `durante`/`entre`).
- **Rate limit:** 20 req / 5 min por usuário (`@fastify/rate-limit`, padrão de `routines.js`).
- **Validação de schema:** `body` validado pelo Fastify (limites de tamanho por campo).
- **Log:** latência e falhas de parse via `req.log`.
- **`extractJson` exportado** e coberto por testes (`backend/src/routes/ai.test.js`,
  rodar com `npm test` → `node --test`). Trata JSON puro, cercas ```` ```json ````,
  texto ao redor, objeto aninhado e entradas inválidas.
- Token via `ORBITA_TOKEN` (documentado em `.env.example`).
- **`coerceType`:** a IA às vezes devolve `type` livre (ex.: `productivity-mode`, `break`);
  `coerceType` mapeia para o vocabulário do app (`durante`/`entre`) por palavras-chave,
  em vez de descartar. Coberto por testes.

### Frontend (`CreateModeModal.tsx`)
- **Preencher com IA** (só campos vazios) + **🔄 Gerar novamente** (sobrescreve tudo) +
  **↩ Desfazer** (restaura o snapshot anterior).
- **Botão ✨ por campo** (tagline, passos, pré-requisito, por que funciona, quando usar, dica)
  regenera só aquele campo.
- **Progresso rotativo** ("Escrevendo a tagline…") enquanto a IA trabalha (até ~60s).
- `category`/`type` sugeridos pela IA são anexados ao modo salvo (`onSave`).
