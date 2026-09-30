# 19 - Ambiente de Dev

Voltar ao [[0-Painel]].

Setup local, portas e como lidar com o erro `EADDRINUSE`.

## Portas

| Serviço  | Porta | Origem                                  |
|----------|-------|-----------------------------------------|
| Backend  | 3001  | `backend/.env` → `PORT` (padrão 3001)   |
| Frontend | 5175  | `frontend/vite.config.js` (`strictPort`) |

O frontend faz proxy de `/api` → backend. O alvo agora é configurável:
`process.env.API_PROXY_TARGET` ou `http://localhost:${API_PORT || 3001}`
(`frontend/vite.config.js`).

## Subir o projeto

```bash
npm run dev
```

O que acontece:
1. **`predev`** → `dev:clean` roda `scripts/free-port.mjs 3001 5175`, liberando as
   portas de qualquer processo órfão antes de começar.
2. **`concurrently -k`** sobe API e WEB juntos; se um cair, derruba o outro
   (`-k` = kill-others), evitando estado "meio quebrado".
3. **`dev:web`** espera o health da API (`scripts/wait-health.mjs`) antes de subir o
   Vite, evitando erros de proxy enquanto o backend inicializa.

## Scripts utilitários (sem dependências externas)

- `scripts/free-port.mjs <portas...>` — encerra quem escuta as portas
  (Windows/macOS/Linux). Ex.: `node scripts/free-port.mjs 3001 5175`.
- `scripts/wait-health.mjs <url> [timeoutMs]` — aguarda o endpoint responder;
  ao estourar o timeout **não bloqueia** (sai 0).
- `npm run dev:clean` — atalho para liberar 3001 e 5175 manualmente.

## Encerramento gracioso

`backend/src/index.js` trata `SIGINT`/`SIGTERM` chamando `fastify.close()`, o que
**libera a porta na hora** ao dar Ctrl+C — a causa raiz dos processos órfãos que
geravam `EADDRINUSE`.

## Troubleshooting — `EADDRINUSE: address already in use 0.0.0.0:3001`

Significa que já existe algo na porta 3001 (instância anterior órfã).

- Automático: rode `npm run dev` de novo (o `predev` limpa) ou `npm run dev:clean`.
- Manual (PowerShell):
  ```powershell
  Get-NetTCPConnection -LocalPort 3001 -State Listen |
    Select-Object -Expand OwningProcess -Unique |
    ForEach-Object { Stop-Process -Id $_ -Force }
  ```
- Alternativa: subir em outra porta — `PORT=3002 API_PORT=3002 npm run dev`.

O backend agora também loga uma mensagem amigável (em vez do stack trace cru) quando a
porta está ocupada.

## Arquivos

- `package.json` (raiz) — scripts `predev`, `dev`, `dev:web`, `wait:api`, `dev:clean`
- `scripts/free-port.mjs`, `scripts/wait-health.mjs`
- `backend/src/index.js` — `PORT`, shutdown gracioso, mensagem de `EADDRINUSE`
- `frontend/vite.config.js` — proxy `/api` configurável
- `backend/.env` — `PORT`, `CORS_ORIGIN`; `frontend/.env` — `VITE_API_URL`
