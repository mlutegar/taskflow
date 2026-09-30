import { useEffect } from "react";
import { Plus } from "lucide-react";
import ModalOverlay from "./shared/ModalOverlay";
import AddTaskForm from "./AddTaskForm";
import { useQuickTask, useQuickTaskCreate, QuickSaveResult } from "../contexts/QuickTaskContext";
import { useToast } from "./shared/Toast";
import styles from "./QuickTaskButton.module.css";

const DRAFT_KEY = "taskflow.quicktask.draft";

/** Lê o projeto do contexto da página atual (ex.: #/tasks?project=<id>). */
function projectFromUrl(): string | null {
  try {
    const hash = window.location.hash; // "#/tasks?project=abc"
    const qIndex = hash.indexOf("?");
    if (qIndex === -1) return null;
    return new URLSearchParams(hash.slice(qIndex + 1)).get("project");
  } catch {
    return null;
  }
}

/** Conteúdo do modal — isolado para que `useTasks`/`useProjects` só montem
 *  quando o modal está aberto (evita subscrições SSE/polling extras à toa). */
function QuickTaskModal({ onClose }: { onClose: () => void }): JSX.Element {
  const { save, undoCreate, projects, createProject } = useQuickTaskCreate();
  const { showToast } = useToast();
  const initialProjectId = projectFromUrl();

  const notify = (result: QuickSaveResult): void => {
    if (result.offline) {
      showToast("Tarefa salva offline — sincroniza ao reconectar", "info");
      return;
    }
    const task = result.task;
    let msg = "Tarefa criada";
    if (result.addedToToday) msg += " · adicionada a Hoje";
    else if (result.todayLimitReached) msg += " · Hoje já tem 5 tarefas";
    showToast(msg, "success", task ? {
      durationMs: 6000,
      action: { label: "Desfazer", onClick: () => { void undoCreate(task.id); } },
    } : undefined);
  };

  const handleSubmit = async (
    data: Parameters<typeof save>[0],
    opts?: { keepOpen?: boolean }
  ): Promise<void> => {
    const result = await save(data);
    notify(result);
    if (!opts?.keepOpen) onClose();
  };

  return (
    <ModalOverlay onClose={onClose} variant="side">
      <div className={styles.modalCard}>
        <AddTaskForm
          enableChecklist
          allowAddAnother
          enableAddToday
          draftKey={DRAFT_KEY}
          initialProjectId={initialProjectId}
          titlePlaceholder="Ex.: Pagar boleto amanhã 14h !alta"
          projects={projects}
          onCreateProject={createProject}
          onSubmit={handleSubmit}
          onCancel={onClose}
        />
        <p className={styles.nlHint}>
          💡 Dá pra escrever no título: <b>amanhã</b>, <b>terça</b>, <b>14h</b>, <b>!alta</b> — detectamos data, hora e prioridade.
        </p>
      </div>
    </ModalOverlay>
  );
}

interface QuickTaskButtonProps {
  /** Esconde o FAB (ex.: na página de Tarefas, onde já há botão nativo).
   *  O atalho de teclado continua funcionando. */
  hidden?: boolean;
}

/** Botão flutuante global "+ Nova tarefa" — visível em todas as páginas.
 *  Atalhos: tecla "N" (fora de campos de texto) e Ctrl/Cmd+K abrem a captura. */
export default function QuickTaskButton({ hidden = false }: QuickTaskButtonProps): JSX.Element {
  const { isOpen, open, close } = useQuickTask();

  useEffect(() => {
    const onKey = (e: KeyboardEvent): void => {
      // Ctrl/Cmd+K abre em qualquer contexto (padrão "quick add").
      if ((e.metaKey || e.ctrlKey) && (e.key === "k" || e.key === "K")) {
        e.preventDefault();
        if (!isOpen) open();
        return;
      }
      if (e.defaultPrevented || e.metaKey || e.ctrlKey || e.altKey) return;
      const target = e.target as HTMLElement | null;
      const tag = target?.tagName;
      const editable =
        tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT" || target?.isContentEditable;
      if (editable) return;
      // Tecla "N" (sem modificadores, fora de campos).
      if ((e.key === "n" || e.key === "N") && !isOpen) {
        e.preventDefault();
        open();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, isOpen]);

  return (
    <>
      {!hidden && (
        <button
          type="button"
          className={styles.fab}
          onClick={open}
          aria-label="Nova tarefa"
          title="Nova tarefa (N ou Ctrl/⌘+K)"
        >
          <Plus className={styles.fabIcon} strokeWidth={2.4} aria-hidden="true" />
          <span className={styles.fabLabel}>Nova tarefa</span>
        </button>
      )}
      {isOpen && <QuickTaskModal onClose={close} />}
    </>
  );
}
