# 68 — Saúde, Fase A: navegação "Mais" + Remédios (prompt 02)

Voltar ao [[0-Painel]] · anterior: [[67-Estabilizacao-Tipos-e-Bugs-Achados]]

Primeira fase da página **Saúde** (`#/saude`). Fases seguintes: B Skincare + compras, C Alimentação, D Exercícios (uma nota nova por fase).

## Navegação
- Bottom nav mobile: Tarefas · Hábitos · Foco · **Mais**. O "Mais" abre um **bottom sheet** em grade com **todos** os itens de `NAV_ITEMS` (nada que estava no drawer sumiu). Finanças (prompt 03) entra com 1 linha em `navItems.tsx`.
- Desktop: Saúde na sidebar. Rota `#/saude` em `main.tsx` (lazy).
- Badge de pendências no "Mais": adiado (opcional).

## Backend (`/saude/medications`, JWT em todas as rotas, tudo filtrado por `userId`)
- Models: `Medication`, `MedicationSchedule` (`doseQty`, `active`), `MedicationIntake` (snapshot `scheduledTime` + `doseQty`). Datas `YYYY-MM-DD` e horas `HH:MM` como string (evita bug de fuso); validação zod em todas as rotas.
- **Histórico preservado:** horário removido = `active=false` (intakes antigos intactos; FK do intake é `SetNull`); remédio "removido" = **arquivado** (`active=false`); `DELETE` só com `?confirm=true` e apaga o histórico.
- **Estoque:** "tomei" copia `doseQty` do horário para o intake e baixa; `taken→skipped`/desmarcar devolve **o `doseQty` do intake** (não o atual do horário); nunca negativo (limite: se a baixa foi truncada em 0, a devolução devolve a dose cheia — caso raro aceito).
- Frequências: `daily`, `weekdays`, `custom_days`, `every_n_days` (âncora = `startDate`). Lógica pura em `src/health/{schedule,stock,validation}.js`; `appliesToday` de Hábitos foi extraído para `src/recurrenceDays.js` (routines.js passou a importar de lá).
- Rotas: `GET/POST /`, `PATCH/DELETE /:id`, `GET /today?date=`, `PUT /intakes`, `GET /history?from&to`.

## Frontend
`pages/HealthPage.tsx`, `components/health/*` (Today/List/Form/History/StockBadge), `api/saude.ts`, `hooks/useMedications.ts`, `lib/healthKeys.ts`. Check "tomei / não tomei" com update otimista + rollback. Seções Pele/Comida/Treino aparecem como "chega na fase X".

## Lembretes
Locais, **best-effort** (timers + Notification API, só com o app aberto; opt-in no botão "Lembretes"). Web Push real = pendência (ver CLAUDE.md §7.5).

## Migration / deploy no VPS
`20261111000000_saude_medicamentos` é **aditiva** (3 `CREATE TABLE` + índices; nenhuma tabela existente é tocada). Aplicada por `prisma migrate deploy` no start do container; Litestream replica as tabelas novas via WAL.
1. Backup opcional: `ssh kvm8` → copiar o `.db` de `/data` (ou `litestream snapshots`).
2. `./deploy-git.ps1` (push → pull → rebuild → health).
3. `docker compose logs taskflow-api | grep -i migration` deve mostrar a migration aplicada; `GET /health` ok.
4. Rollback: reverter o código basta (tabelas novas ficam sem uso).

## Testes
Backend: `src/health/health.test.js` (frequência incl. `every_n_days`, estoque, validação) e `src/routes/saude/medications.test.js` (SQLite temporário + migrations reais: 401, isolamento entre usuários, estoque, histórico preservado, DELETE com confirmação). Frontend: `lib/medicationReminders.test.ts`.
