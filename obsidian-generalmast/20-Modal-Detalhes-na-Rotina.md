# 20 - Modal de Detalhes na Rotina Diária

Voltar ao [[0-Painel]].

## Problema
No painel **🔁 Rotina Diária** ([[7-Tarefas-Recorrentes]]), clicar no texto/informações de
um item não fazia nada. Só existiam ações no botão de check (concluir/reabrir), na alça de
arraste e no botão de expandir subtarefas.

## Objetivo
Clicar em qualquer item da Rotina Diária abre um **modal com os detalhes da tarefa e o
formulário de edição** completo.

## Solução
Reaproveitar o componente `TaskCard` (que já renderiza detalhes + edição: título, descrição,
prioridade, data, recorrência, projeto, tempo estimado/gasto e checklist) dentro de um novo
modal, usando a infra existente (`ModalOverlay` + `useDialog`). Sem chamada de API extra —
o objeto da tarefa já vem em `props.tasks`; as mutações passam pelos handlers existentes
(React Query invalida e re-renderiza). Ver também [[8-Atualizacao-Imediata-de-Tarefas]] e
[[9-Cache-Sync-e-Versionamento]].

## Arquivos
- `frontend/src/components/TaskDetailModal.tsx` (novo) — wrapper `ModalOverlay` + `useDialog`
  + `TaskCard` renderizado com `defaultExpanded`. Botão ✕ para fechar; deletar fecha o modal.
- `frontend/src/components/TaskDetailModal.module.css` (novo) — card centralizado com scroll.
- `frontend/src/components/TaskCard.tsx` — nova prop opcional `defaultExpanded` (abre o card
  já expandido dentro do modal). Retrocompatível.
- `frontend/src/components/DailyRoutinePanel.tsx` — props opcionais de handlers
  (`onUpdate`, `onDelete`, checklist add/update/delete, `projects`, `onCreateProject`);
  estado `detailId` + `detailTask` derivado por id (reflete edições em tempo real);
  `onClick`/`onKeyDown` no `div.taskInfo` (irmão dos botões → sem conflito); render do modal.
- `frontend/src/pages/TasksPage.tsx` — repassa ao `DailyRoutinePanel` os handlers que já
  existiam (usados pelo `TaskList`).

## Melhorias (2ª iteração)
Modal centralizado e reutilizado pelos **3 painéis** da aba Tarefas, mais qualidade/UX:

1. **Fechar ao concluir/reabrir/deletar** — `TaskDetailModal` encerra a visualização quando a
   ação é finalizada.
2. **Cobertura nos 3 painéis** — além da Rotina Diária, agora **📅 Hoje & Atrasadas**
   (`DueTodayPanel`) e **Tarefas de Hoje** (`TodayPanel`) abrem o mesmo modal ao clicar no item.
3. **Estado central via hook** `useTaskDetail(tasks)` (`src/hooks/useTaskDetail.ts`): guarda só o
   `id`, deriva a tarefa (reflete edições), dispara `haptic()` ao abrir e sincroniza a URL.
   Um único modal na página evita duplicatas quando vários painéis apontam para a mesma tarefa.
4. **ErrorBoundary** (`compact`) envolvendo o `TaskCard` dentro do modal — falha isolada.
5. **Build corrigido** — `react-is@^18` como dependência direta + `resolve.dedupe` e chunk
   `vendor-recharts` incluindo `react-is` no `vite.config.js` (recharts v3 importava `react-is`).
6. **Menos ruído de tipos** — `src/globals.d.ts` reexpõe o namespace global `JSX`
   (removido no `@types/react` v19); retornos de handlers assíncronos relaxados para
   `Promise<unknown>` em `TaskCard`/painéis.
7. **Acessibilidade** — `aria-labelledby` apontando para o título da tarefa (`useId`).
8. **Animação** — fade do overlay + entrada (scale/translate) do card; respeita
   `prefers-reduced-motion`.
9. **Deep-link** — `?task=<id>` na URL: recarregar ou compartilhar reabre a tarefa.

### Arquitetura resultante
- **Página** (`TasksPage.tsx`): chama `useTaskDetail(allTasksForToday)`, passa `onOpenDetail`
  aos 3 painéis e renderiza um único `<TaskDetailModal>` com todos os handlers.
- **Painéis**: recebem apenas `onOpenDetail?: (id) => void` e disparam no clique do `taskInfo`
  (com `stopPropagation` no botão de prioridade do `DueTodayPanel` para não abrir o modal).

## Detalhes de UX / borda
- O check, a alça de arraste e o expandir continuam funcionando sem abrir o modal (são
  irmãos de `taskInfo`).
- Arraste não abre o modal (guarda `if (!dragging)`).
- Editar/marcar subtarefa reflete no modal (tarefa derivada por id).
- Tarefa deletada com modal aberto → sai da lista → modal fecha sozinho.
- O modal só renderiza se os handlers de edição estiverem presentes.
- Acessibilidade: `useDialog` faz focus trap/restauração; `taskInfo` abre por teclado
  (Enter/Espaço).
