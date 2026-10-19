# 54 - Checklist no Daily Focus

## Contexto

Durante o Daily Focus, a tarefa em foco mostrava apenas título e duração. As tarefas já tinham **checklist implementado** (backend + API + mutações otimistas + sincronização cross-device), mas esse checklist **não era visível nem editável durante o foco**. 

O objetivo foi trazer toda a funcionalidade de checklist para dentro da sessão de foco, permitindo que o usuário veja o progresso, marque itens completos, adicione novos itens e edite — tudo sem sair do modo foco.

---

## Implementação

### **Backend**

#### Novos Endpoints

**1. POST `/tasks/:id/checklist/batch`** — adicionar múltiplos itens de uma vez

```javascript
// Entrada: { items: [{ description, parent_id, order }] }
// Saída: ChecklistItem[]
// Uso: colar múltiplas linhas ou usar templates
```

**2. PATCH `/tasks/:id/checklist/:itemId/order`** — reordenar item

```javascript
// Entrada: { newOrder: number }
// Saída: ChecklistItem
// Uso: drag & drop (futuro)
```

**Arquivos:**
- `backend/src/routes/tasks.js` (linhas 736-780, 823-845)

---

### **Frontend - API**

**Novos métodos em `tasksApi`:**

```typescript
addChecklistBatch(taskId, items)    // Batch de itens
reorderChecklistItem(taskId, itemId, newOrder)  // Reordenar
```

**Mutations otimistas adicionadas em `useTasks`:**

```typescript
addChecklistBatchMutation     // Batch com tempIds
reorderChecklistMutation      // Reordenar com optimistic update
```

**Arquivos:**
- `frontend/src/api/tasks.ts`
- `frontend/src/hooks/useTasks.ts` (linhas 512-598, retorno expandido)

---

### **Componente Principal**

**`ChecklistInFocusEnhanced.tsx`** — componente dedicado com todas as funcionalidades

**Funcionalidades principais:**

1. **Barra de progresso visual**
   - Gradiente animado (primary → primary-light → accent)
   - Contagem textual ("2 de 6 concluídos")
   - Box-shadow sutil
   - **Animação de pulso** ao completar item
   - **Celebração shake** ao atingir 100%

2. **Lista de itens**
   - Checkbox customizado com animação **checkPop** (✓ aparece com escala + rotação)
   - Área de toque 44px (WCAG AA)
   - Itens concluídos movidos para o fim (animação `slideDown`)
   - Seção recolhível "Mostrar/Ocultar concluídos"

3. **Adição de itens**
   - Campo "+ Adicionar item" mantém foco após Enter
   - **Colar múltiplas linhas** detecta `\n` e chama batch endpoint
   - **Draft persistente** via localStorage (`checklistDraft_{taskId}`)
   - Debounce de 500ms para salvar draft

4. **Edição e remoção**
   - **Edição inline:** clique no texto ativa modo edição
   - Blur/Enter/Escape salva
   - **Menu "⋯"** com opções: Editar, Remover
   - Menu fecha ao clicar fora (useEffect + ref)

5. **Toast com Desfazer**
   - "✓ Item concluído" / "Item desmarcado"
   - "Item removido" com ação Desfazer (re-adiciona)
   - "✓ N itens adicionados" (batch)
   - "Erro ao..." com duração 3s

6. **Atalhos de teclado**
   - **⌘/Ctrl + 1-9:** marcar item 1-9 rapidamente
   - **⌘/Ctrl + Enter:** adicionar item (quando input focado)
   - Dica visual: "⌘+1-9 marcar · ⌘+Enter adicionar · Colar lista"

7. **Templates de checklist**
   - `<details>` expansível com "📋 Usar template"
   - 3 presets: **Estudo** (5 itens), **Codificação** (6 itens), **Artigo** (7 itens)
   - Ao clicar, chama batch endpoint
   - Oculto em modo `compact`

8. **Estado de loading**
   - Overlay com "Salvando..." quando alguma mutation está `isPending`
   - Backdrop blur + z-index 5

9. **Celebração ao completar**
   - Toast "🎉 Checklist completo! (N itens)" com duração 2s
   - `progress100` flag → animação `celebrateShake` por 1s
   - Callback `onAllCompleted()` após 500ms (para modal de confirmação)

10. **Tratamento de erros robusto**
    - Try/catch em todas as mutations
    - Toast de erro com mensagem clara
    - Rollback automático via mutation error (useTasks já implementa)

**Arquivos:**
- `frontend/src/components/daily-focus/components/ChecklistInFocusEnhanced.tsx`
- `frontend/src/components/daily-focus/components/ChecklistInFocus.module.css`

---

### **Integrações**

#### 1. **DailyFocusPage**

**Checklist no card de foco:**

```tsx
{currentTask.supabaseId && (
  <ChecklistInFocus
    taskId={currentTask.supabaseId}
    onAllCompleted={handleChecklistComplete}
  />
)}
```

**Modal de confirmação ao completar:**

```tsx
{showChecklistCompleteModal && (
  <div className={styles.modalOverlay}>
    <div className={styles.modalContent}>
      <h3>Checklist completo! 🎉</h3>
      <p>Todos os itens de "{currentTask.title}" foram concluídos...</p>
      <button onClick={handleConfirmCompleteTask}>✓ Concluir tarefa</button>
      <button onClick={() => setShowChecklistCompleteModal(false)}>Continuar nesta</button>
    </div>
  </div>
)}
```

**Configuração localStorage:**

```typescript
const askOnComplete = localStorage.getItem('dailyFocus_askOnChecklistComplete') !== 'false';
// Padrão: true (pergunta ao completar)
```

**Métricas no resumo (`celebrate` phase):**

```tsx
{/* Após resumo emocional */}
☑ X de Y itens de checklist concluídos (Z%)
{completionRate === 100 && " — perfeito! 💯"}
```

**Função `completeSession` salva métricas:**

```typescript
checklistMetrics: {
  tasksWithChecklist: number,
  totalItems: number,
  completedItems: number,
  completionRate: number
}
```

**Arquivos:**
- `frontend/src/components/daily-focus/DailyFocusPage.tsx` (linhas 995-1008, 1109-1141, 2391-2410, modal linhas 2571-2592)
- `frontend/src/components/daily-focus/DailyFocus.module.css` (modal + `.celebrateChecklistStat`)

---

#### 2. **TaskSlot** (Seleção de Tarefas)

**Progresso do checklist:**

```tsx
{taskDetails && taskDetails.checklist_count > 0 && (
  <div className={styles.slotChecklistProgress}>
    ☑ {taskDetails.checklist_completed_count}/{taskDetails.checklist_count}
  </div>
)}
```

**useEffect para carregar detalhes:**

```typescript
useEffect(() => {
  if (slot.supabaseId) {
    tasksApi.getTask(slot.supabaseId).then(setTaskDetails);
  }
}, [slot.supabaseId]);
```

**Arquivos:**
- `frontend/src/components/daily-focus/components/TaskSlot.tsx`
- `frontend/src/components/daily-focus/DailyFocus.module.css` (`.slotChecklistProgress`)

---

### **Ajustes Visuais**

#### 1. **Botão "Retomar" vs "Iniciar"**

**Antes:** sempre mostrava "Iniciar"

**Depois:**

```typescript
{timerRunning
  ? "⏸ Pausar"
  : timerRemaining === totalSecs
    ? "▶ Iniciar"
    : "▶ Retomar"}
```

#### 2. **Banner de pausa unificado**

**Antes:** colunas quebradas ("pausado há 15 min", "mais de 5 min")

**Depois:** mensagem única clara

```tsx
{rushMode
  ? "Entre tarefas — monte sua sessão"
  : pausedLabel
    ? `Timer pausado há ${pausedLabel.replace('pausado há ', '')} — clique em Retomar`
    : "Timer pausado — clique em Retomar"}
```

#### 3. **Padding inferior para FAB**

```css
.workLayout {
  padding-bottom: 80px; /* Desktop */
}

@media (max-width: 480px) {
  .workLayout {
    padding-bottom: 100px; /* Mobile */
  }
}
```

**Evita:** botão "+" flutuante cobrir botão "Retomar"

---

## Estilos CSS (Destaques)

### **Checkbox Customizado**

```css
input[type="checkbox"] {
  appearance: none;
  width: 20px;
  height: 20px;
  border: 2px solid var(--border);
  border-radius: 4px;
}

input[type="checkbox"]:checked {
  background: var(--primary);
  border-color: var(--primary);
}

input[type="checkbox"]:checked::after {
  content: '✓';
  animation: checkPop 0.3s ease-out forwards;
}

@keyframes checkPop {
  0% {
    transform: translate(-50%, -50%) scale(0) rotate(-45deg);
  }
  50% {
    transform: translate(-50%, -50%) scale(1.2) rotate(0deg);
  }
  100% {
    transform: translate(-50%, -50%) scale(1) rotate(0deg);
  }
}
```

### **Barra de Progresso com Celebração**

```css
.checklistProgressFill {
  background: linear-gradient(90deg, primary 0%, primary-light 50%, accent 100%);
  box-shadow: 0 0 8px rgba(79, 70, 229, 0.3);
  transition: width 0.4s cubic-bezier(0.4, 0, 0.2, 1);
}

.checklistProgressFill.justCompleted {
  animation: progressPulse 0.3s ease-out;
}

.checklistProgressBar.celebrate {
  animation: celebrateShake 0.5s ease-in-out;
}
```

### **Templates**

```css
.templatesSection summary {
  list-style: none;
  cursor: pointer;
}

.templateBtn:hover {
  background: var(--primary);
  color: white;
  transform: translateY(-1px);
}
```

---

## Fluxo de Dados

```
User Action
    ↓
ChecklistInFocusEnhanced (onChange/onPaste/onKeyDown)
    ↓
handleAdd / handleAddMultiple / handleToggle
    ↓
useTasks mutations (addChecklistMutation / addChecklistBatchMutation / toggleChecklistMutation)
    ↓
onMutate: Optimistic Update (React Query Cache com tempIds)
    ↓ (UI atualiza imediatamente)
    ↓
tasksApi → queueableTaskMutation (offline support)
    ↓
HTTP Request → Backend (batch ou single)
    ↓
Prisma Transaction
    ├─ ChecklistItem.create / .update / .delete
    ├─ Task.update { version: { increment: 1 } }
    └─ TaskChange.create (auditoria)
    ↓
Response com novo estado
    ↓
onSuccess: Merge tempIds → IDs reais
    ↓
markSynced() → broadcast SSE para outras abas
    ↓
UI final sincronizada
    ↓
Toast com Desfazer (opcional)
```

---

## Métricas e Conquistas

### **Registradas no `addSession`:**

```typescript
{
  checklistMetrics: {
    tasksWithChecklist: number,
    totalItems: number,
    completedItems: number,
    completionRate: number
  }
}
```

### **Exibidas no `celebrate`:**

```
☑ 12 de 15 itens de checklist concluídos (80%)
☑ 5 de 5 itens de checklist concluídos (100%) — perfeito! 💯
```

### **Conquistas Futuras (Sugeridas):**

- **"Mestre do Checklist"** — Completou 100 itens de checklist
- **"Perfeccionista"** — Completou 10 checklists inteiros (100%)
- **"Velocidade Máxima"** — Completou checklist 5+ itens em <10min

---

## Configuração

### **localStorage Keys**

```typescript
// Draft do input de adição
checklistDraft_{taskId}: string

// Perguntar ao completar todos os itens
dailyFocus_askOnChecklistComplete: "true" | "false" (padrão: "true")
```

### **CSS Variables Usadas**

```css
--surface, --surface-subtle, --surface-hover
--border, --border-hover
--text, --text-muted
--primary, --primary-light, --primary-dark, --accent
--danger, --danger-bg
```

---

## Responsividade

### **Desktop**
- Checklist max-height: 40vh
- Padding workLayout: 80px
- Templates em linha (flex-wrap)

### **Mobile (max-width: 480px)**
- Checklist max-height: 30vh
- Padding workLayout: 100px
- Templates em coluna
- Hints reduzidas (font-size: 10px)
- Área de toque preservada (44px)

---

## Testes Realizados

- [x] Adicionar item com timer rodando
- [x] Adicionar item com timer pausado
- [x] Marcar item (animação de check + mover para o fim)
- [x] Completar todos itens (celebração + modal)
- [x] Colar lista de 5 linhas (batch)
- [x] Editar item inline
- [x] Remover item via menu
- [x] Toast com Desfazer
- [x] Atalhos ⌘+1-9, ⌘+Enter
- [x] Templates
- [x] Draft persistente
- [x] Progresso na seleção de tarefas
- [x] Métricas no resumo
- [x] Sincronização cross-device
- [x] Mobile 390px (FAB não cobre controles)
- [x] Botão "Retomar" vs "Iniciar"
- [x] Banner de pausa unificado

---

## Melhorias Futuras

Ver `MELHORIAS_CHECKLIST_DAILY_FOCUS.md` para lista completa:

### **Implementadas Nesta Versão:**
1. ✅ Toast de Feedback
2. ✅ Atalhos de Teclado
3. ✅ Batching de Adições
4. ✅ Persistência de Draft
5. ✅ Progresso Visual Aprimorado
6. ✅ Métricas no Resumo
7. ✅ Templates de Checklist
8. ✅ Tratamento de Erros Robusto
9. ✅ Animações de Micro-interação

### **Pendentes:**
10. ⏳ Drag & Drop para Reordenar (endpoint já criado)
11. ⏳ Swipe Mobile (deslizar para marcar/remover)
12. ⏳ Integração IA (gerar checklist com Órbita)
13. ⏳ Conquistas (Mestre do Checklist, etc.)
14. ⏳ Subtarefas Aninhadas (backend já suporta `parent_id`)
15. ⏳ Modo Compacto no Card Flutuante

---

## Arquivos Modificados/Criados

### **Backend:**
- `backend/src/routes/tasks.js` (+46 linhas: batch + reorder)

### **Frontend - API:**
- `frontend/src/api/tasks.ts` (+4 métodos)
- `frontend/src/hooks/useTasks.ts` (+86 linhas: 2 mutations + handlers)

### **Frontend - Componentes:**
- `frontend/src/components/daily-focus/components/ChecklistInFocusEnhanced.tsx` (NOVO, 416 linhas)
- `frontend/src/components/daily-focus/components/ChecklistInFocus.module.css` (+120 linhas: templates, hints, loading, animações)
- `frontend/src/components/daily-focus/DailyFocusPage.tsx` (+60 linhas: integração, métricas, modal)
- `frontend/src/components/daily-focus/DailyFocus.module.css` (+25 linhas: modal, checklist stat, padding)
- `frontend/src/components/daily-focus/components/TaskSlot.tsx` (+12 linhas: progresso)

### **Documentação:**
- `CHECKLIST_IMPLEMENTATION.md` (resumo inicial)
- `MELHORIAS_CHECKLIST_DAILY_FOCUS.md` (17 melhorias sugeridas)
- `obsidian-generalmast/54-Checklist-no-Daily-Focus.md` (esta nota)

---

## Linha do Tempo

- **2026-10-11:** Implementação inicial (basic)
- **2026-10-12:** Implementação completa com TODAS as melhorias

---

## Links Relacionados

- [[29-Atividade-Continua-Daily-Focus]] — padrão de persistência (localStorage + sync)
- [[38-Fluxo-Direto-e-Checkpoint-Emocional]] — checkpoint + métricas no celebrate
- [[40-Melhorias-Captura-Rapida]] — toast com Desfazer, draft persistente
- [[41-Metricas-Ricas-e-Robustez-Tempo-Modo]] — padrão de métricas detalhadas
- [[9-Cache-Sync-e-Versionamento]] — mutations otimistas + rollback

---

**Status:** ✅ Implementado (completo)
**Versão:** 2.0 (com todas as melhorias)
