import { useEffect, useRef, useState } from "react";
import { Project, ProjectInput } from "../api/projects";
import ProjectSelect from "./ProjectSelect";
import EmojiPicker from "./EmojiPicker";
import { PROJECT_COLORS, DEFAULT_PROJECT_EMOJI, DEFAULT_PROJECT_COLOR, normalizeEmoji } from "../lib/projectTheme";
import styles from "./QuickCreateProject.module.css";

interface Props {
  projects: Project[];
  onCreate: (data: ProjectInput) => Promise<Project>;
  onCreated: (project: Project) => void;
  onCancel: () => void;
  defaultParentId?: string | null;
  /** Mostra o seletor de projeto-pai (default: true). */
  allowParent?: boolean;
}

/**
 * Mini-form reutilizável de criação rápida de projeto: emoji + nome + cor +
 * projeto-pai, com pré-visualização, aviso de nome duplicado e foco gerenciado.
 * Usado inline no AddTaskForm e na edição de tarefa (TaskCard).
 */
export default function QuickCreateProject({ projects, onCreate, onCreated, onCancel, defaultParentId = null, allowParent = true }: Props) {
  const [name, setName] = useState("");
  const [emoji, setEmoji] = useState(DEFAULT_PROJECT_EMOJI);
  const [color, setColor] = useState(DEFAULT_PROJECT_COLOR);
  const [parentId, setParentId] = useState<string | null>(defaultParentId);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const nameRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => { setTimeout(() => nameRef.current?.focus(), 40); }, []);

  const trimmed = name.trim().toLowerCase();
  const duplicate = !!trimmed && projects.some(
    (p) => (p.parent_id || null) === parentId && p.name.trim().toLowerCase() === trimmed,
  );

  const create = async (): Promise<void> => {
    if (saving || !name.trim()) return; // guarda contra duplo-submit
    setSaving(true); setError(null);
    try {
      const project = await onCreate({ name: name.trim(), emoji: normalizeEmoji(emoji), color, parent_id: parentId });
      onCreated(project);
    } catch (err) {
      setError((err as Error).message || "Não foi possível criar o projeto.");
      setSaving(false);
    }
  };

  return (
    <div className={styles.box}>
      <div className={styles.row}>
        <EmojiPicker value={emoji} onChange={setEmoji} ariaLabel="Emoji do projeto" />
        <input
          ref={nameRef}
          className={styles.name}
          value={name}
          maxLength={100}
          placeholder="Nome do novo projeto"
          aria-label="Nome do novo projeto"
          aria-describedby={duplicate ? "qc-dup" : undefined}
          onChange={(e) => setName(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") { e.preventDefault(); e.stopPropagation(); void create(); }
            else if (e.key === "Escape") { e.preventDefault(); e.stopPropagation(); onCancel(); }
          }}
        />
      </div>

      {duplicate && <span id="qc-dup" className={styles.warn} role="alert">Já existe um projeto com esse nome neste nível.</span>}

      <div className={styles.colors}>
        {PROJECT_COLORS.map((c) => (
          <button
            key={c}
            type="button"
            className={`${styles.swatch}${color.toLowerCase() === c.toLowerCase() ? " " + styles.swatchActive : ""}`}
            style={{ background: c }}
            aria-label={`Cor ${c}`}
            aria-pressed={color.toLowerCase() === c.toLowerCase()}
            onClick={() => setColor(c)}
          />
        ))}
        <span className={styles.colorWrap} style={{ ["--project-color" as string]: color }} title="Cor personalizada">
          <input className={styles.colorInput} aria-label="Cor personalizada" type="color" value={color} onChange={(e) => setColor(e.target.value)} />
        </span>
      </div>

      {allowParent && (
        <ProjectSelect projects={projects} value={parentId} onChange={setParentId} className={styles.parent} />
      )}

      <div className={styles.preview} aria-hidden="true">
        <div className={styles.previewCard} style={{ ["--project-color" as string]: color }}>
          <span className={styles.previewEmoji}>{emoji || DEFAULT_PROJECT_EMOJI}</span>
          <strong className={styles.previewName}>{name.trim() || "Nome do projeto"}</strong>
        </div>
      </div>

      {error && <span className={styles.error} role="alert" aria-live="polite">{error}</span>}

      <div className={styles.actions}>
        <button type="button" className={styles.create} disabled={saving || !name.trim()} onClick={() => void create()}>
          {saving ? "Criando…" : "Criar projeto"}
        </button>
        <button type="button" className={styles.cancel} onClick={onCancel}>Cancelar</button>
      </div>
    </div>
  );
}
