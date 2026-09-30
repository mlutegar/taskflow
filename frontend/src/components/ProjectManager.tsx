import { FormEvent, KeyboardEvent, ReactNode, useEffect, useMemo, useRef, useState } from "react";
import { Project, ProjectInput } from "../api/projects";
import EstimatedTimeSelect from "./EstimatedTimeSelect";
import ProjectSelect, { flattenProjects } from "./ProjectSelect";
import EmojiPicker from "./EmojiPicker";
import { PROJECT_COLORS } from "../lib/projectTheme";
import styles from "./ProjectManager.module.css";

interface Props {
  projects: Project[];
  onCreate: (data: ProjectInput) => Promise<Project>;
  onUpdate: (id: string, data: Partial<ProjectInput>) => Promise<Project>;
  onDelete: (id: string) => Promise<unknown>;
  onClose: () => void;
}

const EMPTY = { name: "", description: "", emoji: "📁", color: "#7c6ef5", parent_id: null as string | null, default_estimated_minutes: null as number | null };
const DESC_MAX = 500;

/** Campo com rótulo reutilizável (label + conteúdo + erro/hint). */
function Field({ label, hint, htmlFor, children, style, className }: { label: ReactNode; hint?: ReactNode; htmlFor?: string; children: ReactNode; style?: React.CSSProperties; className?: string }) {
  return (
    <label className={`${styles.field} ${className || ""}`} htmlFor={htmlFor} style={style}>
      <span className={styles.label}>{label}</span>
      {children}
      {hint && <span className={styles.hint}>{hint}</span>}
    </label>
  );
}

export default function ProjectManager({ projects, onCreate, onUpdate, onDelete, onClose }: Props) {
  const [form, setForm] = useState(EMPTY);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [showArchived, setShowArchived] = useState(true);
  const [pendingDelete, setPendingDelete] = useState<Project | null>(null);

  const panelRef = useRef<HTMLElement | null>(null);
  const nameRef = useRef<HTMLInputElement | null>(null);
  const deleteTimer = useRef<number | null>(null);

  const rows = useMemo(() => flattenProjects(projects), [projects]);

  const descendants = (id: string) => {
    const blocked = new Set([id]);
    let changed = true;
    while (changed) {
      changed = false;
      for (const project of projects) {
        if (project.parent_id && blocked.has(project.parent_id) && !blocked.has(project.id)) {
          blocked.add(project.id); changed = true;
        }
      }
    }
    return blocked;
  };

  // Nome duplicado (mesmo pai), ignorando o projeto em edição.
  const trimmedName = form.name.trim().toLowerCase();
  const duplicateName = !!trimmedName && projects.some(
    (p) => p.id !== editingId && (p.parent_id || null) === form.parent_id && p.name.trim().toLowerCase() === trimmedName,
  );

  const filteredRows = useMemo(() => {
    const q = query.trim().toLowerCase();
    return rows.filter((r) => {
      if (!showArchived && r.archived) return false;
      if (pendingDelete && r.id === pendingDelete.id) return false;
      if (q && !r.name.toLowerCase().includes(q)) return false;
      return true;
    });
  }, [rows, query, showArchived, pendingDelete]);

  const reset = () => { setForm(EMPTY); setEditingId(null); setError(null); };
  const edit = (project: Project) => {
    setEditingId(project.id);
    setForm({ name: project.name, description: project.description || "", emoji: project.emoji, color: project.color, parent_id: project.parent_id || null, default_estimated_minutes: project.default_estimated_minutes ?? null });
    setError(null);
    panelRef.current?.scrollTo({ top: 0, behavior: "smooth" });
    setTimeout(() => nameRef.current?.focus(), 60);
  };
  const addChild = (project: Project) => {
    setEditingId(null);
    setForm({ ...EMPTY, parent_id: project.id });
    setError(null);
    setTimeout(() => nameRef.current?.focus(), 60);
  };
  const submit = async (event?: FormEvent) => {
    event?.preventDefault();
    if (!form.name.trim()) return;
    setSaving(true); setError(null);
    try {
      const data = { ...form, name: form.name.trim(), description: form.description.trim() || null };
      if (editingId) await onUpdate(editingId, data); else await onCreate(data);
      reset();
    } catch (err) {
      setError((err as Error).message || "Não foi possível salvar o projeto.");
    } finally { setSaving(false); }
  };
  const archive = async (project: Project) => {
    try { await onUpdate(project.id, { archived: !project.archived }); }
    catch (err) { setError((err as Error).message); }
  };

  // Exclusão com desfazer: só chama a API após o toast expirar.
  const commitDelete = async (project: Project) => {
    deleteTimer.current = null;
    setPendingDelete(null);
    try { await onDelete(project.id); }
    catch (err) { setError((err as Error).message); }
  };
  const remove = (project: Project) => {
    setError(null);
    if (deleteTimer.current) window.clearTimeout(deleteTimer.current);
    setPendingDelete(project);
    deleteTimer.current = window.setTimeout(() => commitDelete(project), 5000);
  };
  const undoDelete = () => {
    if (deleteTimer.current) window.clearTimeout(deleteTimer.current);
    deleteTimer.current = null;
    setPendingDelete(null);
  };
  useEffect(() => () => { if (deleteTimer.current) window.clearTimeout(deleteTimer.current); }, []);

  // Atalhos globais do modal: Esc fecha, Ctrl/Cmd+Enter salva.
  useEffect(() => {
    const onKey = (e: globalThis.KeyboardEvent) => {
      if (e.key === "Escape") { e.preventDefault(); onClose(); }
      else if ((e.ctrlKey || e.metaKey) && e.key === "Enter") { e.preventDefault(); void submit(); }
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [form, editingId]); // eslint-disable-line react-hooks/exhaustive-deps

  // Foco inicial + trap de foco dentro do painel.
  useEffect(() => { setTimeout(() => nameRef.current?.focus(), 40); }, []);
  const trapFocus = (e: KeyboardEvent) => {
    if (e.key !== "Tab" || !panelRef.current) return;
    const focusables = panelRef.current.querySelectorAll<HTMLElement>(
      'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])',
    );
    const list = Array.from(focusables).filter((el) => !el.hasAttribute("disabled") && el.offsetParent !== null);
    if (list.length === 0) return;
    const first = list[0], last = list[list.length - 1];
    if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
    else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
  };

  const nameInvalid = !!error && !form.name.trim();

  return (
    <div className={styles.backdrop} role="dialog" aria-modal="true" aria-label="Gerenciar projetos" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <section className={styles.panel} ref={panelRef} onKeyDown={trapFocus}>
        <header className={styles.header}>
          <h2>📁 Projetos</h2>
          <button className={styles.close} onClick={onClose} aria-label="Fechar">✕</button>
        </header>
        <div className={styles.body}>
          <form className={styles.form} onSubmit={submit}>
            <div className={styles.formTitle}>{editingId ? "Editar projeto" : "Novo projeto"}</div>

            <div className={styles.identityRow}>
              <div className={styles.field} style={{ flex: "0 0 auto" }}>
                <span className={styles.label}>Emoji</span>
                <EmojiPicker value={form.emoji} onChange={(emoji) => setForm((old) => ({ ...old, emoji }))} />
              </div>

              <label className={styles.field} style={{ flex: 1, minWidth: 0 }}>
                <span className={styles.label}>Nome</span>
                <input
                  ref={nameRef}
                  aria-label="Nome do projeto"
                  aria-invalid={nameInvalid}
                  aria-describedby={duplicateName ? "project-name-warn" : undefined}
                  placeholder="Ex.: Faculdade"
                  value={form.name}
                  maxLength={100}
                  onChange={(e) => setForm((old) => ({ ...old, name: e.target.value }))}
                />
              </label>
            </div>

            {duplicateName && (
              <span id="project-name-warn" className={styles.warn} role="alert">
                Já existe um projeto com esse nome neste nível.
              </span>
            )}

            <Field label="Cor">
              <div className={styles.colorRow}>
                {PROJECT_COLORS.map((c) => (
                  <button
                    key={c}
                    type="button"
                    className={`${styles.swatch} ${form.color.toLowerCase() === c.toLowerCase() ? styles.swatchActive : ""}`}
                    style={{ background: c }}
                    aria-label={`Cor ${c}`}
                    aria-pressed={form.color.toLowerCase() === c.toLowerCase()}
                    onClick={() => setForm((old) => ({ ...old, color: c }))}
                  />
                ))}
                <span className={styles.colorWrap} style={{ ["--project-color" as string]: form.color }} title="Cor personalizada">
                  <input className={styles.colorInput} aria-label="Cor personalizada" type="color" value={form.color} onChange={(e) => setForm((old) => ({ ...old, color: e.target.value }))} />
                </span>
              </div>
            </Field>

            <Field label={<>Descrição <em>(opcional)</em></>} hint={`${form.description.length}/${DESC_MAX}`}>
              <input
                placeholder="Um resumo curto do projeto"
                value={form.description}
                maxLength={DESC_MAX}
                onChange={(e) => setForm((old) => ({ ...old, description: e.target.value.slice(0, DESC_MAX) }))}
              />
            </Field>

            <Field label="Projeto pai">
              <ProjectSelect
                projects={projects}
                value={form.parent_id}
                onChange={(parent_id) => setForm((old) => ({ ...old, parent_id }))}
                excludeIds={editingId ? descendants(editingId) : new Set()}
              />
            </Field>

            <Field label={<>⏱ Tempo estimado padrão <em>(opcional)</em></>} hint="Novas tarefas neste projeto herdam esse tempo.">
              <EstimatedTimeSelect
                value={form.default_estimated_minutes}
                onChange={(default_estimated_minutes) => setForm((old) => ({ ...old, default_estimated_minutes }))}
                ariaLabel="Tempo estimado padrão do projeto"
              />
            </Field>

            <div className={styles.preview} aria-hidden="true">
              <span className={styles.previewLabel}>Pré-visualização</span>
              <div className={styles.previewCard} style={{ ["--project-color" as string]: form.color }}>
                <span className={styles.previewEmoji}>{form.emoji || "📁"}</span>
                <strong className={styles.previewName}>{form.name.trim() || "Nome do projeto"}</strong>
              </div>
            </div>

            {error && <span className={styles.error} role="alert">{error}</span>}
            <div className={styles.actions}>
              <span className={styles.kbdHint}><kbd>Ctrl</kbd>+<kbd>Enter</kbd> salva · <kbd>Esc</kbd> fecha</span>
              {editingId && <button type="button" className={styles.secondary} onClick={reset}>Cancelar</button>}
              <button type="submit" className={styles.primary} disabled={saving || !form.name.trim()}>{saving ? "Salvando…" : editingId ? "Salvar projeto" : "Criar projeto"}</button>
            </div>
          </form>

          {rows.length > 0 && (
            <div className={styles.toolbar}>
              <input className={styles.search} placeholder="🔎 Buscar projeto…" value={query} onChange={(e) => setQuery(e.target.value)} aria-label="Buscar projeto" />
              <label className={styles.toggle}>
                <input type="checkbox" checked={showArchived} onChange={(e) => setShowArchived(e.target.checked)} />
                Mostrar arquivados
              </label>
            </div>
          )}

          <div className={styles.list}>
            {rows.length === 0 ? (
              <div className={styles.empty}>Crie seu primeiro projeto — por exemplo, “Mrender” ou “Faculdade”.</div>
            ) : filteredRows.length === 0 ? (
              <div className={styles.empty}>Nenhum projeto encontrado.</div>
            ) : filteredRows.map((project) => (
              <div key={project.id} className={`${styles.row} ${project.archived ? styles.archived : ""}`} style={{ marginLeft: Math.min(project.depth, 3) * 16, "--project-color": project.color } as React.CSSProperties}>
                <span>{project.emoji}</span>
                <div className={styles.name}>
                  <strong>{project.name}</strong>
                  <small>{project.archived ? "Arquivado · " : ""}{project.task_count} tarefa{project.task_count === 1 ? "" : "s"} no total · {project.child_count} subprojeto{project.child_count === 1 ? "" : "s"}</small>
                </div>
                <div className={styles.rowActions}>
                  {!project.archived && <button className={styles.iconBtn} onClick={() => addChild(project)} title="Criar subprojeto">＋</button>}
                  <button className={styles.iconBtn} onClick={() => edit(project)} title="Editar">✎</button>
                  <button className={styles.iconBtn} onClick={() => archive(project)} title={project.archived ? "Restaurar" : "Arquivar"}>{project.archived ? "↩" : "📦"}</button>
                  <button className={styles.iconBtn} onClick={() => remove(project)} title="Excluir">🗑</button>
                </div>
              </div>
            ))}
          </div>
        </div>

        {pendingDelete && (
          <div className={styles.toast} role="status">
            <span>Projeto “{pendingDelete.name}” excluído.</span>
            <button type="button" className={styles.undo} onClick={undoDelete}>Desfazer</button>
          </div>
        )}
      </section>
    </div>
  );
}
