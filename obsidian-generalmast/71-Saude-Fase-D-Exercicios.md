# 71 — Saúde, Fase D: Exercícios (fecha o prompt 02)

Voltar ao [[0-Painel]] · anterior: [[70-Saude-Fase-C-Alimentacao-e-Reposicao]] · visão geral: [[68-Saude-Fase-A-Remedios]], [[69-Saude-Fase-B-Skincare-e-Compras]]

## Aba "Treino"
- **Hoje:** treinos **planejados para o dia da semana** com botão **Fiz**: abre o registro já preenchido com tipo e duração do plano (editáveis antes de salvar) e grava com `planId`. O item vira "feito"; apagar o treino registrado o devolve a pendente. O mesmo item do plano não duplica no mesmo dia (409). Abaixo, os treinos registrados hoje (editar/excluir) e "Registrar treino" avulso.
- **Histórico:** navegação por **semana** (segunda a domingo; não passa da semana atual), com resumo (nº de treinos e tempo total), os 7 dias, o que estava planejado em cada um (`plano: …`) e um "+" por dia para registrar/corrigir dias passados.
- **Plano:** treinos por dia da semana (segunda a domingo), com tipo e duração prevista opcional; adicionar, editar (inclusive mudar o dia) e remover. Remover do plano **não** apaga treinos já feitos (`planId` é referência leve, sem FK).
- Tipo é texto livre com sugestões (Musculação, Corrida, …); duração em minutos inteiros (1–1440); observações até 1000 caracteres.

## API (`/saude/workouts`, JWT em tudo, zod, tudo por `userId`)
`GET /?from&to` (treinos + resumo), `POST /`, `PATCH/DELETE /:id`, `GET /today?date=` (planejados com `done` + treinos do dia), `GET/POST /plan`, `PATCH/DELETE /plan/:id`. `planId` precisa ser do próprio usuário (400 caso contrário). Lógica pura em `src/health/workouts.js`.

## Migration
`20261114000000_saude_exercicios` — aditiva (2 `CREATE TABLE` + índices). Deploy como nas fases anteriores (`./deploy-git.ps1`; `prisma migrate deploy` no start; Litestream replica via WAL).

## Testes
Backend: `health/workouts.test.js` (planejados do dia, feito por `planId`, resumo, validação) e `routes/saude/workouts.test.js` (401, validação, CRUD e resumo por período, plano + "Fiz" + duplicidade 409 + desfazer, apagar plano preserva treinos, `planId` de outro usuário, isolamento). Frontend: `lib/weekUtils.test.ts` (semana começa na segunda, virada de ano, duração).

## Fechamento do P02
Resumo das 4 fases e pendências restantes em [[0-Painel]] e no `CLAUDE.md` §7.5.
