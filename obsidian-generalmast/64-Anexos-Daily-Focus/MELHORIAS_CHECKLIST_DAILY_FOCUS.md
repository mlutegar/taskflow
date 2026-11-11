# Melhorias para Checklist no Daily Focus

Baseado nos padrões do projeto GeneralMast e práticas observadas no código existente, aqui estão sugestões de melhorias para a implementação de checklists:

---

## 🎯 Melhorias de UX/UI

### 1. **Atalhos de Teclado** ⌨️
**Inspiração:** O projeto já usa atalhos (Space para play/pause, Ctrl+K para quick task)

```typescript
// Em ChecklistInFocus.tsx
useEffect(() => {
  const handleKeyboard = (e: KeyboardEvent) => {
    // Ctrl/⌘ + Enter: adicionar item rápido
    if ((e.ctrlKey || e.metaKey) && e.key === 'Enter' && newItemText) {
      e.preventDefault();
      handleAdd(newItemText);
    }
    
    // Ctrl/⌘ + 1-9: marcar item 1-9 rapidamente
    if ((e.ctrlKey || e.metaKey) && /^[1-9]$/.test(e.key)) {
      e.preventDefault();
      const idx = parseInt(e.key) - 1;
      if (active[idx]) handleToggle(active[idx].id);
    }
    
    // Shift + Enter: adicionar e começar outro (modo batch)
    if (e.shiftKey && e.key === 'Enter' && newItemText) {
      e.preventDefault();
      handleAdd(newItemText);
      // Input mantém foco (já implementado)
    }
  };
  
  window.addEventListener('keydown', handleKeyboard);
  return () => window.removeEventListener('keydown', handleKeyboard);
}, [newItemText, active, handleAdd, handleToggle]);
```

**Adicionar dica visual:**
```tsx
<div className={styles.checklistHints}>
  <span>⌘+1-9 marcar · ⌘+Enter adicionar · Colar lista</span>
</div>
```

---

### 2. **Toast de Feedback** 🍞
**Inspiração:** [[40-Melhorias-Captura-Rapida]] usa toast com Desfazer

```typescript
import { useToast } from "../shared/Toast";

const { showToast } = useToast();

const handleToggle = useCallback(async (itemId: string | number) => {
  const item = checklist.find((i) => i.id === itemId);
  if (!item) return;
  
  const wasCompleted = item.completed;
  await toggleChecklistMutation.mutateAsync({ taskId, itemId: String(itemId) });
  
  // Toast com Desfazer
  showToast(
    wasCompleted ? "Item desmarcado" : "✓ Item concluído",
    {
      action: {
        label: "Desfazer",
        onClick: () => toggleChecklistMutation.mutateAsync({ taskId, itemId: String(itemId) })
      },
      duration: 3000
    }
  );
  
  // ... resto do código
}, [taskId, checklist, toggleChecklistMutation, showToast]);
```

**Toast ao completar todos:**
```typescript
if (newCompleted === totalCount && totalCount > 0) {
  showToast(`🎉 Checklist completo! (${totalCount} itens)`, { duration: 2000 });
  if (onAllCompleted) setTimeout(() => onAllCompleted(), 500);
}
```

---

### 3. **Drag & Drop para Reordenar** 🎯
**Inspiração:** [[24-Melhorias-Tarefas-Hoje]] implementa reorder por drag&drop

Instalar `@dnd-kit/core` (já usado no projeto):

```typescript
import { DndContext, closestCenter, PointerSensor, useSensor, useSensors } from '@dnd-kit/core';
import { SortableContext, verticalListSortingStrategy, useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';

function ChecklistInFocus({ taskId, onAllCompleted }: ChecklistInFocusProps) {
  const sensors = useSensors(useSensor(PointerSensor));
  
  const handleDragEnd = useCallback((event) => {
    const { active, over } = event;
    if (active.id !== over.id) {
      const oldIndex = active.findIndex(i => i.id === active.id);
      const newIndex = active.findIndex(i => i.id === over.id);
      
      // API de reordenar (adicionar endpoint no backend)
      reorderChecklistMutation.mutateAsync({
        taskId,
        itemId: active.id,
        newOrder: newIndex
      });
    }
  }, [taskId, active]);
  
  return (
    <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
      <SortableContext items={active.map(i => i.id)} strategy={verticalListSortingStrategy}>
        {active.map((item) => (
          <SortableChecklistItem key={item.id} item={item} {...props} />
        ))}
      </SortableContext>
    </DndContext>
  );
}

function SortableChecklistItem({ item, ...props }) {
  const { attributes, listeners, setNodeRef, transform, transition } = useSortable({ id: item.id });
  
  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };
  
  return (
    <div ref={setNodeRef} style={style} {...attributes}>
      <div className={styles.dragHandle} {...listeners}>⋮⋮</div>
      <ChecklistItemRow item={item} {...props} />
    </div>
  );
}
```

**Backend (adicionar em `tasks.js`):**
```javascript
// PATCH /tasks/:id/checklist/:itemId/order
server.patch("/tasks/:id/checklist/:itemId/order", async (req, reply) => {
  const { id, itemId } = req.params;
  const { newOrder } = req.body;
  
  const item = await prisma.checklistItem.update({
    where: { id: parseInt(itemId) },
    data: { order: newOrder }
  });
  
  return item;
});
```

---

### 4. **Estimativa de Tempo por Item** ⏱️
**Inspiração:** [[14-Tempo-Estimado-e-Filtro]] implementa tempo estimado

```typescript
interface TaskChecklistItem {
  id: string | number;
  description: string;
  completed: boolean;
  estimatedMinutes?: number; // NOVO
  order?: number;
}

// UI com badge de tempo
<div className={styles.checklistItemText}>
  {item.description}
  {item.estimatedMinutes && (
    <span className={styles.itemTime}>⏱ {item.estimatedMinutes}min</span>
  )}
</div>

// Total de tempo estimado restante
const remainingMinutes = active.reduce((sum, item) => sum + (item.estimatedMinutes || 0), 0);

<div className={styles.checklistProgressText}>
  {completedCount} de {totalCount} · {remainingMinutes > 0 && `~${remainingMinutes}min restantes`}
</div>
```

---

### 5. **Swipe para Marcar/Remover (Mobile)** 📱
**Inspiração:** Padrão mobile comum no projeto

```typescript
import { useSwipeable } from 'react-swipeable';

function ChecklistItemRow({ item, onToggle, onDelete }: ChecklistItemRowProps) {
  const [swipeOffset, setSwipeOffset] = useState(0);
  
  const handlers = useSwipeable({
    onSwiping: (eventData) => {
      if (eventData.dir === 'Left') {
        setSwipeOffset(Math.min(0, eventData.deltaX));
      }
    },
    onSwipedLeft: () => {
      if (swipeOffset < -100) {
        onDelete(item.id);
      } else if (swipeOffset < -50) {
        onToggle(item.id);
      }
      setSwipeOffset(0);
    },
    onSwiped: () => setSwipeOffset(0),
    trackMouse: false
  });
  
  return (
    <div className={styles.checklistItemWrapper} {...handlers}>
      <div className={styles.swipeActions} style={{ right: -swipeOffset }}>
        <button className={styles.swipeCheck}>✓</button>
        <button className={styles.swipeDelete}>🗑</button>
      </div>
      <div
        className={styles.checklistItem}
        style={{ transform: `translateX(${swipeOffset}px)` }}
      >
        {/* conteúdo do item */}
      </div>
    </div>
  );
}
```

---

### 6. **Progresso Visual Aprimorado** 📊
**Inspiração:** Projeto usa gradientes e microanimações

```css
.checklistProgressFill {
  height: 100%;
  background: linear-gradient(
    90deg,
    var(--primary) 0%,
    var(--primary-light) 50%,
    var(--accent) 100%
  );
  border-radius: 2px;
  transition: width 0.4s cubic-bezier(0.4, 0, 0.2, 1);
  box-shadow: 0 0 8px rgba(79, 70, 229, 0.3);
}

/* Pulso ao completar item */
@keyframes progressPulse {
  0%, 100% { transform: scaleY(1); }
  50% { transform: scaleY(1.2); }
}

.checklistProgressFill.justCompleted {
  animation: progressPulse 0.3s ease-out;
}
```

**Adicionar celebração ao 100%:**
```typescript
if (newCompleted === totalCount && totalCount > 0) {
  setProgress100(true);
  setTimeout(() => setProgress100(false), 1000);
}

<div className={`${styles.checklistProgressBar} ${progress100 ? styles.celebrate : ""}`}>
```

```css
.checklistProgressBar.celebrate {
  animation: celebrateShake 0.5s ease-in-out;
}

@keyframes celebrateShake {
  0%, 100% { transform: translateX(0); }
  25% { transform: translateX(-4px); }
  75% { transform: translateX(4px); }
}
```

---

## 🔧 Melhorias Técnicas

### 7. **Batching de Múltiplas Adições** 🚀
**Problema:** `handleAddMultiple` faz N requests sequenciais

```typescript
// Backend: adicionar endpoint batch
// POST /tasks/:id/checklist/batch
server.post("/tasks/:id/checklist/batch", async (req, reply) => {
  const { id } = req.params;
  const { items } = req.body; // Array de { description, parent_id }
  
  const created = await prisma.$transaction(
    items.map((item) =>
      prisma.checklistItem.create({
        data: {
          taskId: id,
          description: item.description,
          parent_id: item.parent_id,
          order: item.order || 0,
          completed: false
        }
      })
    )
  );
  
  await prisma.task.update({
    where: { id },
    data: { version: { increment: 1 } }
  });
  
  return created;
});

// Frontend
const handleAddMultiple = useCallback(
  async (descriptions: string[]) => {
    const items = descriptions
      .filter(d => d.trim())
      .map(d => ({ description: d.trim(), parent_id: null }));
    
    if (!items.length) return;
    
    await addChecklistBatchMutation.mutateAsync({ taskId, items });
    setNewItemText("");
  },
  [taskId, addChecklistBatchMutation]
);
```

---

### 8. **Persistência Local do Campo de Adição** 💾
**Inspiração:** [[40-Melhorias-Captura-Rapida]] tem rascunho persistente

```typescript
const DRAFT_KEY = `checklistDraft_${taskId}`;

const [newItemText, setNewItemText] = useState(() => {
  try {
    return localStorage.getItem(DRAFT_KEY) || "";
  } catch {
    return "";
  }
});

// Salvar draft ao digitar (debounced)
const saveDraft = useMemo(
  () => debounce((text: string) => {
    try {
      if (text.trim()) {
        localStorage.setItem(DRAFT_KEY, text);
      } else {
        localStorage.removeItem(DRAFT_KEY);
      }
    } catch {}
  }, 500),
  [DRAFT_KEY]
);

useEffect(() => {
  saveDraft(newItemText);
}, [newItemText, saveDraft]);

// Limpar draft ao adicionar
const handleAdd = useCallback(
  async (description: string) => {
    if (!description.trim()) return;
    await addChecklistMutation.mutateAsync({
      taskId,
      description: description.trim(),
      parentId: null,
    });
    setNewItemText("");
    localStorage.removeItem(DRAFT_KEY); // Limpa draft
  },
  [taskId, addChecklistMutation, DRAFT_KEY]
);
```

---

### 9. **Tratamento de Erros Robusto** 🛡️
**Inspiração:** [[21-Resiliencia-e-Qualidade]] — Error Boundary e rollback

```typescript
const handleToggle = useCallback(
  async (itemId: string | number) => {
    const item = checklist.find((i) => i.id === itemId);
    if (!item) return;

    try {
      await toggleChecklistMutation.mutateAsync({ taskId, itemId: String(itemId) });
      
      const newCompleted = item.completed ? completedCount - 1 : completedCount + 1;
      if (newCompleted === totalCount && totalCount > 0 && onAllCompleted) {
        setTimeout(() => onAllCompleted(), 500);
      }
    } catch (error) {
      console.error('Erro ao marcar item:', error);
      showToast("Erro ao marcar item. Tente novamente.", { duration: 3000, type: "error" });
      // O rollback otimista do useTasks já reverteu a UI
    }
  },
  [taskId, checklist, completedCount, totalCount, toggleChecklistMutation, onAllCompleted, showToast]
);

// Indicador de loading durante mutações
const isLoading = 
  addChecklistMutation.isPending ||
  toggleChecklistMutation.isPending ||
  updateChecklistMutation.isPending ||
  deleteChecklistMutation.isPending;

{isLoading && <div className={styles.loadingOverlay}>Salvando...</div>}
```

---

### 10. **Métricas de Progresso do Checklist** 📈
**Inspiração:** [[41-Metricas-Ricas-e-Robustez-Tempo-Modo]] registra métricas detalhadas

Registrar no resumo da sessão:

```typescript
// Em DailyFocusPage.tsx - completeSession()
const checklistMetrics = {
  tasksWithChecklist: tasks.filter(t => t.supabaseId && taskDetails[t.supabaseId]?.checklist_count > 0).length,
  totalItems: tasks.reduce((sum, t) => sum + (taskDetails[t.supabaseId]?.checklist_count || 0), 0),
  completedItems: tasks.reduce((sum, t) => sum + (taskDetails[t.supabaseId]?.checklist_completed_count || 0), 0),
  completionRate: totalItems > 0 ? (completedItems / totalItems) * 100 : 0
};

// Salvar em dailyFocusHistory
addSession({
  // ... outros campos
  checklistMetrics,
  timestamp: Date.now()
});

// Exibir no celebrate
{checklistMetrics.completedItems > 0 && (
  <div className={styles.celebrateChecklistStat}>
    ☑ {checklistMetrics.completedItems} de {checklistMetrics.totalItems} itens concluídos
    ({Math.round(checklistMetrics.completionRate)}%)
  </div>
)}
```

---

### 11. **Conquistas Relacionadas a Checklist** 🏆
**Inspiração:** [[38-Fluxo-Direto-e-Checkpoint-Emocional]] tem conquista "Sintonia Emocional"

```typescript
// Em dailyFocusAchievements.ts
const CHECKLIST_ACHIEVEMENTS = [
  {
    id: "checklist_master",
    name: "Mestre do Checklist",
    description: "Completou 100 itens de checklist",
    emoji: "☑️",
    threshold: 100,
    metric: "totalChecklistItems"
  },
  {
    id: "perfectionist",
    name: "Perfeccionista",
    description: "Completou 10 checklists inteiros (100%) em sessões",
    emoji: "💯",
    threshold: 10,
    metric: "perfectChecklists"
  },
  {
    id: "speed_demon",
    name: "Velocidade Máxima",
    description: "Completou um checklist de 5+ itens em menos de 10 minutos",
    emoji: "⚡",
    threshold: 1,
    metric: "fastChecklists"
  }
];

// Verificar ao fim da sessão
if (checklistMetrics.completionRate === 100 && checklistMetrics.totalItems >= 3) {
  tryUnlock("perfectionist");
}
```

---

### 12. **Integração com Órbita (IA)** 🤖
**Inspiração:** [[46-Integracao-TaskFlow-Orbita]] integra com Claude Web

```typescript
// Botão para gerar checklist com IA
<button
  className={styles.aiGenerateBtn}
  onClick={handleGenerateChecklist}
  title="Gerar checklist com IA"
>
  ✨ Sugerir itens
</button>

const handleGenerateChecklist = useCallback(async () => {
  const prompt = `Tarefa: "${task.title}"\n\nDescrição: ${task.description || "Sem descrição"}\n\nGere um checklist detalhado de 5-10 itens para completar esta tarefa. Retorne apenas a lista, um item por linha.`;
  
  try {
    const response = await fetch('/api/orbita/generate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ prompt })
    });
    
    const { items } = await response.json();
    
    // Adicionar itens em batch
    await addChecklistBatchMutation.mutateAsync({
      taskId,
      items: items.map(desc => ({ description: desc.trim(), parent_id: null }))
    });
    
    showToast(`✨ ${items.length} itens gerados com IA`, { duration: 3000 });
  } catch (error) {
    showToast("Erro ao gerar checklist. Tente novamente.", { type: "error" });
  }
}, [task, taskId, addChecklistBatchMutation, showToast]);
```

---

### 13. **Templates de Checklist** 📋
**Inspiração:** [[29-Atividade-Continua-Daily-Focus]] usa presets

```typescript
const CHECKLIST_TEMPLATES = {
  estudo: [
    "Ler material teórico",
    "Fazer anotações principais",
    "Resolver exercícios",
    "Revisar conceitos-chave",
    "Criar resumo"
  ],
  codificacao: [
    "Planejar arquitetura",
    "Implementar funcionalidade principal",
    "Escrever testes",
    "Refatorar código",
    "Atualizar documentação",
    "Code review"
  ],
  artigo: [
    "Pesquisar referências",
    "Criar outline",
    "Escrever introdução",
    "Desenvolver corpo do texto",
    "Escrever conclusão",
    "Revisar e editar",
    "Formatar e publicar"
  ]
};

// UI de templates
<details className={styles.templatesSection}>
  <summary>📋 Usar template</summary>
  <div className={styles.templatesList}>
    {Object.entries(CHECKLIST_TEMPLATES).map(([key, items]) => (
      <button
        key={key}
        className={styles.templateBtn}
        onClick={() => handleAddMultiple(items)}
      >
        {key.charAt(0).toUpperCase() + key.slice(1)} ({items.length} itens)
      </button>
    ))}
  </div>
</details>
```

---

### 14. **Subtarefas Aninhadas (Recursivas)** 🌳
**Observação:** O backend já suporta `parent_id`, mas o frontend atual não usa

```typescript
// Renderizar recursivamente
function ChecklistItemRow({ item, depth = 0, children, ...props }: ChecklistItemRowProps) {
  return (
    <>
      <div
        className={styles.checklistItem}
        style={{ paddingLeft: `${depth * 20}px` }}
      >
        {/* conteúdo do item */}
        
        {!item.completed && (
          <button
            className={styles.addSubitemBtn}
            onClick={() => setAddingSubFor(item.id)}
            title="Adicionar subitem"
          >
            ↳ +
          </button>
        )}
      </div>
      
      {children && children.length > 0 && (
        <div className={styles.subitems}>
          {children.map(child => (
            <ChecklistItemRow
              key={child.id}
              item={child}
              depth={depth + 1}
              children={getChildren(child.id)}
              {...props}
            />
          ))}
        </div>
      )}
    </>
  );
}

// Construir árvore
const buildTree = (items: TaskChecklistItem[]) => {
  const map = new Map<number | string, TaskChecklistItem[]>();
  items.forEach(item => {
    const parentId = item.parent_id || 'root';
    if (!map.has(parentId)) map.set(parentId, []);
    map.get(parentId)!.push(item);
  });
  return map;
};

const tree = buildTree(checklist);
const rootItems = tree.get('root') || [];
```

---

## 🎨 Melhorias de Design

### 15. **Modo Compacto no Card Flutuante** 💎
**Inspiração:** [[34-Card-Persistente-Daily-Focus]] tem card flutuante

```typescript
// Em DailyFocusFloatingCard.tsx
{currentTask.supabaseId && expanded && (
  <ChecklistInFocus
    taskId={currentTask.supabaseId}
    compact={true}
    onAllCompleted={handleChecklistComplete}
  />
)}

// Modo compacto: apenas progresso + top 3 itens
{compact && (
  <div className={styles.checklistCompact}>
    <div className={styles.compactProgress}>
      ☑ {completedCount}/{totalCount}
    </div>
    <div className={styles.compactItems}>
      {active.slice(0, 3).map(item => (
        <label key={item.id} className={styles.compactItem}>
          <input
            type="checkbox"
            checked={false}
            onChange={() => handleToggle(item.id)}
          />
          <span>{item.description}</span>
        </label>
      ))}
      {active.length > 3 && (
        <div className={styles.compactMore}>+{active.length - 3} mais</div>
      )}
    </div>
  </div>
)}
```

---

### 16. **Animações de Micro-interação** ✨
**Inspiração:** [[27-Redesign-Bottom-Nav-Mobile]] tem micro-interações

```css
/* Checkbox com animação de check */
.checklistCheckbox input[type="checkbox"] {
  position: relative;
  appearance: none;
  width: 20px;
  height: 20px;
  border: 2px solid var(--border);
  border-radius: 4px;
  cursor: pointer;
  transition: all 0.2s;
}

.checklistCheckbox input[type="checkbox"]:checked {
  background: var(--primary);
  border-color: var(--primary);
}

.checklistCheckbox input[type="checkbox"]:checked::after {
  content: '✓';
  position: absolute;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%) scale(0);
  color: white;
  font-size: 14px;
  font-weight: bold;
  animation: checkPop 0.3s ease-out forwards;
}

@keyframes checkPop {
  0% {
    transform: translate(-50%, -50%) scale(0) rotate(-45deg);
    opacity: 0;
  }
  50% {
    transform: translate(-50%, -50%) scale(1.2) rotate(0deg);
  }
  100% {
    transform: translate(-50%, -50%) scale(1) rotate(0deg);
    opacity: 1;
  }
}

/* Item concluído: desliza para baixo */
.checklistItem.completed {
  animation: slideToBottom 0.4s ease-out;
}

@keyframes slideToBottom {
  from {
    transform: translateY(0);
    opacity: 1;
  }
  to {
    transform: translateY(10px);
    opacity: 0.6;
  }
}
```

---

## 📝 Documentação Obsidian

### 17. **Criar Nota no Obsidian**

```markdown
# 54-Checklist-no-Daily-Focus

## Contexto
Durante o Daily Focus, a tarefa em foco mostrava apenas título e duração. As tarefas já tinham checklist implementado (backend + API + mutações otimistas), mas esse checklist não era visível nem editável durante o foco.

## Implementação

### Frontend
- **Novo componente**: `ChecklistInFocus.tsx` (componente dedicado)
- **Funcionalidades principais**:
  - Barra de progresso visual + contagem
  - Lista de itens com checkbox 44px (WCAG AA)
  - Itens concluídos movidos para o fim (animação)
  - Seção recolhível "Mostrar/Ocultar concluídos"
  - Campo "+ Adicionar item" (mantém foco após Enter)
  - **Colar múltiplas linhas** cria vários itens
  - Edição inline (clique no texto)
  - Menu "⋯" para editar/remover
  - Modal de confirmação ao completar todos os itens

### Integrações
- **DailyFocusPage**: checklist renderizado no card de foco (após título/duração)
- **TaskSlot**: progresso "☑ 2/6" na seleção de tarefas
- **Mutations otimistas**: reutiliza `useTasks` hook existente
- **Sincronização**: cross-device via React Query + SSE

### Ajustes visuais
- Botão "Retomar" vs "Iniciar" corrigido
- Banner de pausa unificado (sem colunas quebradas)
- Padding inferior em `.workLayout` (80px desktop, 100px mobile) para evitar FAB

## Arquivos
- `ChecklistInFocus.tsx` / `.module.css`
- `DailyFocusPage.tsx` (integração)
- `TaskSlot.tsx` (progresso na seleção)
- `DailyFocus.module.css` (modal + padding)

## Melhorias futuras
Ver `MELHORIAS_CHECKLIST_DAILY_FOCUS.md`:
- Atalhos de teclado (⌘+1-9, ⌘+Enter)
- Drag & drop para reordenar
- Templates de checklist
- Integração com IA (gerar checklist)
- Métricas no resumo da sessão
- Conquistas relacionadas
```

---

## 🚀 Priorização das Melhorias

### **Alta Prioridade (Quick Wins)**
1. ✅ **Toast de Feedback** (#2) — UX imediato, código simples
2. ✅ **Atalhos de Teclado** (#1) — aumenta velocidade drasticamente
3. ✅ **Batching de Adições** (#7) — corrige problema de performance
4. ✅ **Persistência do Draft** (#8) — previne perda de dados

### **Média Prioridade (Impacto Alto)**
5. ✅ **Progresso Visual Aprimorado** (#6) — celebração ao 100%
6. ✅ **Métricas no Resumo** (#10) — completa a feature
7. ✅ **Templates de Checklist** (#13) — produtividade
8. ✅ **Tratamento de Erros** (#9) — resiliência

### **Baixa Prioridade (Nice to Have)**
9. ⏳ **Drag & Drop** (#3) — complexidade vs benefício
10. ⏳ **Swipe Mobile** (#5) — Android/iOS nativo já tem gestos
11. ⏳ **Integração IA** (#12) — depende de Órbita
12. ⏳ **Subtarefas Aninhadas** (#14) — complexidade de UI

---

## 📦 Implementação Sugerida (Próximos Passos)

### Sprint 1 (1-2 dias)
- [ ] Toast com Desfazer (#2)
- [ ] Atalhos de teclado (#1)
- [ ] Batching de adições (#7)
- [ ] Persistência de draft (#8)

### Sprint 2 (2-3 dias)
- [ ] Progresso visual aprimorado (#6)
- [ ] Métricas no resumo (#10)
- [ ] Templates de checklist (#13)
- [ ] Tratamento robusto de erros (#9)

### Sprint 3 (opcional)
- [ ] Drag & drop (#3)
- [ ] Conquistas (#11)
- [ ] Integração IA (#12)

---

**Estimativa total:** 3-5 dias para todas as melhorias de alta e média prioridade.
