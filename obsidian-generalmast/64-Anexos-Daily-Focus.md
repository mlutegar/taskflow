# 64 - Anexos do Daily Focus (docs que estavam na raiz)

Voltar ao [[0-Painel]]. Notas principais: [[54-Checklist-no-Daily-Focus]] e [[55-Cronometro-Persistente-Daily-Focus]]. Limpeza da raiz: [[63-Exploracao-e-CLAUDE-md]].

Documentos movidos da raiz do repositório para a pasta `64-Anexos-Daily-Focus/` (conteúdo original preservado, sem edição).

## Checklist no Daily Focus ([[54-Checklist-no-Daily-Focus]])
- [[MELHORIAS_CHECKLIST_DAILY_FOCUS]] — 17 melhorias propostas, com código de exemplo (9 já implementadas; 6 pendentes listadas na nota 54).

## Cronômetro persistente ([[55-Cronometro-Persistente-Daily-Focus]])
- [[MELHORIAS_CRONOMETRO_PERSISTENTE]] — sugestões de fase 2 (performance, UX, robustez, features avançadas) com código.
- [[TESTE_CRONOMETRO_PERSISTENTE]] — guia de testes manuais (10 cenários).

## Cards de sincronização do Daily Focus (legado)
- `daily_focus_sync_tasks.md` e `daily_focus_sync_cards.csv` — cards/prompts da sincronização de sessões do Daily Focus (escritos quando o backend era Supabase; hoje a sincronização usa Fastify + Prisma, ver [[45-Sessao-Ativa-Sincronizada-Daily-Focus]]). Nenhum script ou import do projeto os usa.

## Removidos (conteúdo já coberto pelas notas 54/55; histórico no git)
`CHECKLIST_IMPLEMENTATION.md`, `IMPLEMENTACAO_COMPLETA_CHECKLIST.md` (→ 54), `IMPLEMENTACAO_CRONOMETRO_PERSISTENTE.md` (→ 55; o que faltava — arquivos, fluxos, compatibilidade, limitações e debug — foi migrado para a seção "Complementos" da nota 55), `taskflow-update.tar.gz`, `taskflow_update_20261012_153902.tar.gz` e a pasta `UsersmlutePycharmProjectsgeneralmastbackend/` (resíduo de `npm install` com caminho errado: só continha `zod`).
