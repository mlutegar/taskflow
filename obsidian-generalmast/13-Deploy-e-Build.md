# 13 - Deploy e Build (build dentro do Docker)

Voltar ao [[0-Painel]] · Relacionado: [[9-Cache-Sync-e-Versionamento]]

## Incidente — "Página não encontrada (#/tasks)" ao abrir o app (18/09/2026)

**Sintoma:** ao abrir o app, a primeira tela era **"Página não encontrada — A rota `#/tasks` não existe"** (com botão de redirect).

**Causa raiz:** build **desatualizado** no ar. O código-fonte já estava correto
(`frontend/src/main.tsx` mapeia `#/tasks` → `TasksPage`, e `frontend/src/pages/TasksPage.tsx`
existe), mas o `frontend/dist/` era de 15/09 — anterior à criação da rota `#/tasks`.
Como o app redireciona a raiz para `#/tasks` (`main.tsx`), o build antigo caía na 404.
Agravado pelo **service worker PWA** (`CacheFirst`) + `nginx.conf` **sem cache-control**.

## Como o deploy funciona AGORA (build no Docker)

Antes o `dist/` era compilado à mão no Windows e copiado para o nginx — se esquecesse o
`npm run build`, subia versão velha (foi a causa do incidente). **Isso foi eliminado.**

- `frontend/Dockerfile` agora é **multi-stage**: compila o app **dentro da imagem**
  (`node:20-bookworm` → `npm ci` → `npm run build`) e serve o resultado no `nginx:alpine`.
- Usa **Debian (bookworm), não Alpine** no stage de build: o `vite-plugin-pwa` tem bug no
  hook `buildEnd` sob Alpine/musl. (Confirmado: build multi-stage roda sem erro.)
- **Impossível subir dist antigo** — o build sempre reflete o código atual.

### Passos de deploy
```powershell
./deploy.ps1            # rebuilda + sobe tudo (injeta APP_COMMIT automaticamente)
./deploy.ps1 taskflow   # só o frontend
```
Ou manual:
```bash
export APP_COMMIT=$(git rev-parse --short HEAD)   # PowerShell: $env:APP_COMMIT = (git rev-parse --short HEAD)
docker compose up -d --build taskflow
```
- Serviço frontend: `taskflow` (porta host `127.0.0.1:3026` → 80).
- Serviço backend: `taskflow-api` (deve ficar *healthy* antes do frontend subir).
- `.dockerignore` mantém o contexto enxuto (sem `node_modules`/`dist`/`.git`).

## Versão visível (diagnóstico "build antigo?")

- `vite.config.js` injeta `__APP_VERSION__` = `<versão do package.json>+<commit>`
  (ex.: `0.1.0+07f4463`). Commit vem do env `APP_COMMIT` (build Docker) ou do git local.
- Exposto em `frontend/src/version.ts` (`APP_VERSION`) e logado no console na inicialização
  (`main.tsx`). `formatBuildDate()` já mostrava a data do build no Login/Perfil/Sidebar.

## Roteamento resiliente (defesa em profundidade)

`main.tsx` agora tem `KNOWN_ROUTES` (Set) + `DEFAULT_ROUTE`. Qualquer rota desconhecida
(raiz, ou um build antigo que não conhece a rota inicial) **redireciona** para uma rota que
sempre existe naquele build, em vez de mostrar a 404 na abertura. `DEFAULT_ROUTE` é
obrigatoriamente membro de `KNOWN_ROUTES` → sem risco de loop de redirect.

## Cache (nginx)

`frontend/nginx.conf`:
- `/taskflow/assets/` → `Cache-Control: public, max-age=31536000, immutable` (têm hash no nome).
- `/taskflow/index.html`, `/taskflow/sw.js`, `/taskflow/registerSW.js` → `Cache-Control: no-cache`.

Com `registerType: autoUpdate` do PWA, atualizações futuras passam a ser automáticas.

## CI (GitHub Actions)

`.github/workflows/ci.yml` roda a cada push/PR: `npm ci` → `lint` → `test` → `build`.
Pega erro de build antes de chegar ao deploy manual.

## Bug corrigido de brinde

Botão da tela 404 (`main.tsx`) dizia "Ir para Daily Focus" mas navegava para `/tasks`.
Texto alinhado para **"Ir para Tarefas"**.

## Atualização no VPS via SSH (deploy 18/09/2026) — armadilhas

Deploy do `generalmast` local → `/root/taskflow/` no VPS (Hostinger,
`srv1858777.hstgr.cloud`). Frontend `127.0.0.1:3026`, backend `127.0.0.1:3033`,
exposto pelo Cloudflare Tunnel "emme" (mlutegar.com). Fluxo: `tar` (excluindo
`node_modules`/`.git`/`.env`/etc.) → `scp` → extrair com `--exclude=.env` (preserva
secrets) → `docker compose up -d --build`. Portas mantidas (sem reconfigurar túnel).

**Armadilha 1 — `.js`/`.jsx` obsoletos sombreando o TypeScript.**
Antes o deploy enviava `dist/` pré-compilado, então o fonte no VPS nunca era
compilado lá. Com o build-no-Docker, o VPS passou a compilar o fonte — e havia
**57 `.js` + 93 `.jsx`** antigos (pré-migração TS) em `frontend/src` que a extração
do `tar` nunca removeu. O Vite resolve `.js`/`.jsx` **antes** de `.ts`/`.tsx`, então
esses arquivos velhos venciam e quebravam o build (`SESSION_EXPIRED_EVENT is not
exported`, `Could not resolve version.js`). **Fix:** mover para backup todo `*.js`/`*.jsx`
que tenha irmão `*.ts`/`*.tsx` (backups em `/root/taskflow/_stale_*_backup_*`).
Localmente não existiam (por isso o build local passava).

**Armadilha 2 — banco de produção sem histórico de migração (P3005).**
O `--build` recriou o backend com o CMD `prisma migrate deploy` (fix da nota
[[12-Troubleshooting-DB-Drift]], que nunca fora aplicado em prod). O banco real
`/data/taskflow.db` (volume `taskflow_data`, replicado por Litestream) **não tinha
`_prisma_migrations`** e estava mais atrás do que a nota 12 supôs — faltavam a tabela
`projects` e as colunas novas (`estimated_minutes`, `actual_minutes`,
`default_estimated_minutes`, tabelas `task_changes`/`task_mutation_receipts`).
Resultado: `migrate deploy` batia **P3005** e o api entrava em crash-loop; como o
frontend tem `depends_on: taskflow-api healthy`, **o site caiu**.
**Fix (data-safe):** backup do `.db` → `prisma db push --skip-generate` (aditivo,
aborta se destrutivo; só adicionou objetos) → `prisma migrate resolve --applied` nas
13 migrações → `migrate status` = "up to date" → `docker compose up -d`. Zero perda
de dados; secrets do `.env` intactos.

**Nota:** o api leva ~45s para ficar `healthy` (mais que a espera do `up` numa
recriação). Se o frontend não subir junto, rodar `docker compose up -d` de novo
após o api healthy.

## Verificação
```bash
curl -sI http://127.0.0.1:3026/taskflow/index.html   # Cache-Control: no-cache
curl -sI http://127.0.0.1:3026/taskflow/sw.js        # Cache-Control: no-cache
# APP_VERSION dentro do bundle:
idx=$(curl -s http://127.0.0.1:3026/taskflow/index.html | grep -oE "assets/index-[^\"]+\.js" | head -1)
curl -s "http://127.0.0.1:3026/taskflow/$idx" | grep -oE "0\.1\.0\+[a-z0-9]+" | head -1
```
Abrir `/taskflow/` em aba anônima → deve cair em `#/tasks` (Tarefas), não na 404.
