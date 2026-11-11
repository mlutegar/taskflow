# 66 - Estabilização: testes, lint e tsc (prompt 01b)

Voltar ao [[0-Painel]]. Antecede as páginas de Saúde/Finanças (prompts 02/03). Anterior: [[65-Novos-Modos-Cafe-com-Leite-Curtidas-DJ]].

## Resultado
| | Antes | Depois |
|---|---|---|
| Testes | 7 falhando (`ModePicker.test.tsx`) | 215/215 |
| Lint | 8 erros | 0 erros (81 warnings herdados) |
| `tsc` | 234 erros | 136 erros (47 arquivos) + ratchet |

## 1. ModePicker.test.tsx
`ModePicker` passou a usar `usageStatsLive` (ranking "mais usados" ao vivo), mas o `vi.mock("../lib/sessionUsageLog")` do teste não exportava essa função → `usageStatsLive(...) is not a function`. Era defeito do **mock**, não do código: adicionado `usageStatsLive: () => []`. Também corrigido o genérico de `vi.fn` (vitest 2).

## 2. Lint
Os 8 erros eram `react-hooks/rules-of-hooks` em `ChecklistInFocus.tsx`: 8 `useCallback` depois de `if (!task) return null`. **Bug real**: quando a tarefa carrega depois do 1º render, o nº de hooks muda ("Rendered more hooks…", mesma família do React #310 da nota [[21-Resiliencia-e-Qualidade]]). Correção: `checklist` em `useMemo` e o `return null` movido para depois dos hooks.

## 3. tsc — o que foi corrigido (só tipos, zero mudança de runtime)
- `api.get/post/patch/put/delete` genéricos (`<T = any>`) e `request` → `Promise<any>`; `fetchPreferences` → `Promise<any>` (fim dos ~40 `Property X does not exist on type 'unknown'`).
- `getCheckinLog`/`getSessionFeedback` tipados (`CheckinEntry`/`FeedbackEntry`); `fetchSessions` → `HistoryEntry[]`; `fetchAchievements` → `string[]`.
- `useRoutines`: ids `unknown` → `string | number`; `useTasks`: `fields` do checklist.
- `CheckInConfigPanel` usa o `Estado` exportado de `stateToMode.ts` (removida duplicata local).
- `renotify` (existe na spec, falta no lib.dom): `AppNotificationOptions` + cast.
- `HelperEntry.defaultState: object` (14 erros).

## 3b. tsc — o que sobrou (136) e por quê não foi mexido
Agrupado por causa raiz (ver pedido de decisão no PROMPTS/chat):
- **Tipos duplicados/incompatíveis** (~70): `Task` × `TaskRecord` × `TaskItem` × `TaskData`; `ChecklistItem` (3 versões); `Mode` × `ModeConfig`; `ModeItem` duplicado; callbacks `void` vs `Promise<void>` (Momentum/Espresso/RPG/Cafe/WorkingTask/ActiveModeContext). Unificar exige escolher o tipo canônico.
- **Pode mudar comportamento** (precisa decisão): `ChecklistInFocus` lê `data` de `useTasks()` que não existe (renderiza sempre `null`?); `ChecklistInFocusEnhanced` passa `{duration}` ao toast, mas a API do toast não aceita (duração ignorada?); `DailyFocusPage` lê `Task.id`/`checklist_count` inexistentes e grava `checklistMetrics` fora do `HistoryEntry`; `TaskDetailPage` usa `completed_at`; `TaskCard` usa `due_time`; `exportIcal` usa `api.baseURL`; `syncToBackend` passa `string` onde espera `MutableMethod`; `toast("warning")`; `allowNone` no seletor de projeto.

## 4. Ratchet
`frontend/scripts/tsc-baseline.mjs` + `tsc-baseline.json`; `npm run typecheck:baseline` falha se o total **ou** qualquer arquivo tiver mais erros (arquivo novo com erro também). `-- --update` só grava se o total não subir. Passo bloqueante no `ci.yml` (o `typecheck` completo segue informativo). Validado injetando um erro: o script falhou (0 → 1) e voltou a passar ao remover.
