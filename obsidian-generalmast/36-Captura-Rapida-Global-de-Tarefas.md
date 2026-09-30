# 36 - Captura Rápida Global de Tarefas (botão + modal em todas as páginas)

> Ver também: [[0-Painel]] · [[15-Redesign-Card-Nova-Tarefa]] · [[26-Modo-Minimizavel-Card-Flutuante]] · [[8-Atualizacao-Imediata-de-Tarefas]] · [[34-Card-Persistente-Daily-Focus]]

## Motivação
A plataforma concentra a organização das tarefas, mas criar uma tarefa só era possível
dentro de `#/tasks` (a `TasksPage` renderiza o `AddTaskForm` inline). Isso quebrava o
fluxo: ao lembrar de algo estando no **Daily Focus**, **Módulos** ou **Análises**, o
usuário precisava navegar até Tarefas para registrar.

Objetivo: **captura rápida global** — um botão flutuante persistente **"+ Nova tarefa"**
visível em todas as páginas que abre um formulário rápido em **modal**, sem tirar o
usuário da página atual. Ao salvar, o modal fecha e ele continua exatamente onde estava.

Fluxo: **lembrei → clico no botão global → cadastro rápido → salvo → continuo**.

## Comportamento
- FAB fixo no canto inferior direito (círculo só com ícone no mobile, acima do bottom nav;
  lado oposto ao card do Daily Focus, que fica à esquerda — sem sobreposição).
- Atalho de teclado: tecla **N** (fora de campos de texto) abre a captura rápida.
- Requisito mínimo: só o **título** é obrigatório. Opcionais: data/hora, prioridade,
  descrição, **subtarefas** e, em "Mais opções", recorrência/tempo/projeto.
- Ao salvar: cria a tarefa (`POST /tasks`) e, em seguida, cada subtarefa staged
  (`POST /tasks/:id/checklist`); depois fecha o modal.
- A tarefa aparece automaticamente em todas as telas: `handleCreateTask` já faz update
  otimista + `invalidateQueries(taskKeys.lists())` e o cache do React Query é compartilhado
  por chave (ver [[8-Atualizacao-Imediata-de-Tarefas]] e [[9-Cache-Sync-e-Versionamento]]).

## Arquitetura
Reaproveita componentes existentes em vez de duplicar:
- `AddTaskForm` (form completo já usado na `TasksPage`).
- `ModalOverlay` (`components/shared/ModalOverlay.tsx`) — portal + fechar por Esc/backdrop.
- `useTasks` — `handleCreateTask` (retorna a task criada) e `handleAddTaskChecklist`.
- `useProjects` — `projects` e `createProject` para o form.

Padrão de provider global acima do roteador (mesmo de [[26-Modo-Minimizavel-Card-Flutuante]]
e [[34-Card-Persistente-Daily-Focus]]): `QuickTaskProvider` guarda `isOpen/open/close`;
o `QuickTaskButton` renderiza o FAB e, só quando aberto, o `QuickTaskModal` — assim
`useTasks`/`useProjects` só montam com o modal aberto (evita subscrições SSE/polling extras).

## Campos / dados
- Nova prop opcional em `AddTaskForm`: `enableChecklist?: boolean` (default `false`, mantém
  a `TasksPage` inalterada). Quando ativa, renderiza uma seção "Subtarefas" (input + Enter,
  lista local com remover) e inclui `checklist?: string[]` no payload de `onSubmit`.
- `useQuickTaskCreate().save(data)`: separa `checklist` do restante, cria a tarefa e
  itera `handleAddTaskChecklist(taskId, item)`. Se offline (create enfileirado sem id),
  as subtarefas não são anexadas.

## Arquivos
Novos:
- `frontend/src/contexts/QuickTaskContext.tsx` — provider + `useQuickTask` + `useQuickTaskCreate`
- `frontend/src/components/QuickTaskButton.tsx` — FAB + modal
- `frontend/src/components/QuickTaskButton.module.css`

Modificados:
- `frontend/src/components/AddTaskForm.tsx` — prop `enableChecklist` + seção de subtarefas + `checklist` no payload
- `frontend/src/components/AddTaskForm.module.css` — estilos `.checklist*`
- `frontend/src/main.tsx` — `QuickTaskProvider` envolvendo o app autenticado + `<QuickTaskButton />`

## Tokens reutilizados
`--accent`, `--accent-hover`, `--surface`, `--surface-2`, `--border`, `--text`,
`--text-muted`, `--danger`, `--radius-sm`; ícone `Plus` do `lucide-react`;
`z-index: 900` (abaixo do `ModalOverlay` 1000, acima do conteúdo).

## Verificação
1. `cd frontend && npm run dev`.
2. Navegar para `#/daily-focus`, `#/modes`, `#/dashboard` — o FAB "+ Nova tarefa" aparece
   em todas.
3. Clicar no FAB (ou pressionar **N**) → modal abre sobre a página atual (rota não muda).
4. Criar tarefa só com título → salvar → modal fecha, rota permanece a mesma.
5. Criar tarefa com data/hora, prioridade, descrição e 2 subtarefas → abrir `#/tasks` e
   confirmar a tarefa com prioridade/prazo e o checklist correto.
6. Esc/backdrop fecham sem salvar.

## Relacionado
[[15-Redesign-Card-Nova-Tarefa]] · [[17-Criar-Projeto-Inline-na-Tarefa]] ·
[[8-Atualizacao-Imediata-de-Tarefas]] · [[26-Modo-Minimizavel-Card-Flutuante]]
