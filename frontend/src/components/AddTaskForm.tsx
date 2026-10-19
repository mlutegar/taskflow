import { useState, useRef, useEffect } from "react";
import { taskSchema } from "../lib/schemas";
import styles from "./AddTaskForm.module.css";
import RecurrenceFields, { RecurrenceRule } from "./RecurrenceFields";
import ProjectSelect from "./ProjectSelect";
import QuickCreateProject from "./QuickCreateProject";
import { Project, ProjectInput } from "../api/projects";
import EstimatedTimeSelect from "./EstimatedTimeSelect";
import { formatMinutes, getCalibrationFactor } from "../lib/estimatedTime";
import DescriptionEditor from "./DescriptionEditor";
import { todayISO, daysAgoISO, dueDateLabel } from "../lib/dateUtils";

interface AddTaskFormProps {
  onSubmit: (task: {
    title: string;
    description: string | null;
    priority: number;
    due_date: string | null;
    due_time: string | null;
    recurrence: string | null;
    recurrence_rule: RecurrenceRule | null;
    project_id: string | null;
    estimated_minutes: number | null;
    // Lista de subtarefas (apenas quando `enableChecklist`). O caller cria a
    // tarefa e, em seguida, cada item do checklist. Opcional/ignorado quando
    // o formulário é usado sem checklist inline.
    checklist?: string[];
    // Marcar para entrar nas "Tarefas de Hoje" (apenas quando `enableAddToday`).
    add_to_today?: boolean;
  }, opts?: { keepOpen?: boolean }) => Promise<void>;
  onCancel: () => void;
  projects?: Project[];
  onCreateProject?: (data: ProjectInput) => Promise<Project>;
  // Habilita a seção de subtarefas (usado na captura rápida global). Default
  // false → a página de Tarefas segue criando checklist depois, como hoje.
  enableChecklist?: boolean;
  // Projeto pré-selecionado (ex.: capturado do contexto da página atual).
  initialProjectId?: string | null;
  // Mostra o botão "Criar e adicionar outra" (captura rápida em sequência).
  allowAddAnother?: boolean;
  // Mostra o checkbox "Adicionar às Tarefas de Hoje".
  enableAddToday?: boolean;
  // Chave para persistir rascunho (título/descrição) no localStorage.
  draftKey?: string;
  // Placeholder do campo título (permite sugerir linguagem natural na captura rápida).
  titlePlaceholder?: string;
  // Recorrência pré-selecionada (ex.: "daily" ao criar uma rotina pelo painel
  // Rotina Diária). Quando preenchida, "Mais opções" já abre expandido para o
  // usuário ver que a repetição está marcada.
  initialRecurrence?: string | null;
  initialRecurrenceRule?: RecurrenceRule | null;
}

interface QuickDraft { title?: string; description?: string }

function loadDraft(key?: string): QuickDraft {
  if (!key) return {};
  try { return JSON.parse(localStorage.getItem(key) || "{}") as QuickDraft; } catch { return {}; }
}
function saveDraft(key: string | undefined, draft: QuickDraft): void {
  if (!key) return;
  try {
    if (!draft.title && !draft.description) localStorage.removeItem(key);
    else localStorage.setItem(key, JSON.stringify(draft));
  } catch { /* storage cheio/indisponível — ignora */ }
}

interface FieldErrors {
  title?: string;
  description?: string;
  due_date?: string;
  [key: string]: string | undefined;
}

const DESC_MAX = 10000;

const PRIORITIES = [
  { value: 1, label: "Crítica", dot: "🔴" },
  { value: 2, label: "Alta", dot: "🟠" },
  { value: 3, label: "Média", dot: "🟡" },
  { value: 4, label: "Baixa", dot: "🟢" },
];

export default function AddTaskForm({ onSubmit, onCancel, projects = [], onCreateProject, enableChecklist = false, initialProjectId = null, allowAddAnother = false, enableAddToday = false, draftKey, titlePlaceholder = "Título da tarefa *", initialRecurrence = null, initialRecurrenceRule = null }: AddTaskFormProps) {
  const initialDraft = loadDraft(draftKey);
  const [title, setTitle] = useState<string>(initialDraft.title ?? "");
  const [description, setDescription] = useState<string>(initialDraft.description ?? "");
  const [priority, setPriority] = useState<number>(4);
  const [dueDate, setDueDate] = useState<string>("");
  const [dueTime, setDueTime] = useState<string>("");
  // Subtarefas locais (staged) — só quando enableChecklist. Criadas pelo caller
  // após o POST /tasks retornar o id.
  const [checklist, setChecklist] = useState<string[]>([]);
  const [checklistDraft, setChecklistDraft] = useState<string>("");
  const [recurrence, setRecurrence] = useState<string>(initialRecurrence ?? "");
  const [recurrenceRule, setRecurrenceRule] = useState<RecurrenceRule | null>(initialRecurrenceRule);
  const [projectId, setProjectId] = useState<string | null>(initialProjectId);
  const [estimatedMinutes, setEstimatedMinutes] = useState<number | null>(null);
  const [addToToday, setAddToToday] = useState<boolean>(false);
  const [saving, setSaving] = useState<boolean>(false);
  // Com recorrência pré-definida, abre expandido: o usuário precisa ver que a
  // repetição já está marcada (e poder trocá-la).
  const [showAdvanced, setShowAdvanced] = useState<boolean>(Boolean(initialRecurrence));
  const [errors, setErrors] = useState<FieldErrors>({});
  const titleRef = useRef<HTMLInputElement>(null);

  // Persiste rascunho de título/descrição (se draftKey) — evita perder a ideia
  // ao fechar sem querer. Limpo após salvar com sucesso.
  useEffect(() => {
    saveDraft(draftKey, { title, description });
  }, [draftKey, title, description]);

  // Quick-create de projeto inline
  const [creatingProject, setCreatingProject] = useState<boolean>(false);
  const [justCreatedId, setJustCreatedId] = useState<string | null>(null);

  const handleProjectCreated = (project: Project): void => {
    handleProjectChange(project.id);
    setCreatingProject(false);
    setJustCreatedId(project.id);
    setTimeout(() => setJustCreatedId(null), 2500);
  };

  const calibration = getCalibrationFactor();

  // Ao escolher um projeto, herda o tempo estimado padrão dele (se houver e se
  // o usuário ainda não definiu uma estimativa manualmente).
  const handleProjectChange = (value: string | null): void => {
    setProjectId(value);
    if (estimatedMinutes == null && value) {
      const project = projects.find((p) => p.id === value);
      if (project?.default_estimated_minutes != null) setEstimatedMinutes(project.default_estimated_minutes);
    }
  };

  const validate = (): boolean => {
    const result = taskSchema.safeParse({
      title: title.trim(),
      description: description.trim(),
      priority: Number(priority),
      due_date: dueDate,
      recurrence: recurrence,
      recurrence_rule: recurrenceRule,
      project_id: projectId,
      estimated_minutes: estimatedMinutes,
    });
    if (!result.success) {
      const fieldErrors: FieldErrors = {};
      for (const issue of result.error.issues) {
        const field = issue.path[0] as string;
        if (field && !fieldErrors[field]) fieldErrors[field] = issue.message;
      }
      setErrors(fieldErrors);
      return false;
    }
    setErrors({});
    return true;
  };

  const resetForm = (): void => {
    setTitle("");
    setDescription("");
    setPriority(4);
    setDueDate("");
    setDueTime("");
    setChecklist([]);
    setChecklistDraft("");
    setRecurrence("");
    setRecurrenceRule(null);
    setProjectId(initialProjectId);
    setEstimatedMinutes(null);
    setAddToToday(false);
    setErrors({});
    saveDraft(draftKey, {});
    // Volta o foco ao título para o próximo cadastro em sequência.
    setTimeout(() => titleRef.current?.focus(), 0);
  };

  const submit = async (keepOpen: boolean): Promise<void> => {
    if (!validate()) return;
    setSaving(true);
    try {
      await onSubmit({
        title: title.trim(),
        description: description.trim() || null,
        priority: Number(priority),
        due_date: dueDate || null,
        due_time: (dueDate && dueTime) ? dueTime : null,
        recurrence: recurrence || null,
        recurrence_rule: recurrenceRule,
        project_id: projectId,
        estimated_minutes: estimatedMinutes,
        ...(enableChecklist ? { checklist: checklist.filter((c) => c.trim()) } : {}),
        ...(enableAddToday ? { add_to_today: addToToday } : {}),
      }, { keepOpen });
      // Sucesso: limpa o rascunho. Se for "adicionar outra", reseta os campos.
      saveDraft(draftKey, {});
      if (keepOpen) resetForm();
    } finally {
      setSaving(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>): Promise<void> => {
    e.preventDefault();
    await submit(false);
  };

  // Atalhos de teclado: Esc cancela, Ctrl/Cmd+Enter salva.
  const handleKeyDown = (e: React.KeyboardEvent<HTMLFormElement>): void => {
    if (e.key === "Escape") {
      e.preventDefault();
      onCancel();
    } else if ((e.metaKey || e.ctrlKey) && e.key === "Enter") {
      e.preventDefault();
      void submit(false);
    }
  };

  const dateShortcuts = [
    { label: "Hoje", value: todayISO() },
    { label: "Amanhã", value: daysAgoISO(-1) },
    { label: "Próx. semana", value: daysAgoISO(-7) },
  ];
  const isCustomDate = !!dueDate && !dateShortcuts.some((s) => s.value === dueDate);
  const dueInfo = dueDate ? dueDateLabel(dueDate) : null;

  const clearDueDate = (): void => {
    setDueDate("");
    setDueTime("");
    if (errors.due_date) setErrors((p) => ({ ...p, due_date: undefined }));
  };

  const addChecklistItem = (): void => {
    const value = checklistDraft.trim();
    if (!value) return;
    setChecklist((prev) => [...prev, value]);
    setChecklistDraft("");
  };
  const removeChecklistItem = (index: number): void => {
    setChecklist((prev) => prev.filter((_, i) => i !== index));
  };

  return (
    <form className={styles.form} onSubmit={handleSubmit} onKeyDown={handleKeyDown}>
      <div className={styles.header}>
        <h3 className={styles.heading}>Nova Tarefa</h3>
        <button type="button" className={styles.btnClose} onClick={onCancel} aria-label="Fechar">×</button>
      </div>

      <div className={styles.field}>
        <input
          ref={titleRef}
          className={`${styles.input} ${styles.inputTitle}${errors.title ? " " + styles.inputError : ""}`}
          value={title}
          onChange={(e: React.ChangeEvent<HTMLInputElement>) => { setTitle(e.target.value); if (errors.title) setErrors((p) => ({ ...p, title: undefined })); }}
          placeholder={titlePlaceholder}
          autoFocus
          aria-invalid={!!errors.title}
          aria-describedby={errors.title ? "err-title" : undefined}
        />
        {errors.title && <span id="err-title" role="alert" className={styles.errorMsg}>{errors.title}</span>}
      </div>

      <div className={styles.field}>
        <DescriptionEditor
          className={`${styles.textarea}${errors.description ? " " + styles.inputError : ""}`}
          value={description}
          onChange={(v) => { setDescription(v.slice(0, DESC_MAX)); if (errors.description) setErrors((p) => ({ ...p, description: undefined })); }}
          placeholder="Descrição (opcional)"
          rows={2}
          maxLength={DESC_MAX}
          aria-invalid={!!errors.description}
          aria-describedby={errors.description ? "err-desc" : undefined}
        />
        <div className={styles.fieldMeta}>
          {errors.description
            ? <span id="err-desc" role="alert" className={styles.errorMsg}>{errors.description}</span>
            : <span />}
          {description.length > 0 && (
            <span className={styles.counter}>{description.length}/{DESC_MAX}</span>
          )}
        </div>
      </div>

      <div className={styles.field}>
        <label className={styles.label}>🚩 Prioridade</label>
        <div className={styles.pills} role="group" aria-label="Prioridade">
          {PRIORITIES.map((p) => (
            <button
              key={p.value}
              type="button"
              className={`${styles.pill}${priority === p.value ? " " + styles.pillActive : ""}`}
              data-priority={p.value}
              aria-pressed={priority === p.value}
              onClick={() => setPriority(p.value)}
            >
              <span className={styles.pillDot} aria-hidden>{p.dot}</span>
              {p.label}
            </button>
          ))}
        </div>
      </div>

      <div className={styles.field}>
        <label className={styles.label}>📅 Vencimento</label>
        <div className={styles.chips}>
          {dateShortcuts.map((s) => (
            <button
              key={s.label}
              type="button"
              className={`${styles.chip}${dueDate === s.value ? " " + styles.chipActive : ""}`}
              aria-pressed={dueDate === s.value}
              onClick={() => { setDueDate((prev) => (prev === s.value ? "" : s.value)); if (errors.due_date) setErrors((p) => ({ ...p, due_date: undefined })); }}
            >
              {s.label}
            </button>
          ))}
          {isCustomDate && (
            <span className={`${styles.chip} ${styles.chipActive}`} aria-hidden>Personalizada</span>
          )}
          {dueDate && (
            <button
              type="button"
              className={styles.chip}
              onClick={clearDueDate}
              aria-label="Limpar vencimento"
            >
              ✕ Limpar
            </button>
          )}
        </div>
        <input
          type="date"
          className={`${styles.input}${errors.due_date ? " " + styles.inputError : ""}`}
          value={dueDate}
          min={todayISO()}
          onChange={(e: React.ChangeEvent<HTMLInputElement>) => { setDueDate(e.target.value); if (errors.due_date) setErrors((p) => ({ ...p, due_date: undefined })); }}
          aria-invalid={!!errors.due_date}
          aria-describedby={errors.due_date ? "err-due" : undefined}
        />
        {dueDate && (
          <input
            type="time"
            className={styles.input}
            value={dueTime}
            onChange={(e: React.ChangeEvent<HTMLInputElement>) => setDueTime(e.target.value)}
            aria-label="Hora de vencimento (opcional)"
            style={{ marginTop: 6, maxWidth: 160 }}
          />
        )}
        {dueInfo && !errors.due_date && (
          <span className={styles.dueHint} data-tone={dueInfo.tone}>{dueInfo.text}{dueDate && dueTime ? ` às ${dueTime}` : ""}</span>
        )}
        {errors.due_date && <span id="err-due" role="alert" className={styles.errorMsg}>{errors.due_date}</span>}
      </div>

      {enableChecklist && (
        <div className={styles.field}>
          <label className={styles.label}>✅ Subtarefas</label>
          {checklist.length > 0 && (
            <ul className={styles.checklist}>
              {checklist.map((item, i) => (
                <li key={i} className={styles.checklistItem}>
                  <span className={styles.checklistText}>{item}</span>
                  <button
                    type="button"
                    className={styles.checklistRemove}
                    onClick={() => removeChecklistItem(i)}
                    aria-label={`Remover subtarefa ${item}`}
                  >×</button>
                </li>
              ))}
            </ul>
          )}
          <div className={styles.checklistAdd}>
            <input
              className={styles.input}
              value={checklistDraft}
              onChange={(e: React.ChangeEvent<HTMLInputElement>) => setChecklistDraft(e.target.value)}
              onKeyDown={(e: React.KeyboardEvent<HTMLInputElement>) => {
                if (e.key === "Enter") { e.preventDefault(); e.stopPropagation(); addChecklistItem(); }
              }}
              placeholder="Adicionar subtarefa e pressionar Enter"
            />
            <button type="button" className={styles.qcToggle} onClick={addChecklistItem} disabled={!checklistDraft.trim()}>＋ Add</button>
          </div>
        </div>
      )}

      <button
        type="button"
        className={styles.advancedToggle}
        onClick={() => setShowAdvanced((v) => !v)}
        aria-expanded={showAdvanced}
      >
        <span className={`${styles.chevron}${showAdvanced ? " " + styles.chevronOpen : ""}`} aria-hidden>▸</span>
        Mais opções
      </button>

      {showAdvanced && (
        <div className={styles.advanced}>
          <div className={styles.field}>
            <label className={styles.label}>🔁 Repetição</label>
            <RecurrenceFields
              recurrence={recurrence}
              rule={recurrenceRule}
              onChange={(value, rule) => { setRecurrence(value); setRecurrenceRule(rule); }}
            />
          </div>

          <div className={styles.row}>
            <div className={styles.field}>
              <label className={styles.label}>⏱ Tempo estimado</label>
              <EstimatedTimeSelect
                className={styles.select}
                value={estimatedMinutes}
                onChange={setEstimatedMinutes}
              />
              {calibration && estimatedMinutes != null && (
                <span className={styles.counter}>
                  💡 Você costuma levar ~{formatMinutes(Math.round(estimatedMinutes * calibration.ratio))}
                  {calibration.ratio > 1.1 ? " (tende a subestimar)" : calibration.ratio < 0.9 ? " (tende a superestimar)" : ""}
                </span>
              )}
            </div>

            <div className={styles.field}>
              <label className={styles.label}>📁 Projeto</label>
              <div className={styles.projectRow}>
                <ProjectSelect projects={projects} value={projectId} onChange={handleProjectChange} className={styles.select} onCreateNew={onCreateProject ? () => setCreatingProject(true) : undefined} />
                {onCreateProject && !creatingProject && (
                  <button type="button" className={styles.qcToggle} onClick={() => setCreatingProject(true)} title="Criar novo projeto">＋ Novo</button>
                )}
              </div>
              {justCreatedId && <span className={styles.qcSuccess} role="status">✓ Projeto criado e selecionado</span>}
              {onCreateProject && creatingProject && (
                <QuickCreateProject
                  projects={projects}
                  onCreate={onCreateProject}
                  onCreated={handleProjectCreated}
                  onCancel={() => setCreatingProject(false)}
                />
              )}
            </div>
          </div>
        </div>
      )}

      {enableAddToday && (
        <label className={styles.todayToggle}>
          <input
            type="checkbox"
            checked={addToToday}
            onChange={(e: React.ChangeEvent<HTMLInputElement>) => setAddToToday(e.target.checked)}
          />
          📌 Adicionar às Tarefas de Hoje
        </label>
      )}

      <div className={styles.actions}>
        <button type="submit" className={styles.btnSubmit} disabled={saving}>
          {saving ? "Salvando..." : "Criar tarefa"}
        </button>
        {allowAddAnother && (
          <button
            type="button"
            className={styles.btnSecondary}
            onClick={() => void submit(true)}
            disabled={saving}
            title="Salvar e manter o painel aberto para a próxima"
          >
            Criar e adicionar outra
          </button>
        )}
        <button type="button" className={styles.btnCancel} onClick={onCancel}>
          Cancelar
        </button>
      </div>
      <p className={styles.hint}>Dica: <kbd>Ctrl</kbd>+<kbd>Enter</kbd> para salvar · <kbd>Esc</kbd> para cancelar</p>
    </form>
  );
}
