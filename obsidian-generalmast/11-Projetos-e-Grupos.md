# 11 - Projetos e Grupos

Voltar ao [[0-Painel]]. Relacionado a [[7-Tarefas-Recorrentes]] e [[9-Cache-Sync-e-Versionamento]].

## Conceito

`Project` representa tanto um projeto de trabalho quanto um agrupador. A relação `parentId`
forma uma árvore sem limite rígido de profundidade. Exemplo:

- Faculdade
  - Matéria Compiladores
  - Matéria Computação Visual
- Mrender

Cada tarefa pode ter zero ou um `projectId`. Um projeto-pai também pode receber tarefas, embora
o uso recomendado seja deixar as tarefas nos projetos mais específicos.

## Interface

- **⚙ Projetos** abre o gerenciador.
- É possível criar raiz ou subprojeto, editar nome/descrição/emoji/cor, arquivar/restaurar e excluir.
- Arquivar ou restaurar um agrupador aplica a ação à subárvore inteira.
- Restaurar um subprojeto também restaura seus agrupadores-pais, mantendo a árvore visível e consistente.
- Exclusão é bloqueada enquanto houver tarefas ou subprojetos; arquivar é a alternativa segura.
- O formulário de tarefa e a edição oferecem seletor hierárquico de projeto.
- **Criar projeto inline** no card de tarefa: botão **＋ Novo** ao lado do seletor
  abre um mini-form (emoji + nome + cor) que cria o projeto via `createProject` e já
  o deixa selecionado, sem sair da tarefa. Ver [[17-Criar-Projeto-Inline-na-Tarefa]].
- O card mostra um badge com emoji, nome e cor do projeto; agrupadores exibem a soma das tarefas dos descendentes.
- O filtro de projetos é persistido no dispositivo e na URL (`?project=`).
- Filtrar um agrupador inclui as tarefas de todos os seus descendentes.
- A opção **Sem projeto** ajuda a organizar o backlog ainda não classificado.

## Backend e banco

- Modelo Prisma `Project`, auto-relação `ProjectHierarchy` e `Task.projectId` opcional.
- API autenticada em `/projects` com listagem, criação, edição, arquivamento e exclusão segura.
- A API impede projeto-pai de outro usuário e ciclos na hierarquia.
- Migração aditiva `20260916000000_add_projects`; tarefas existentes continuam com `project_id = null`.

## Arquivos principais

- `backend/src/routes/projects.js`
- `backend/src/routes/tasks.js`
- `frontend/src/components/ProjectManager.tsx`
- `frontend/src/components/ProjectSelect.tsx`
- `frontend/src/hooks/useProjects.ts`
- `frontend/src/pages/TasksPage.tsx`
