import { useState, useEffect, useMemo, useCallback } from "react";
import { X, Check, Copy, Trash2, CheckCircle, Circle } from "lucide-react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { tasksApi } from "../api/tasks";
import { taskKeys } from "../lib/taskKeys";
import { InlineEditableTitle } from "../components/InlineEditableTitle";
import { PropertyRow } from "../components/PropertyRow";
import { useToast } from "../components/shared/Toast";
import ProjectSelect from "../components/ProjectSelect";
import { useProjects } from "../hooks/useProjects";
import { formatMinutes } from "../lib/estimatedTime";
import styles from "./TaskDetailPage.module.css";
import type { TaskRecord, TaskUpdateInput } from "../types/tasks";

interface TaskDetailPageProps {
  taskId: string;
  onClose: () => void;
}

const PRIORITY_LABELS: Record<number, string> = {
  1: "🔴 Alta",
  2: "🟡 Média",
  3: "🟡 Média",
  4: "🟢 Baixa",
};

export function TaskDetailPage({ taskId, onClose }: TaskDetailPageProps) {
  const queryClient = useQueryClient();
  const { showToast } = useToast();
  const { data: task, isLoading } = useQuery<TaskRecord>({
    queryKey: ["tasks", taskId],
    queryFn: () => tasksApi.get(taskId),
  });

  const projectsHook = useProjects();
  const [saveStatus, setSaveStatus] = useState<"idle" | "saving" | "saved">("idle");
  const [saveTimeout, setSaveTimeout] = useState<NodeJS.Timeout | null>(null);

  const updateMutation = useMutation({
    mutationFn: (data: TaskUpdateInput) => tasksApi.update(taskId, { ...data, version: task?.version }),
    onMutate: async (data) => {
      setSaveStatus("saving");
      // Cancel outgoing refetches
      await queryClient.cancelQueries({ queryKey: ["tasks", taskId] });
      // Snapshot
      const previous = queryClient.getQueryData<TaskRecord>(["tasks", taskId]);
      // Optimistic update
      if (previous) {
        queryClient.setQueryData<TaskRecord>(["tasks", taskId], { ...previous, ...data });
      }
      return { previous };
    },
    onError: (_err, _vars, context) => {
      if (context?.previous) {
        queryClient.setQueryData(["tasks", taskId], context.previous);
      }
      setSaveStatus("idle");
      showToast("Erro ao salvar", "error");
    },
    onSuccess: () => {
      setSaveStatus("saved");
      if (saveTimeout) clearTimeout(saveTimeout);
      const timeout = setTimeout(() => setSaveStatus("idle"), 2000);
      setSaveTimeout(timeout);
      // Invalidate lists
      queryClient.invalidateQueries({ queryKey: taskKeys.lists() });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: () => tasksApi.delete(taskId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: taskKeys.lists() });
      showToast("Tarefa excluída", "success");
      onClose();
    },
  });

  const handleFieldChange = useCallback(
    (field: string, value: any) => {
      updateMutation.mutate({ [field]: value } as TaskUpdateInput);
    },
    [updateMutation]
  );

  const handleDelete = useCallback(async () => {
    if (!confirm("Excluir esta tarefa permanentemente?")) return;
    deleteMutation.mutate();
  }, [deleteMutation]);

  const handleDuplicate = useCallback(async () => {
    if (!task) return;
    const newTask = await tasksApi.create({
      title: `${task.title} (cópia)`,
      description: task.description,
      priority: task.priority,
      due_date: task.due_date,
      due_time: task.due_time,
      project_id: task.project_id,
      estimated_minutes: task.estimated_minutes,
    });
    queryClient.invalidateQueries({ queryKey: taskKeys.lists() });
    showToast("Tarefa duplicada", "success");
    window.location.hash = `#task-${newTask.id}`;
  }, [task, queryClient, showToast]);

  const shareableLink = useMemo(
    () => `${window.location.origin}/tasks#task-${taskId}`,
    [taskId]
  );

  const handleCopyLink = useCallback(() => {
    navigator.clipboard.writeText(shareableLink).then(() => {
      showToast("Link copiado!", "success");
    });
  }, [shareableLink, showToast]);

  // Close with ESC
  useEffect(() => {
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handleEsc);
    return () => window.removeEventListener("keydown", handleEsc);
  }, [onClose]);

  if (isLoading) {
    return (
      <div className={styles.overlay}>
        <div className={styles.backdrop} onClick={onClose} />
        <div className={styles.modal}>
          <div className={styles.loading}>Carregando...</div>
        </div>
      </div>
    );
  }

  if (!task) {
    return (
      <div className={styles.overlay}>
        <div className={styles.backdrop} onClick={onClose} />
        <div className={styles.modal}>
          <div className={styles.error}>Tarefa não encontrada</div>
        </div>
      </div>
    );
  }

  return (
    <div className={styles.overlay}>
      <div className={styles.backdrop} onClick={onClose} />

      <div className={styles.modal}>
        <header className={styles.header}>
          <button className={styles.backBtn} onClick={onClose} type="button">
            <X size={20} />
            <span>Voltar</span>
          </button>
          <div className={styles.saveIndicator}>
            {saveStatus === "saving" && "Salvando..."}
            {saveStatus === "saved" && "✓ Salvo"}
          </div>
        </header>

        <div className={styles.content}>
          {/* Título editável */}
          <InlineEditableTitle
            value={task.title}
            onChange={(title) => handleFieldChange("title", title)}
            placeholder="Título da tarefa"
          />

          {/* Status */}
          <div className={styles.statusRow}>
            <button
              className={`${styles.statusBtn} ${task.completed ? styles.completed : ""}`}
              onClick={() => handleFieldChange("completed", !task.completed)}
              type="button"
            >
              {task.completed ? <CheckCircle size={18} /> : <Circle size={18} />}
              {task.completed ? "Concluída" : "Em andamento"}
            </button>
          </div>

          {/* Descrição */}
          <section className={styles.section}>
            <h3>Descrição</h3>
            <textarea
              className={styles.description}
              value={task.description || ""}
              onChange={(e) => handleFieldChange("description", e.target.value)}
              placeholder="Adicione detalhes, links, informações..."
              rows={6}
            />
          </section>

          {/* Propriedades */}
          <section className={styles.section}>
            <h3>Propriedades</h3>
            <div className={styles.properties}>
              <PropertyRow label="Projeto">
                <ProjectSelect
                  projects={projectsHook.projects}
                  value={task.project_id || ""}
                  onChange={(value) => handleFieldChange("project_id", value || null)}
                  allowNone
                />
              </PropertyRow>

              <PropertyRow label="Prioridade">
                <select
                  className={styles.select}
                  value={task.priority}
                  onChange={(e) => handleFieldChange("priority", Number(e.target.value))}
                >
                  <option value={1}>🔴 Alta</option>
                  <option value={2}>🟡 Média</option>
                  <option value={3}>🟡 Média</option>
                  <option value={4}>🟢 Baixa</option>
                </select>
              </PropertyRow>

              <PropertyRow label="Vencimento">
                <div className={styles.dateTimeRow}>
                  <input
                    type="date"
                    className={styles.input}
                    value={task.due_date || ""}
                    onChange={(e) => handleFieldChange("due_date", e.target.value || null)}
                  />
                  <input
                    type="time"
                    className={styles.input}
                    value={task.due_time || ""}
                    onChange={(e) => handleFieldChange("due_time", e.target.value || null)}
                  />
                </div>
              </PropertyRow>

              <PropertyRow label="Tempo estimado">
                <div className={styles.timeRow}>
                  <input
                    type="number"
                    className={styles.input}
                    value={task.estimated_minutes || ""}
                    onChange={(e) =>
                      handleFieldChange(
                        "estimated_minutes",
                        e.target.value ? Number(e.target.value) : null
                      )
                    }
                    placeholder="Minutos"
                    min="0"
                  />
                  {task.estimated_minutes && (
                    <span className={styles.timeLabel}>{formatMinutes(task.estimated_minutes)}</span>
                  )}
                </div>
              </PropertyRow>

              <PropertyRow label="Tempo real gasto">
                <div className={styles.timeRow}>
                  <input
                    type="number"
                    className={styles.input}
                    value={task.actual_minutes || ""}
                    onChange={(e) =>
                      handleFieldChange("actual_minutes", e.target.value ? Number(e.target.value) : null)
                    }
                    placeholder="Minutos"
                    min="0"
                  />
                  {task.actual_minutes ? (
                    <span className={styles.timeLabel}>{formatMinutes(task.actual_minutes)}</span>
                  ) : (
                    <span className={styles.timeLabelEmpty}>Não registrado</span>
                  )}
                </div>
              </PropertyRow>
            </div>
          </section>

          {/* Atividade */}
          <section className={styles.section}>
            <h3>Atividade</h3>
            <div className={styles.timeline}>
              {task.created_at && (
                <div className={styles.event}>
                  <span className={styles.timestamp}>
                    {new Date(task.created_at).toLocaleDateString("pt-BR", {
                      day: "2-digit",
                      month: "short",
                      year: "numeric",
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                  </span>
                  <span className={styles.description}>Tarefa criada</span>
                </div>
              )}
              {task.updated_at && task.updated_at !== task.created_at && (
                <div className={styles.event}>
                  <span className={styles.timestamp}>
                    {new Date(task.updated_at).toLocaleDateString("pt-BR", {
                      day: "2-digit",
                      month: "short",
                      year: "numeric",
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                  </span>
                  <span className={styles.description}>Última edição</span>
                </div>
              )}
              {task.completed_at && (
                <div className={styles.event}>
                  <span className={styles.timestamp}>
                    {new Date(task.completed_at).toLocaleDateString("pt-BR", {
                      day: "2-digit",
                      month: "short",
                      year: "numeric",
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                  </span>
                  <span className={styles.description}>Concluída</span>
                </div>
              )}
            </div>
          </section>
        </div>

        <footer className={styles.footer}>
          <button className={styles.actionBtn} onClick={handleDuplicate} type="button">
            <Copy size={16} />
            Duplicar
          </button>
          <button className={styles.actionBtn} onClick={handleCopyLink} type="button">
            <Copy size={16} />
            Copiar link
          </button>
          <button className={`${styles.actionBtn} ${styles.danger}`} onClick={handleDelete} type="button">
            <Trash2 size={16} />
            Excluir
          </button>
        </footer>
      </div>
    </div>
  );
}
