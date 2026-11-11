# 74 — Deploy em produção (P05): Saúde + Finanças + estabilização, 6 migrations

Prompt 05. Painel: [[0-Painel]]. Contexto: [[68-Saude-Fase-A-Remedios]] … [[73-Financas-Fase-B-Rendas-e-Projecao]], [[66-Estabilizacao-Testes-Lint-Tsc]] e [[67-Estabilizacao-Tipos-e-Bugs-Achados]].

## Resultado
- **Produção = VPS kvm8** (`2.25.204.56`, `srv1753241`, `/root/taskflow`). Commit `c998308`; versão visível `0.1.0+c998308`.
- Domínio real: **`https://taskflow.mlutegar.com/taskflow/`**. `kflow.mlutegar.com` e `taskflow.mrender.com.br` **não existem no DNS**.
- 6 migrations aplicadas (`20261111…` a `20261116…`): saúde ×4, finanças ×2. `/health` ok; 13 rotas `/saude/*` e `/financas/*` → 401 sem token; litestream voltou a replicar.
- Pré-checagens: lint 0 erros, `typecheck:baseline` 92 (igual), frontend 234/234, backend 138/138, build ok.

## Incidentes (e o que aprendemos)
1. **`deploy-git.ps1` aborta no PS 5.1** na linha do `git push` (saída do git no stderr + `$ErrorActionPreference="Stop"`). O push foi feito; a parte remota foi rodada à mão. Pendência em `CLAUDE.md` §7.3b.
2. **`database is locked` no `prisma migrate deploy`**: o `litestream` (que não é recriado) mantém o SQLite aberto; a API entrou em loop (15 restarts). Resolvido com: backup → `stop` API+litestream → `fuser` vazio → `up` só da API (migrations ok) → nginx → litestream. Procedimento fixo e propostas de correção definitiva em `CLAUDE.md` §2 (não implementadas).
3. **Build local** falhou com `ENOENT dist\sw.mjs` por builds concorrentes (jobs em background); passou rodando um só. `npm test` sem `-- --run` fica em watch.
4. **Servidor errado (susto):** o prompt falava do kvm2, a produção é o kvm8. O deploy no kvm8 estava correto.

## Backup / segurança dos dados
- kvm8: cópia `taskflow.db.bak_pre_p05_20261111_204631` (+`-wal`/`-shm`) no volume e réplica do litestream restaurada em teste (770 048 bytes). O host não tem `sqlite3`.

## Remoção da instância antiga do kvm2 (`179.198.98.180`)
- Banco do kvm2 (schema antigo, 28 migrations) era **subconjunto** do kvm8: mesmo usuário, 0 IDs só no kvm2; última tarefa 2026-10-11 × 2026-11-09.
- Backup local (contém `.env`, não commitar): `C:\Users\mlute\PycharmProjects\backups\taskflow-kvm2-20261111\taskflow_kvm2_20261111.tar.gz` — 16 506 800 bytes, sha256 `13b0426834abc61663854f29d1a85698a3015a32c54582da41cd6f73269a42ba`.
- Removidos só `/root/taskflow` e o volume `taskflow_data`; `docker ps` idêntico antes/depois (67 containers); cloudflared ativo.
- **Manual:** no dashboard Cloudflare, túnel "emme" (`bbf16cfd-8ec6-4cda-9723-5781aa3e6057`), remover Public Hostnames para `localhost:3026/3033`, se existirem. `mlutegar.com/taskflow/` serve um build estático antigo (11/08/2026) de origem não identificada.

## Pendências
- `CORS_ORIGIN` do kvm8 = `https://taskflow.mrender.com.br` (host inexistente); sugerido `https://taskflow.mlutegar.com`. Não alterado.
- Correção definitiva do lock migrate × litestream; correção do `deploy-git.ps1` no PS 5.1.
