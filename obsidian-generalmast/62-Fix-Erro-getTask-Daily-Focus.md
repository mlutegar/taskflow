# 62 - Fix: Erro "As.getTask is not a function" no Daily Focus

**Data:** 2026-10-22  
**Status:** ✅ Concluído  
**Tipo:** Bugfix  
**Componente:** Daily Focus - TaskSlot

---

## Problema

O app mobile apresentava erro ao carregar detalhes de tarefas no Daily Focus:

```
As.getTask is not a function. (In 'As.getTask(a.supabaseId)', 'As.getTask' is undefined)
```

### Sintoma
- Quando o usuário selecionava uma tarefa existente no slot de preparação diária
- O app tentava carregar detalhes da tarefa (checklist_count, checklist_completed_count)
- A chamada falhava e o app exibia tela de erro

---

## Causa Raiz

**Mismatch de nomenclatura na API:**
- O componente `TaskSlot.tsx` (linha 91) chamava: `tasksApi.getTask()`
- O método correto em `tasks.ts` (linha 69) é: `tasksApi.get()`
- Outros componentes do projeto já usavam a nomenclatura correta

---

## Solução Implementada

### Arquivo: `frontend/src/components/daily-focus/components/TaskSlot.tsx`

**Linha 91 - Antes:**
```typescript
tasksApi.getTask(slot.supabaseId as string).then(setTaskDetails).catch(() => setTaskDetails(null));
```

**Linha 91 - Depois:**
```typescript
tasksApi.get(slot.supabaseId as string).then(setTaskDetails).catch(() => setTaskDetails(null));
```

### Mudança
Renomeado método de `getTask` para `get` para corresponder à assinatura correta da API.

---

## Arquivos Modificados

- ✏️ `frontend/src/components/daily-focus/components/TaskSlot.tsx` (linha 91)

---

## Verificação

### ✅ Checklist de Teste
- [ ] Abrir app mobile
- [ ] Navegar para Daily Focus
- [ ] Clicar em slot de preparação
- [ ] Selecionar tarefa existente com checklist
- [ ] Confirmar que:
  - Não aparece erro "As.getTask is not a function"
  - Detalhes da tarefa são carregados
  - Contador de checklist é exibido (ex: "3/5 items")
  - Sem erros no console

---

## Notas Técnicas

### Métodos disponíveis em `tasksApi`:
- ✅ `get(id)` - Obtém tarefa por ID ← **método correto**
- ✅ `list()` - Lista tarefas
- ✅ `create()`, `update()`, `delete()`
- ✅ `complete()`, `undoComplete()`, `reopen()`
- ✅ `listDueToday()`, `countCompletedToday()`
- ✅ `addChecklistItem()`, `toggleChecklistItem()`, etc.
- ❌ `getTask()` - **não existe**

### Referências de uso correto:
- `TaskDetailPage.tsx` - linha 32: `tasksApi.get(taskId)`
- `useTasks.ts` - linha 156: `tasksApi.get(event.taskId)`

---

## Histórico

- **2026-10-22:** Erro identificado via screenshot do app mobile
- **2026-10-22:** Investigação revelou mismatch de nomenclatura
- **2026-10-22:** Correção implementada em TaskSlot.tsx
- **2026-10-22:** Verificado que não há outras ocorrências do erro

---

## Links Relacionados

- [[54-Checklist-no-Daily-Focus]] - Implementação de checklist
- [[31-Preparacao-Priorizacao-Daily-Focus]] - Funcionalidade de preparação
- [[29-Atividade-Continua-Daily-Focus]] - Sistema Daily Focus

---

**Tags:** #bugfix #daily-focus #api #typescript #mobile
