# 12 - Troubleshooting: Drift do Banco (`updated_at does not exist`)

Voltar ao [[0-Painel]].

## Sintoma
```
Invalid `prisma.task.updateMany()` invocation:
The column `updated_at` does not exist in the current database.
```
Ocorre em rotas de tarefas — ver [[8-Atualizacao-Imediata-de-Tarefas]] e
[[9-Cache-Sync-e-Versionamento]] (as colunas `updated_at`/`version` sustentam o
versionamento otimista / 409). Chamadas em `backend/src/routes/tasks.js`.

## Causa raiz
**Drift de banco + histórico de migrations quebrado.**

1. O `schema.prisma` define `updatedAt @map("updated_at")` e `version`, mas o
   `dev.db` (e possivelmente prod) foi criado via `prisma db push` — que **não
   tem histórico** e não foi re-executado após a mudança de schema.
2. Pior: a pasta `prisma/migrations/` **não reproduzia** o schema. A migration
   `20260731000000_init` era um no-op ("tabelas já existem no Supabase") e a
   tabela `users` nunca era criada por migration nenhuma. Ou seja, `migrate
   deploy` num banco novo geraria um schema **errado**.

## Correção aplicada (definitiva)

### 1. Squash das migrations num baseline limpo
As 10 migrations históricas foram substituídas por **uma** baseline gerada do
schema atual, que reproduz o banco inteiro (18 tabelas, incluindo `users`):
```bash
npx prisma migrate diff --from-empty --to-schema-datamodel prisma/schema.prisma --script \
  > prisma/migrations/00000000000000_baseline/migration.sql
```
Validação: `npm run db:drift-check` → **No difference detected**.

### 2. Marcar a baseline como aplicada em bancos EXISTENTES
Bancos que já têm o schema (via `db push`) não devem re-executar a baseline:
```bash
npx prisma migrate resolve --applied 00000000000000_baseline
npx prisma migrate status   # -> "Database schema is up to date!"
```

### 3. Fim do `db push` — tudo via `migrate deploy`
- `Dockerfile` `CMD`: `npx prisma migrate deploy && node src/index.js`
- `package.json`: `dev` e `start` rodam `prisma migrate deploy` antes de subir.
- Bancos **novos** são construídos corretamente pela baseline; bancos
  **existentes** ficam no-op.

### 4. Handler de erro amigável
`src/index.js` detecta `P2022`/`P2021` (coluna/tabela inexistente) e responde
"Banco desatualizado — rode prisma migrate deploy", em vez de erro cru.

### 5. Guard de drift no CI
`.github/workflows/backend-migrations.yml` roda `npm run db:drift-check`
(`migrate diff ... --exit-code`) em PRs que tocam `backend/prisma/**`. Falha se
o schema mudar sem uma migration correspondente — pega a causa raiz antes do
deploy. Não precisa de banco vivo.

## ⚠️ Produção — passo manual obrigatório (uma vez)
O banco de produção (`/data/taskflow.db` via Litestream, e/ou Supabase) foi feito
com `db push` e **não tem `_prisma_migrations`**. Antes do primeiro deploy com
`migrate deploy`, marcar a baseline como aplicada **naquele** banco, senão o
deploy tentará recriar tabelas existentes e falhará:
```bash
# dentro do container / com DATABASE_URL de produção apontado:
npx prisma migrate resolve --applied 00000000000000_baseline
npx prisma migrate status   # confirmar "up to date"
```
Depois disso, `docker compose up -d --build backend` passa a aplicar migrations
futuras automaticamente e com segurança.

### ✅ Feito em prod em 18/09/2026 — com ressalva
Ao aplicar de fato, o banco de prod estava **mais atrás** do que o assumido acima:
não tinha só o `_prisma_migrations` faltando — faltavam também a tabela `projects` e
as colunas/tabelas novas (`estimated_minutes`, `actual_minutes`,
`default_estimated_minutes`, `task_changes`, `task_mutation_receipts`). Então
`resolve --applied 00000000000000_baseline` sozinho **não** bastaria (a migração
`ALTER TABLE projects` falharia). Procedimento realmente usado (data-safe):
```bash
# backup primeiro:
docker run --rm -v taskflow_data:/data alpine cp -p /data/taskflow.db /data/taskflow.db.bak_$(date +%Y%m%d_%H%M%S)
docker compose run --rm --no-deps --entrypoint "" taskflow-api sh -c "npx prisma db push --skip-generate"   # aditivo, aborta se destrutivo
# marcar TODAS as 13 migrations como aplicadas:
docker compose run --rm --no-deps --entrypoint "" taskflow-api sh -c "for m in <lista>; do npx prisma migrate resolve --applied \$m; done"
docker compose run --rm --no-deps --entrypoint "" taskflow-api sh -c "npx prisma migrate status"   # -> up to date
```
Ver detalhes em [[13-Deploy-e-Build]] (Armadilha 2).

## Fluxo dali em diante
- Mudou o schema? `npm run db:migrate` (gera migration) — nunca mais `db push`.
- Deploy aplica sozinho via `migrate deploy`.
- CI barra schema sem migration.

## Scripts úteis (`backend/package.json`)
| Script | O que faz |
|---|---|
| `npm run db:migrate` | Cria/aplica migration em dev (`migrate dev`) |
| `npm run db:deploy` | Aplica migrations pendentes (`migrate deploy`) |
| `npm run db:status` | Estado das migrations vs banco |
| `npm run db:drift-check` | Falha se schema divergir das migrations |
