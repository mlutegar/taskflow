# 67 - Estabilização (2ª rodada): bugs achados pelo tsc (prompt 01c)

Continuação de [[66-Estabilizacao-Testes-Lint-Tsc]]. Voltar ao [[0-Painel]].

## Resultado
`tsc` 136 → **92** erros (42 arquivos; baseline atualizado) · lint 0 erros · 216+ testes (215 + 4 do Toast) · build ok.

## Bugs reais (não eram só tipos)
1. **Checklist do Daily Focus nunca aparecia.** `ChecklistInFocusEnhanced` (nota [[54-Checklist-no-Daily-Focus]]) lia `data` de `useTasks()`; o hook devolve `tasks`, então `task` era `undefined` e o componente retornava `null`. Também chamava `useTasks()` sem os 2 args obrigatórios. Corrigido (`tasks`, `useTasks(undefined, undefined)`). **Testar manualmente:** Daily Focus → escolher uma tarefa que tenha `supabaseId` (vinda de "Tarefas de Hoje"/seleção) com checklist → iniciar o foco → o card da tarefa deve mostrar a barra de progresso e os itens; marcar item mostra toast "Desfazer"; completar 100% dispara o fim da tarefa. Tarefa sem checklist mostra o campo "adicionar item".
2. **Toasts do checklist ignoravam a duração e o tipo.** Chamavam `showToast(msg, { duration })`, mas o 2º argumento era o *tipo* → classe CSS inexistente e duração sempre 3 s. A API agora aceita `showToast(msg, { type, duration })` (+ alias `duration`, tipo `"warning"` com CSS); toasts de erro do checklist passaram a `type: "error"`.
3. **`ChecklistInFocus.tsx` (original)** não era importado em lugar nenhum → removido (o CSS `ChecklistInFocus.module.css` é compartilhado e ficou).

## Campos conferidos no backend (`routes/tasks.js`, `schema.prisma`)
- Enviados: `due_time`, `completed_at`, `checklist_count`, `checklist_completed_count` → tipos `TaskRecord`/`TaskData` atualizados.
- `allowNone` em `ProjectSelect` não existia (e "Sem projeto" já é sempre uma opção) → prop removida em `TaskDetailPage`.
- `checklistMetrics` no histórico: nunca lido (nem pelo backend), e sempre `undefined` porque o cálculo procurava `id` nos slots locais → cálculo e gravação removidos.
- `syncToBackend(method)` → `MutableMethod` (exportado de `syncQueue.ts`); todos os chamadores usam `"POST"`.

## Assinaturas (`void` × `Promise<void>`)
Props `onAddChecklist` das sessões e `WorkingTask` → `Promise<void>`; `ModeSession`/`MultiCardSession` aceitam `Promise<unknown>` (os handlers resolvem com o registro). Sem mudança de fluxo.

## Pendente de decisão (reportado, NÃO corrigido) — ver CLAUDE.md §7.3
- `exportIcal.ts`: `api.baseURL` inexistente → o export .ics baixa HTML (SPA fallback). Token lido da chave errada.
- Bloco "Métricas de Checklist" do celebrate nunca renderiza (procura `id` em slots locais).

## Backlog
Etapa **04** no `PROMPTS.md`: unificar `Task`/`TaskItem`/`TaskData`/`Slot`, `ChecklistItem` (3), `Mode`×`ModeConfig`, `ModeItem`, `Routine` — resolve ~55 dos 92 erros restantes. Depois de Saúde e Finanças.
