# 17 - Criar Projeto Inline na Tarefa

Voltar ao [[0-Painel]].

Permite **criar um projeto rápido direto do card de Nova Tarefa** (`AddTaskForm`),
sem abrir o modal `⚙ Projetos` nem perder o que já foi digitado na tarefa.

## Motivação
O campo **📁 Projeto** (em "Mais opções") só deixava escolher projetos existentes.
Para criar um, o usuário tinha que sair, abrir o `ProjectManager`, criar, e voltar —
perdendo o contexto da tarefa em edição.

## Arquivos
- `frontend/src/components/AddTaskForm.tsx`
- `frontend/src/components/AddTaskForm.module.css`
- `frontend/src/pages/TasksPage.tsx`

## Como funciona
1. `TasksPage` passa a nova prop `onCreateProject={projectsHook.createProject}`
   para `<AddTaskForm>` (mutation já existente em `hooks/useProjects.ts`, que
   invalida as queries de projetos/tarefas — o select atualiza sozinho).
2. Ao lado do `ProjectSelect` aparece o botão **＋ Novo** (`.qcToggle`).
3. Clicar revela um mini-form (`.qcBox`): input de **emoji** (`.qcEmoji`),
   **nome** (autofocus) e uma linha de **10 cores** em swatches (`QC_COLORS`).
4. "Criar projeto" chama `handleCreateProject` →
   `onCreateProject({ name, emoji, color, parent_id: null })` →
   `handleProjectChange(project.id)` (que já herda o `default_estimated_minutes`
   do projeto, se houver) → recolhe e limpa o mini-form.
5. **Enter** dentro do nome cria o projeto (com `stopPropagation` para não
   submeter a tarefa inteira); **Esc** cancela o mini-form. Erros vão em `npError`.
6. Se `onCreateProject` não for passado, o botão **＋ Novo** simplesmente não aparece.

## 2ª iteração — "implemente tudo" (componentização + paridade com o ProjectManager)
O quick-create foi extraído para um componente compartilhado e ganhou os mesmos
recursos do formulário completo:

### Novos arquivos compartilhados
- `frontend/src/lib/projectTheme.ts` — **fonte única** de `PROJECT_COLORS`,
  `PROJECT_EMOJIS`, defaults e `normalizeEmoji()`. Importado por todos os pontos
  de criação (fim da paleta/emoji duplicados).
- `frontend/src/components/EmojiPicker.tsx` (+ `.module.css`) — botão + popover de
  grade de emojis com campo custom, reutilizável.
- `frontend/src/components/QuickCreateProject.tsx` (+ `.module.css`) — mini-form
  completo (emoji picker + nome + paleta de cores + **projeto-pai** + **preview
  ao vivo** + **aviso de nome duplicado** + erro), com foco no nome ao abrir,
  guarda contra duplo-submit e `normalizeEmoji`.

### Onde aparece agora
1. **AddTaskForm** — botão **＋ Novo** e/ou opção **"＋ Criar novo projeto…"** no
   dropdown do `ProjectSelect`. Após criar: seleciona o projeto e mostra
   **"✓ Projeto criado e selecionado"** (`.qcSuccess`).
2. **TaskCard (edição de tarefa)** — mesma criação inline, via `onCreateProject`
   passado por `TaskList` ← `TasksPage`.
3. **ProjectSelect** — nova prop opcional `onCreateNew` adiciona a opção
   "＋ Criar novo projeto…" ao `<select>` (valor sentinela `__create__`).
4. **ProjectManager** — refatorado para usar `EmojiPicker` + `PROJECT_COLORS`
   (removida a implementação local do picker/paleta).

### Recursos incluídos (das sugestões)
Emoji picker (1), preview (2), projeto-pai (3), aviso de duplicado (4), feedback de
sucesso (5), componente/tokens compartilhados (6+7), ＋ Novo também na edição (8),
opção no dropdown do select (9), foco gerenciado (10), sem duplo-submit (11),
normalização de emoji (12).

## Escopo / não-objetivos
- Sem mudanças de backend — reutiliza `createProject` (`hooks/useProjects.ts`).

## Verificação
- `cd frontend && npm run build` → OK. `npm run lint` → limpo (erro restante é do
  `vite.config.js`, pré-existente). `npx vitest run` → `ProjectSelect.test.ts` passa.
- `npm run dev` → Tarefas → **+** → "Mais opções" → **＋ Novo** ou opção do dropdown.
- Testar: emoji picker, paleta/cor custom, projeto-pai, preview, aviso de duplicado,
  criar (foco/enter/esc), feedback de sucesso; repetir na **edição** de uma tarefa.

Relacionado: [[11-Projetos-e-Grupos]], [[15-Redesign-Card-Nova-Tarefa]], [[16-Redesign-Form-Adicionar-Projeto]].
