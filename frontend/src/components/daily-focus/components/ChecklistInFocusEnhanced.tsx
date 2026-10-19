import { useState, useCallback, useEffect, useMemo, useRef } from "react";
import { useTasks } from "../../../hooks/useTasks";
import { TaskChecklistItem } from "../../../types/tasks";
import { useToast } from "../../shared/Toast";
import styles from "./ChecklistInFocus.module.css";

interface ChecklistInFocusProps {
  taskId: string;
  onAllCompleted?: () => void;
  compact?: boolean;
}

const DRAFT_KEY_PREFIX = "checklistDraft_";
const TEMPLATES = {
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

export function ChecklistInFocus({ taskId, onAllCompleted, compact = false }: ChecklistInFocusProps) {
  const {
    data: tasks,
    addChecklistMutation,
    addChecklistBatchMutation,
    toggleChecklistMutation,
    updateChecklistMutation,
    deleteChecklistMutation,
  } = useTasks();
  const { showToast } = useToast();

  const [newItemText, setNewItemText] = useState(() => {
    try {
      return localStorage.getItem(DRAFT_KEY_PREFIX + taskId) || "";
    } catch {
      return "";
    }
  });
  const [editingId, setEditingId] = useState<string | number | null>(null);
  const [editText, setEditText] = useState("");
  const [showCompleted, setShowCompleted] = useState(false);
  const [showAddField, setShowAddField] = useState(false);
  const [showTemplates, setShowTemplates] = useState(false);
  const [progress100, setProgress100] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const task = tasks?.find((t) => t.id === taskId);

  const checklist = useMemo(() => task?.checklist || [], [task?.checklist]);
  const completed = useMemo(() => checklist.filter((item) => item.completed), [checklist]);
  const active = useMemo(() => checklist.filter((item) => !item.completed).sort((a, b) => (a.order || 0) - (b.order || 0)), [checklist]);
  const totalCount = checklist.length;
  const completedCount = completed.length;
  const progress = totalCount > 0 ? (completedCount / totalCount) * 100 : 0;
  const hasChecklist = totalCount > 0;

  const isLoading =
    addChecklistMutation.isPending ||
    addChecklistBatchMutation.isPending ||
    toggleChecklistMutation.isPending ||
    updateChecklistMutation.isPending ||
    deleteChecklistMutation.isPending;

  // Salvar draft com debounce
  useEffect(() => {
    const timer = setTimeout(() => {
      try {
        if (newItemText.trim()) {
          localStorage.setItem(DRAFT_KEY_PREFIX + taskId, newItemText);
        } else {
          localStorage.removeItem(DRAFT_KEY_PREFIX + taskId);
        }
      } catch {}
    }, 500);
    return () => clearTimeout(timer);
  }, [newItemText, taskId]);

  // Atalhos de teclado
  useEffect(() => {
    const handleKeyboard = (e: KeyboardEvent) => {
      // Ctrl/⌘ + Enter: adicionar item rápido
      if ((e.ctrlKey || e.metaKey) && e.key === 'Enter' && newItemText && document.activeElement === inputRef.current) {
        e.preventDefault();
        handleAdd(newItemText);
      }

      // Ctrl/⌘ + 1-9: marcar item 1-9 rapidamente
      if ((e.ctrlKey || e.metaKey) && /^[1-9]$/.test(e.key) && !editingId) {
        e.preventDefault();
        const idx = parseInt(e.key) - 1;
        if (active[idx]) handleToggle(active[idx].id);
      }
    };

    window.addEventListener('keydown', handleKeyboard);
    return () => window.removeEventListener('keydown', handleKeyboard);
  }, [newItemText, active, editingId]);

  const handleToggle = useCallback(
    async (itemId: string | number) => {
      const item = checklist.find((i) => i.id === itemId);
      if (!item) return;

      const wasCompleted = item.completed;

      try {
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

        // Verificar se todos foram concluídos após o toggle
        const newCompleted = wasCompleted ? completedCount - 1 : completedCount + 1;
        if (newCompleted === totalCount && totalCount > 0) {
          setProgress100(true);
          setTimeout(() => setProgress100(false), 1000);

          showToast(`🎉 Checklist completo! (${totalCount} itens)`, { duration: 2000 });

          if (onAllCompleted) {
            setTimeout(() => onAllCompleted(), 500);
          }
        }
      } catch (error) {
        console.error('Erro ao marcar item:', error);
        showToast("Erro ao marcar item. Tente novamente.", { duration: 3000 });
      }
    },
    [taskId, checklist, completedCount, totalCount, toggleChecklistMutation, onAllCompleted, showToast]
  );

  const handleAdd = useCallback(
    async (description: string) => {
      if (!description.trim()) return;

      try {
        await addChecklistMutation.mutateAsync({
          taskId,
          description: description.trim(),
          parentId: null,
        });
        setNewItemText("");
        localStorage.removeItem(DRAFT_KEY_PREFIX + taskId);

        // Manter foco no input
        setTimeout(() => inputRef.current?.focus(), 10);
      } catch (error) {
        console.error('Erro ao adicionar item:', error);
        showToast("Erro ao adicionar item. Tente novamente.", { duration: 3000 });
      }
    },
    [taskId, addChecklistMutation, showToast]
  );

  const handleAddMultiple = useCallback(
    async (descriptions: string[]) => {
      const items = descriptions
        .filter(d => d.trim())
        .map(d => ({ description: d.trim(), parent_id: null }));

      if (!items.length) return;

      try {
        await addChecklistBatchMutation.mutateAsync({ taskId, items });
        setNewItemText("");
        localStorage.removeItem(DRAFT_KEY_PREFIX + taskId);

        showToast(`✓ ${items.length} itens adicionados`, { duration: 2000 });
      } catch (error) {
        console.error('Erro ao adicionar itens:', error);
        showToast("Erro ao adicionar itens. Tente novamente.", { duration: 3000 });
      }
    },
    [taskId, addChecklistBatchMutation, showToast]
  );

  const handlePaste = useCallback(
    (e: React.ClipboardEvent<HTMLInputElement>) => {
      const text = e.clipboardData.getData("text");
      const lines = text.split("\n").filter((line) => line.trim());

      if (lines.length > 1) {
        e.preventDefault();
        handleAddMultiple(lines);
      }
    },
    [handleAddMultiple]
  );

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLInputElement>) => {
      if (e.key === "Enter") {
        e.preventDefault();
        handleAdd(newItemText);
      }
    },
    [newItemText, handleAdd]
  );

  const handleStartEdit = useCallback((itemId: string | number, currentText: string) => {
    setEditingId(itemId);
    setEditText(currentText);
  }, []);

  const handleSaveEdit = useCallback(
    async (itemId: string | number) => {
      if (!editText.trim()) {
        setEditingId(null);
        return;
      }

      const item = checklist.find((i) => i.id === itemId);
      if (item && editText.trim() !== item.description) {
        try {
          await updateChecklistMutation.mutateAsync({
            taskId,
            itemId: String(itemId),
            fields: { description: editText.trim() },
          });
        } catch (error) {
          console.error('Erro ao editar item:', error);
          showToast("Erro ao editar item. Tente novamente.", { duration: 3000 });
        }
      }
      setEditingId(null);
    },
    [taskId, editText, checklist, updateChecklistMutation, showToast]
  );

  const handleDelete = useCallback(
    async (itemId: string | number) => {
      if (confirm("Remover este item?")) {
        try {
          const item = checklist.find((i) => i.id === itemId);
          await deleteChecklistMutation.mutateAsync({ taskId, itemId: String(itemId) });

          // Toast com Desfazer
          if (item) {
            showToast("Item removido", {
              action: {
                label: "Desfazer",
                onClick: async () => {
                  await addChecklistMutation.mutateAsync({
                    taskId,
                    description: item.description,
                    parentId: null,
                  });
                }
              },
              duration: 5000
            });
          }
        } catch (error) {
          console.error('Erro ao remover item:', error);
          showToast("Erro ao remover item. Tente novamente.", { duration: 3000 });
        }
      }
    },
    [taskId, checklist, deleteChecklistMutation, addChecklistMutation, showToast]
  );

  const handleUseTemplate = useCallback((items: string[]) => {
    handleAddMultiple(items);
    setShowTemplates(false);
  }, [handleAddMultiple]);

  if (!task) return null;

  if (!hasChecklist && !showAddField) {
    return (
      <div className={styles.emptyState}>
        <button className={styles.addChecklistBtn} onClick={() => setShowAddField(true)}>
          + Adicionar checklist
        </button>
      </div>
    );
  }

  return (
    <div className={`${styles.checklistInFocus} ${compact ? styles.compact : ""}`}>
      {isLoading && <div className={styles.loadingOverlay}>Salvando...</div>}

      {hasChecklist && (
        <>
          <div className={styles.checklistProgress}>
            <div className={`${styles.checklistProgressBar} ${progress100 ? styles.celebrate : ""}`}>
              <div
                className={`${styles.checklistProgressFill} ${progress100 ? styles.justCompleted : ""}`}
                style={{ width: `${progress}%` }}
              />
            </div>
            <div className={styles.checklistProgressText}>
              {completedCount} de {totalCount} {totalCount === 1 ? "concluído" : "concluídos"}
            </div>
          </div>

          <div className={styles.checklistItems}>
            {active.map((item, index) => (
              <ChecklistItemRow
                key={item.id}
                item={item}
                index={index + 1}
                editing={editingId === item.id}
                editText={editText}
                onToggle={handleToggle}
                onStartEdit={handleStartEdit}
                onSaveEdit={handleSaveEdit}
                onSetEditText={setEditText}
                onDelete={handleDelete}
              />
            ))}

            {completed.length > 0 && (
              <>
                {showCompleted ? (
                  <>
                    {completed.map((item) => (
                      <ChecklistItemRow
                        key={item.id}
                        item={item}
                        editing={editingId === item.id}
                        editText={editText}
                        onToggle={handleToggle}
                        onStartEdit={handleStartEdit}
                        onSaveEdit={handleSaveEdit}
                        onSetEditText={setEditText}
                        onDelete={handleDelete}
                      />
                    ))}
                    <button
                      className={styles.toggleCompletedBtn}
                      onClick={() => setShowCompleted(false)}
                    >
                      Ocultar concluídos ({completed.length})
                    </button>
                  </>
                ) : (
                  <button
                    className={styles.toggleCompletedBtn}
                    onClick={() => setShowCompleted(true)}
                  >
                    Mostrar concluídos ({completed.length})
                  </button>
                )}
              </>
            )}
          </div>
        </>
      )}

      <div className={styles.checklistAddField}>
        <input
          ref={inputRef}
          type="text"
          placeholder="+ Adicionar item"
          value={newItemText}
          onChange={(e) => setNewItemText(e.target.value)}
          onKeyDown={handleKeyDown}
          onPaste={handlePaste}
          className={styles.addInput}
        />
      </div>

      {!compact && (
        <>
          <details className={styles.templatesSection} open={showTemplates}>
            <summary onClick={() => setShowTemplates(!showTemplates)}>
              📋 Usar template
            </summary>
            <div className={styles.templatesList}>
              {Object.entries(TEMPLATES).map(([key, items]) => (
                <button
                  key={key}
                  className={styles.templateBtn}
                  onClick={() => handleUseTemplate(items)}
                >
                  {key.charAt(0).toUpperCase() + key.slice(1)} ({items.length} itens)
                </button>
              ))}
            </div>
          </details>

          <div className={styles.checklistHints}>
            <span>⌘+1-9 marcar · ⌘+Enter adicionar · Colar lista</span>
          </div>
        </>
      )}
    </div>
  );
}

interface ChecklistItemRowProps {
  item: TaskChecklistItem;
  index?: number;
  editing: boolean;
  editText: string;
  onToggle: (id: string | number) => void;
  onStartEdit: (id: string | number, text: string) => void;
  onSaveEdit: (id: string | number) => void;
  onSetEditText: (text: string) => void;
  onDelete: (id: string | number) => void;
}

function ChecklistItemRow({
  item,
  index,
  editing,
  editText,
  onToggle,
  onStartEdit,
  onSaveEdit,
  onSetEditText,
  onDelete,
}: ChecklistItemRowProps) {
  const [showMenu, setShowMenu] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  // Fechar menu ao clicar fora
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setShowMenu(false);
      }
    };
    if (showMenu) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }
  }, [showMenu]);

  return (
    <div className={`${styles.checklistItem} ${item.completed ? styles.completed : ""}`}>
      <div className={styles.checklistCheckbox}>
        <input
          type="checkbox"
          checked={item.completed}
          onChange={() => onToggle(item.id)}
          aria-label={item.description}
        />
      </div>

      {editing ? (
        <input
          type="text"
          className={styles.editInput}
          value={editText}
          onChange={(e) => onSetEditText(e.target.value)}
          onBlur={() => onSaveEdit(item.id)}
          onKeyDown={(e) => {
            if (e.key === "Enter") onSaveEdit(item.id);
            if (e.key === "Escape") onSaveEdit(item.id);
          }}
          autoFocus
        />
      ) : (
        <div
          className={styles.checklistItemText}
          onClick={() => !item.completed && onStartEdit(item.id, item.description)}
          title={index ? `Item ${index} - Clique para editar` : "Clique para editar"}
        >
          {item.description}
        </div>
      )}

      <div className={styles.checklistItemActions} ref={menuRef}>
        <button
          className={styles.menuBtn}
          onClick={() => setShowMenu(!showMenu)}
          aria-label="Mais opções"
        >
          ⋯
        </button>
        {showMenu && (
          <div className={styles.menu}>
            <button onClick={() => { onStartEdit(item.id, item.description); setShowMenu(false); }}>
              Editar
            </button>
            <button onClick={() => { onDelete(item.id); setShowMenu(false); }} className={styles.deleteBtn}>
              Remover
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
