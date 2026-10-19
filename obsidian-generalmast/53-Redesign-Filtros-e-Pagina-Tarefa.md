# 53 - Redesign de Filtros e Página Completa da Tarefa

Redesign dos filtros da tela de Tarefas e criação de página completa da tarefa.

## Mudanças

### Schema & Backend ✅ CONCLUÍDO

1. **Schema Prisma** (`backend/prisma/schema.prisma`):
   - Adicionado campo `assigned_to` (String?, nullable)
   - Renomeado `userId` → `createdBy` no modelo Task
   - Adicionadas relações no User: `createdTasks` e `assignedTasks`
   - Criados índices otimizados: `createdBy`, `assignedTo`, `createdBy + assignedTo`, `assignedTo + completed`

2. **Migração SQL** (`backend/prisma/migrations/20261011000000_add_task_assigned_to/migration.sql`):
   - Criada tabela `tasks_new` com schema atualizado
   - Copiados dados: `created_by = user_id`, `assigned_to = user_id` (todas tarefas inicialmente atribuídas ao criador)
   - Dropada tabela antiga, renomeada nova
   - Recriados índices otimizados
   - ✅ Migração aplicada com sucesso

3. **API Backend** (`backend/src/routes/tasks.js`):
   - ✅ Schemas Zod atualizados: `createTaskSchema`, `updateTaskSchema` (campo `assigned_to`)
   - ✅ `shapeTask()`: retorna `created_by` e `assigned_to`
   - ✅ GET /tasks: suporta novos filtros
     - `assigned_to=me|none|{uuid}`
     - `priorities=1,2` (multisseleção)
     - `due_filter=overdue|today|this_week|no_date`
   - ✅ POST /tasks: `assignedTo = assigned_to ?? req.userId` (default: criador)
   - ✅ PATCH /tasks/:id: suporta atualizar `assigned_to`
   - ✅ Todas queries de Task: `userId` → `createdBy`

### Frontend Types & API ✅ CONCLUÍDO

1. **Types** (`frontend/src/types/tasks.ts`):
   - ✅ `TaskRecord`: adicionados campos `created_by` e `assigned_to`
   - ✅ `TaskCreateInput`: adicionado campo `assigned_to`

2. **API Client** (`frontend/src/api/tasks.ts`):
   - ✅ `list()`: suporta novos parâmetros `assignedTo`, `priorities`, `dueFilter`

### Próximos Passos

#### Phase 3: Filtros ✅ CONCLUÍDO (4-5h)
- [x] Criar `FilterSheet.tsx` (bottom sheet/sidebar)
- [x] Criar `FilterChips.tsx` (chips removíveis)
- [x] Criar `useTaskFilters.ts` (state + persistência)
- [x] Criar `SegmentedControl.tsx` (abas com scroll)
- [x] Modificar `TasksPage.tsx`:
  - [x] Nova barra de filtros (3 linhas)
  - [x] Integrar FilterSheet
  - [x] Integrar FilterChips
  - [x] Chip toggle "Minhas"
- [x] Atualizar `useTasks.ts` para novos parâmetros
- [x] Atualizar `taskKeys.ts` para cache correto
- [x] CSS responsivo (mobile/desktop)
- [ ] Testar combinações, persistência, contagem

#### Phase 4: Página Completa ✅ CONCLUÍDO (6-8h)
- [x] Criar `TaskDetailPage.tsx`
- [x] Criar componentes auxiliares:
  - [x] `InlineEditableTitle`
  - [x] `PropertyRow`
  - [ ] `AssignedToSelect` (pode usar ProjectSelect como base)
  - [ ] `MarkdownEditor` (textarea básico criado)
  - [ ] `ChecklistEditor` (pode usar componente existente)
- [x] Routing hash (`#task-{id}`)
- [x] Integrar com `TasksPage`
- [x] CSS responsivo (mobile tela cheia / desktop sidebar)
- [x] Link compartilhável (copy to clipboard)
- [x] Autosave com debounce
- [ ] Testar autosave, conflitos, navegação

#### Phase 5: Card Limpo (2-3h)
- [ ] Modificar `TaskCard.tsx`:
  - [ ] Remover formulário inline
  - [ ] Adicionar avatar do responsável
  - [ ] onClick abre TaskDetailPage
- [ ] Ajustar padding inferior
- [ ] Testar swipe actions

#### Phase 6: Testes & Polish (3-4h)
- [ ] Filtros: combinações, chips, contagem, persistência, badges
- [ ] Página: edição, checklist, excluir, voltar, link
- [ ] Mobile (390px) e Desktop (1440px)
- [ ] Acessibilidade
- [ ] Performance (200+ tarefas)

#### Phase 7: Deploy (1-2h)
- [ ] Backup produção
- [ ] Migração em produção
- [ ] Deploy frontend
- [ ] Smoke tests
- [ ] Monitorar 24h

## Arquivos Modificados

### Backend
- `backend/prisma/schema.prisma`
- `backend/prisma/migrations/20261011000000_add_task_assigned_to/migration.sql`
- `backend/src/routes/tasks.js`

### Frontend
- `frontend/src/types/tasks.ts`
- `frontend/src/api/tasks.ts`
- `frontend/src/hooks/useTasks.ts`
- `frontend/src/hooks/useTaskFilters.ts`
- `frontend/src/lib/taskKeys.ts`
- `frontend/src/pages/TasksPage.tsx`
- `frontend/src/pages/TaskDetailPage.tsx` + CSS
- `frontend/src/components/FilterSheet.tsx` + CSS
- `frontend/src/components/FilterChips.tsx` + CSS
- `frontend/src/components/SegmentedControl.tsx` + CSS
- `frontend/src/components/InlineEditableTitle.tsx` + CSS
- `frontend/src/components/PropertyRow.tsx` + CSS
- `frontend/src/App.module.css`

## Arquivos a Criar

### Frontend
- `frontend/src/components/FilterSheet.tsx` + CSS
- `frontend/src/components/FilterChips.tsx`
- `frontend/src/components/SegmentedControl.tsx`
- `frontend/src/pages/TaskDetailPage.tsx` + CSS
- `frontend/src/hooks/useTaskFilters.ts`
- `frontend/src/hooks/useTaskView.ts`
- Componentes auxiliares (InlineEditableTitle, AssignedToSelect, PropertyRow, etc.)

## Decisões Arquiteturais

1. **Campo Responsável**: Preparado para multi-user futuro, mas funciona como single-user hoje
   - Filtro "Minhas" = tarefas atribuídas a mim OU sem responsável
   - Migração popula todas com `assigned_to = created_by`

2. **Filtros**: Local state + localStorage (por userId) + URL params
   - Persistência por usuário
   - Compartilhamento via URL

3. **Routing**: Hash (`#task-{id}`) ao invés de React Router
   - Menos invasivo
   - Deep-link funciona
   - Modal/página se adapta ao hash

4. **Responsivo**:
   - Mobile: Bottom sheet + tela cheia TaskDetail
   - Desktop: Sidebar + modal TaskDetail
