import { useEffect } from "react";
import SubtaskFlow from "./SubtaskFlow";
import SubtaskInline from "./SubtaskInline";
import styles from "./session.module.css";

/**
 * WorkingTask — bloco "trabalhando na tarefa" comum às sessões.
 *
 * Renderiza (opcionalmente) um selo/pill, o título/descrição da tarefa, as subtarefas
 * com auto-avanço (SubtaskFlow) e as ações (concluir / trocar / adicionar subtarefa).
 *
 * Props:
 *   task              : tarefa "ao vivo" (com checklist)
 *   badge             : node opcional exibido acima (cycleBadge / infoPill)
 *   completeLabel     : texto do botão de concluir
 *   onComplete        : () => void  — concluir a tarefa (também usado por onAllDone/onSkip)
 *   onToggleChecklist : (taskId, itemId) => void
 *   onAddChecklist    : (taskId, desc) => void   — se ausente, não mostra "adicionar subtarefa"
 *   onSwap            : () => void   — trocar tarefa (opcional)
 *   swapLabel         : texto do botão de trocar
 *   children          : ações extras (ex.: "salvar para depois")
 */
export default function WorkingTask({
  task,
  badge,
  completeLabel = "✅ Concluída!",
  onComplete,
  onToggleChecklist,
  onAddChecklist,
  onSwap,
  swapLabel = "Trocar tarefa",
  children,
}) {
  const hasChecklist = task.checklist?.length > 0;

  // Atalho de teclado: Enter conclui a tarefa (quando não há checklist e não há input focado)
  useEffect(() => {
    if (hasChecklist || !onComplete) return;
    const handler = (e) => {
      if (e.key === "Enter" && !["INPUT", "TEXTAREA", "SELECT", "BUTTON"].includes(e.target.tagName)) {
        e.preventDefault();
        onComplete();
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [hasChecklist, onComplete]);

  return (
    <>
      {badge}
      <div className={styles.taskDisplay}>
        <span className={styles.taskName}>{task.title}</span>
        {task.description && <span className={styles.taskMeta}>{task.description}</span>}
        {hasChecklist && (
          <SubtaskFlow
            checklist={task.checklist}
            onToggle={(itemId) => onToggleChecklist?.(task.id, itemId)}
            onAllDone={onComplete}
            onSkip={onComplete}
          />
        )}
      </div>
      <div className={styles.actions}>
        {!hasChecklist && onComplete && (
          <button className={`${styles.btn} ${styles.btnSuccess}`} onClick={onComplete} title="Enter">
            {completeLabel}
          </button>
        )}
        {children}
        {onSwap && (
          <button className={`${styles.btn} ${styles.btnSecondary}`} onClick={onSwap}>
            {swapLabel}
          </button>
        )}
        {onAddChecklist && <SubtaskInline taskId={task.id} onAdd={onAddChecklist} />}
      </div>
    </>
  );
}
