import { useState, useCallback, FormEvent, KeyboardEvent, ClipboardEvent } from "react";
import { useTasks } from "../../../hooks/useTasks";
import { TaskChecklistItem } from "../../../types/tasks";
import styles from "./ChecklistInFocus.module.css";

interface ChecklistInFocusProps {
  taskId: string;
  onAllCompleted?: () => void;
  compact?: boolean;
}

export function ChecklistInFocus({ taskId, onAllCompleted, compact = false }: ChecklistInFocusProps) {
  const { data: tasks, addChecklistMutation, toggleChecklistMutation, updateChecklistMutation, deleteChecklistMutation } = useTasks();

  const [newItemText, setNewItemText] = useState("");
  const [editingId, setEditingId] = useState<string | number | null>(null);
  const [editText, setEditText] = useState("");
  const [showCompleted, setShowCompleted] = useState(false);
  const [showAddField, setShowAddField] = useState(false);

  const task = tasks?.find((t) => t.id === taskId);

  if (!task) return null;

  const checklist = task.checklist || [];
  const completed = checklist.filter((item) => item.completed);
  const active = checklist.filter((item) => !item.completed);
  const totalCount = checklist.length;
  const completedCount = completed.length;
  const progress = totalCount > 0 ? (completedCount / totalCount) * 100 : 0;

  const hasChecklist = totalCount > 0;

  const handleToggle = useCallback(
    async (itemId: string | number) => {
      const item = checklist.find((i) => i.id === itemId);
      if (!item) return;

      await toggleChecklistMutation.mutateAsync({ taskId, itemId: String(itemId) });

      // Verificar se todos foram concluídos após o toggle
      const newCompleted = item.completed ? completedCount - 1 : completedCount + 1;
      if (newCompleted === totalCount && totalCount > 0 && onAllCompleted) {
        setTimeout(() => onAllCompleted(), 500); // delay para animação
      }
    },
    [taskId, checklist, completedCount, totalCount, toggleChecklistMutation, onAllCompleted]
  );

  const handleAdd = useCallback(
    async (description: string) => {
      if (!description.trim()) return;
      await addChecklistMutation.mutateAsync({
        taskId,
        description: description.trim(),
        parentId: null,
      });
      setNewItemText("");
    },
    [taskId, addChecklistMutation]
  );

  const handleAddMultiple = useCallback(
    async (descriptions: string[]) => {
      for (const desc of descriptions) {
        if (desc.trim()) {
          await addChecklistMutation.mutateAsync({
            taskId,
            description: desc.trim(),
            parentId: null,
          });
        }
      }
      setNewItemText("");
    },
    [taskId, addChecklistMutation]
  );

  const handlePaste = useCallback(
    (e: ClipboardEvent<HTMLInputElement>) => {
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
    (e: KeyboardEvent<HTMLInputElement>) => {
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
        await updateChecklistMutation.mutateAsync({
          taskId,
          itemId: String(itemId),
          fields: { description: editText.trim() },
        });
      }
      setEditingId(null);
    },
    [taskId, editText, checklist, updateChecklistMutation]
  );

  const handleDelete = useCallback(
    async (itemId: string | number) => {
      if (confirm("Remover este item?")) {
        await deleteChecklistMutation.mutateAsync({ taskId, itemId: String(itemId) });
      }
    },
    [taskId, deleteChecklistMutation]
  );

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
      {hasChecklist && (
        <>
          <div className={styles.checklistProgress}>
            <div className={styles.checklistProgressBar}>
              <div
                className={styles.checklistProgressFill}
                style={{ width: `${progress}%` }}
              />
            </div>
            <div className={styles.checklistProgressText}>
              {completedCount} de {totalCount} {totalCount === 1 ? "concluído" : "concluídos"}
            </div>
          </div>

          <div className={styles.checklistItems}>
            {active.map((item) => (
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
          type="text"
          placeholder="+ Adicionar item"
          value={newItemText}
          onChange={(e) => setNewItemText(e.target.value)}
          onKeyDown={handleKeyDown}
          onPaste={handlePaste}
          className={styles.addInput}
        />
      </div>
    </div>
  );
}

interface ChecklistItemRowProps {
  item: TaskChecklistItem;
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
  editing,
  editText,
  onToggle,
  onStartEdit,
  onSaveEdit,
  onSetEditText,
  onDelete,
}: ChecklistItemRowProps) {
  const [showMenu, setShowMenu] = useState(false);

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
        >
          {item.description}
        </div>
      )}

      <div className={styles.checklistItemActions}>
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
