# 41 - Métricas Ricas e Robustez do Tempo de Foco por Modo

Ligada a: [[0-Painel]] · [[39-Tempo-Modo-Sincronizado-Daily-Focus]] · [[2-Modos-e-Tipos]] ·
[[34-Card-Persistente-Daily-Focus]]

Evolução da [[39-Tempo-Modo-Sincronizado-Daily-Focus]]: além de medir o **tempo de foco
efetivo**, o acumulador agora é **robusto a background/reload** e captura **métricas
ricas** por sessão, prontas para análise comparativa entre modos.

## 1. Robustez (anti super-contagem)

`lib/modeFocusTimer.ts` ganhou:
- **Heartbeat (`lastSeenTs`)**: `syncModeFocusTimer` roda a cada 15s (interval no
  `ActiveModeContext`), no `DAILY_FOCUS_LIVE_EVENT` e no `visibilitychange`.
- **Grace de 20s**: se o app dormir/fechar com o Daily Focus "rodando", o tempo sem
  heartbeat além de `SYNC_GRACE_MS` é **descartado** (não vira foco falso).
- **Teto por reconciliação (`MAX_STEP_MS = 6h`)**: protege contra saltos de relógio.
- **Checkpoint por âncora**: em foco contínuo, cada sync commita o trecho confiável e
  rola a âncora — não perde tempo entre eventos nem conta background.

## 2. Métricas ricas capturadas "de graça"

Estado do acumulador passou a registrar:
- `pauseCount` — nº de pausas do foco (transições foco→pausa);
- `pausedMinutes` — tempo total pausado com o modo ativo;
- `focusBlocks` — nº de blocos de foco (**fragmentação**: 45min corridos ≠ 45min em 9
  pedaços);
- `tasksCompleted` — tarefas concluídas com o modo ativo (via `incrementModeTaskCount`
  no `handleModeTaskComplete`).

Persistidas em `logUsage` (`sessionUsageLog.ts`) → localStorage + backend
(`session_usage_logs`: `pause_count`, `paused_minutes`, `focus_blocks`,
`tasks_completed` — migração `20260929030000_add_session_usage_focus_stats`).

## 3. Menos input manual no pós-sessão

`PostSessionForm` (single) e `MultiCardPostForm` passam a **pré-preencher** o "tempo
focado" com o **foco medido** (o usuário só ajusta). O banner mostra
"⚡ Foco medido: X min · N pausas · M tarefas".

## 4. Analytics

Nova função `getFocusQualityByMode(days)` em `sessionUsageLog.ts` agrega por modo:
`avgFocusMin`, `avgPauses`, `totalPausedMin`, `avgBlocks`, `totalTasks` e
`focusContinuity` (min de foco por bloco). Só considera sessões no novo formato.

## 5. UX do card flutuante

`FloatingModeCard` distingue claramente o estado: quando o Daily Focus está parado,
mostra **"⏸ … · Daily Focus pausado"** (antes só "(pausado)"), com `title` explicativo.

## 6. Testes

`lib/modeFocusTimer.test.ts` (6 casos, todos verdes) cobre: não-acumular sem Daily
Focus, o exemplo **25 + 10 pausa + 20 = 45 min** (pauseCount=1, blocks=2), descarte de
background além do grace, contagem de tarefas, congelamento ao vivo e limpeza no stop.

## Arquivos

- `frontend/src/lib/modeFocusTimer.ts` (+ `.test.ts`)
- `frontend/src/contexts/ActiveModeContext.tsx` (heartbeat + task count)
- `frontend/src/lib/sessionUsageLog.ts` (campos + `getFocusQualityByMode`)
- `frontend/src/components/MultiCardSession.tsx`, `sessions/PostSessionForm.tsx`,
  `ModeSession.tsx`, `modes/FloatingModeCard.tsx`
- `backend/prisma/schema.prisma` + migração `20260929030000_add_session_usage_focus_stats`
- `backend/src/routes/sessionUsageLogs.js`, `supabase/session_usage_migration.sql`
