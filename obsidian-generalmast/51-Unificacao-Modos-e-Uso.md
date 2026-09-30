# 51 - Unificação de "Modos" e "Uso" (UI + dados)

Voltar ao [[0-Painel]] · Relacionados: [[2-Modos-e-Tipos]], [[41-Metricas-Ricas-e-Robustez-Tempo-Modo]], [[3-Modos-Feitos-Hoje]], [[49-Simplificar-Filtro-Modos-Historico]]

## Problema
O **Histórico** tinha duas abas quase idênticas para o usuário — **🎯 Modos** e **📈 Uso** —
ambas chaveadas por `modeId + data + hora`, com cards parecidos e **o mesmo filtro** de modo.
A diferença era só semântica e invisível:

- **Modos** (`lib/modeLog.ts`) → 1 registro por **conclusão de tarefa** (`logCompletion`);
  alimentava o ranking "mais usados" via `usageStats()`.
- **Uso** (`lib/sessionUsageLog.ts`) → 1 registro por **sessão encerrada** (`logUsage`), com
  dados ricos (funcionou, min. focado, eficiência, sentimento, nota, `tasksCompleted`, …).

`sessionUsageLog` já era um superconjunto de `modeLog` — manter os dois gerava redundância na UI
e **dupla persistência** (localStorage + backend + Supabase) para a mesma informação.

## Solução (A + C)
Consolidar tanto na UI quanto nos dados. `session_usage_logs` passa a ser a **fonte única de
verdade**; `modeLog` (escrita, endpoint, cliente) é removido.

### Dados (C)
- **`lib/sessionUsageLog.ts`**: novo `usageStats(days)` — mesma assinatura do antigo
  (`[{ modeId, count }]` ordenado desc), agora derivado de `getUsageLogs()` somando
  `tasksCompleted` por modo (fallback 1/sessão em registros legados/combos). Preserva o
  significado do ranking "mais usados".
- Removidos: `lib/modeLog.ts`, `api/modeLog.ts`, `backend/src/routes/modeLog.js` e o registro
  `/mode-log` em `backend/src/index.js`.
- Removidas as chamadas `logCompletion` (`ActiveModeContext`, `MultiCardSession`,
  `PostSessionForm`) — a conclusão de tarefa já é capturada pelo acumulador de foco
  (`tasksCompleted`) e persistida no `logUsage` ao encerrar a sessão.
- `useRemoteSync` e `DashboardPage` não carregam mais `loadRemoteModeLog`.
- Consumidores de `usageStats` migrados para importar de `sessionUsageLog`: `ModesPanel`,
  `ModePicker`, `WeeklyReview`, `DashboardPage`, `DailyFocusPage`, `HelperPickerModal`.

### UI (A)
- **`components/history/HistoryPage.tsx`**: aba "Modos" removida. Tabs finais:
  **Sessões · Uso · Check-ins**. O filtro de modo (dropdown agrupado, ver
  [[49-Simplificar-Filtro-Modos-Historico]]) passa a ser exclusivo da aba **Uso**.

### Trade-off
Antes o `logCompletion` atualizava o ranking **ao vivo** (a cada tarefa concluída). Agora o
ranking deriva do log de uso, escrito **ao encerrar a sessão** — onde a UI precisa refletir na
hora (`ModesPanel`), recomputa-se `usageStats` após `logUsage`.

## Melhorias (segunda rodada)
1. **Ranking ao vivo (#1):** novo `usageStatsLive(days)` sobrepõe as conclusões da sessão de
   modo EM ANDAMENTO (lê `ACTIVE_MODE_SESSION` + `getModeFocusStats().tasksCompleted`), então
   o "mais usados" volta a atualizar a cada tarefa concluída. Usado em `ModesPanel`/`ModePicker`;
   `usageStats` puro continua em analytics. (multi-card só aparece ao encerrar.)
2. **Sem perda de sessão (#2):** removido o unique `(user, mode, date, hour)` de
   `session_usage_logs` (duas sessões do mesmo modo na mesma hora se sobrescreviam). Idempotência
   agora por **`client_id`** (UUID do cliente). Migration Prisma
   `20260930000000_session_usage_client_id` + `supabase/session_usage_client_id_migration.sql`;
   POST/bulk fazem upsert por `clientId`; GET retorna `client_id`; dedupe de leitura por ele.
3. **Migração de dados órfãos (#3):** `backend/scripts/migrate-modelog-to-usage.js` cria um
   registro mínimo de uso (`tasks_completed: 1`) para cada `mode_logs` sem uso no mesmo dia —
   preserva o ranking histórico. Idempotente; `--dry` para simular.
4. **Cache de leitura (#4):** `getUsageLogs()` memoizado (invalida nas escritas e no evento
   `storage`), evitando reparse do localStorage a cada render nas ~6 telas que o consomem.
5. **Clareza sessões×tarefas (#5):** o resumo da aba Uso mostra **"X sessões · Y tarefas"**
   (soma de `tasksCompleted`), removendo a ambiguidade entre sessão e conclusão.
6. **Testes (#6):** `sessionUsageLog.test.ts` cobre `usageStats` (soma de `tasksCompleted`,
   fallback 1/sessão, janela de dias, ordenação, vazio).
7. **Limpeza (#7):** removida a constante morta `SK.MODE_LOG` (as migrações de chave legada
   em `storage.ts`/`migrateLegacyKeys.ts` foram mantidas — ainda limpam localStorage antigo).

### Aplicar em deploy
`prisma migrate deploy` (aplica a migration do `client_id`) e, opcionalmente,
`node scripts/migrate-modelog-to-usage.js` uma vez. Em Supabase direto, rodar o `.sql` novo.

## Fora de escopo
- A tabela `mode_logs` (Prisma/Supabase) **não** foi dropada — fica órfã, sem escrita, para
  preservar histórico. Limpeza opcional em migração futura.

## Verificação
1. `cd frontend && npm run build` — sem imports quebrados de `modeLog`.
2. Completar 2-3 sessões em modos diferentes → confirmar que ModePicker (banner/ordenação
   "mais usados"), ModesPanel, Dashboard e DailyFocus mostram contagens coerentes.
3. Histórico: só 3 abas; filtro de modo funciona na aba Uso; cards ricos aparecem.
4. Backend: nada mais chama `/mode-log`; `/session-usage-logs` GET/POST OK.
