# 63 - Exploração do repositório e CLAUDE.md

Voltar ao [[0-Painel]]. Relacionado: [[2-Modos-e-Tipos]], [[1-Tela-Escolher-Modo]], [[13-Deploy-e-Build]], [[61-Deploy-VPS-KVM8-via-Git]].

Prompt 00 (ver `PROMPTS.md`, 2026-11-11): mapeamento do projeto, **sem alterar código de funcionalidade**.

## Resultado
- `CLAUDE.md` na raiz: stack, scripts, deploy, arquitetura, catálogo dos 94 modos, convenções, **pendências conhecidas** e **backlog**.
- `PROMPTS.md` criado: 00 ✅; 01 Novos modos, 02 Página de Saúde, 03 Página de Finanças ⏳.
- `README.md` reescrito com a stack real (Fastify + Prisma + SQLite + Docker + Litestream; React/Vite).

## Achados
- Catálogo único em `frontend/src/data/modes.ts`; execução em `ModeSession.tsx` via `SESSION_MAP` ([[2-Modos-e-Tipos]]).
- ~30 modos sem entrada em `SESSION_MAP` caem no fallback `SpliteSession`; `uma_coisa_*` e `cantar` têm helper no Daily Focus. Não se sabe se é intencional — **não corrigir sem pedido** (lista em `CLAUDE.md` §7.1).
- `base: "/taskflow/"`: nginx do repo serve em `/taskflow/` e redireciona `/`; o domínio `kflow.mlutegar.com` **não aparece no repo** (só `mlutegar.com` e `taskflow.mrender.com.br`), logo o mapeamento está no Cloudflare Tunnel — a verificar (§7.2).
- Pomodoro adaptativo e priorização semanal/mensal não existem (backlog, §8).

## Limpeza da raiz
Executada após confirmação, em commit separado. Detalhes, destino de cada arquivo e o que foi migrado para as notas 54/55: [[64-Anexos-Daily-Focus]].
