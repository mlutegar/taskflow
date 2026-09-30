import { Project } from "../api/projects";

export interface ProjectRow extends Project { depth: number; path: string; }

export function flattenProjects(projects: Project[]): ProjectRow[] {
  const byParent = new Map<string | null, Project[]>();
  for (const project of projects) {
    const parent = project.parent_id || null;
    byParent.set(parent, [...(byParent.get(parent) || []), project]);
  }
  for (const rows of byParent.values()) rows.sort((a, b) => a.name.localeCompare(b.name, "pt-BR"));
  const result: ProjectRow[] = [];
  const seen = new Set<string>();
  const visit = (project: Project, depth: number, ancestors: string[]) => {
    if (seen.has(project.id)) return;
    seen.add(project.id);
    const path = [...ancestors, project.name];
    result.push({ ...project, depth, path: path.join(" / ") });
    for (const child of byParent.get(project.id) || []) visit(child, depth + 1, path);
  };
  for (const root of byParent.get(null) || []) visit(root, 0, []);
  for (const orphan of projects) if (!seen.has(orphan.id)) visit(orphan, 0, []);
  return result;
}

const CREATE_VALUE = "__create__";

interface Props {
  projects: Project[];
  value?: string | null;
  onChange: (value: string | null) => void;
  className?: string;
  allowAll?: boolean;
  allowNoneFilter?: boolean;
  excludeIds?: Set<string>;
  /** Se definido, adiciona a opção "＋ Criar novo projeto…" ao dropdown. */
  onCreateNew?: () => void;
}

export default function ProjectSelect({ projects, value, onChange, className, allowAll = false, allowNoneFilter = false, excludeIds = new Set(), onCreateNew }: Props) {
  return (
    <select
      className={className}
      value={value || ""}
      onChange={(e) => {
        if (e.target.value === CREATE_VALUE) { onCreateNew?.(); return; }
        onChange(e.target.value || null);
      }}
    >
      {allowAll ? <option value="">Todos os projetos</option> : <option value="">Sem projeto</option>}
      {allowNoneFilter && <option value="none">Sem projeto</option>}
      {flattenProjects(projects.filter((project) => !project.archived)).filter((project) => !excludeIds.has(project.id)).map((project) => (
        <option key={project.id} value={project.id}>
          {`${"— ".repeat(project.depth)}${project.emoji} ${project.name}`}
        </option>
      ))}
      {onCreateNew && <option value={CREATE_VALUE}>＋ Criar novo projeto…</option>}
    </select>
  );
}
