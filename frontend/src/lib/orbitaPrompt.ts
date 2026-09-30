import type { TaskRecord, TaskChecklistItem } from "../types/tasks";

/** Template padrão (placeholders) usado quando o usuário não define um global. */
export const DEFAULT_ORBITA_TEMPLATE = "# Tarefa: {{titulo}}\n\n{{descricao}}\n\n## Checklist\n{{checklist}}";

/** Renderiza o checklist (aninhado) da task como lista markdown. */
export function renderChecklist(task: TaskRecord): string {
  const items = (task.checklist ?? []) as TaskChecklistItem[];
  if (!items.length) return "";
  const lines: string[] = [];
  const render = (parentId: TaskChecklistItem["parent_id"], depth: number): void => {
    const children = items.filter((i) => (i.parent_id ?? null) === (parentId ?? null));
    for (const it of children) {
      lines.push(`${"  ".repeat(depth)}- [${it.completed ? "x" : " "}] ${it.description}`);
      render(it.id, depth + 1);
    }
  };
  render(null, 0);
  return lines.join("\n");
}

/**
 * Aplica um template com placeholders a partir da task:
 *   {{titulo}} {{descricao}} {{checklist}} {{projeto}}
 * Placeholders sem valor viram string vazia; linhas em branco extras são colapsadas.
 */
export function applyTemplate(template: string, task: TaskRecord, projectName = ""): string {
  const map: Record<string, string> = {
    titulo: task.title ?? "",
    descricao: (task.description ?? "").trim(),
    checklist: renderChecklist(task),
    projeto: projectName,
  };
  const out = (template || DEFAULT_ORBITA_TEMPLATE).replace(
    /\{\{\s*(titulo|descricao|checklist|projeto)\s*\}\}/g,
    (_m, k: string) => map[k] ?? ""
  );
  // Colapsa 3+ quebras seguidas (placeholders vazios) em no máximo 2.
  return out.replace(/\n{3,}/g, "\n\n").trim();
}

/**
 * Prompt padrão a partir da task (título + descrição + checklist), usando o
 * template global (se houver) ou o `DEFAULT_ORBITA_TEMPLATE`.
 */
export function buildPromptFromTask(task: TaskRecord, template = "", projectName = ""): string {
  return applyTemplate(template || DEFAULT_ORBITA_TEMPLATE, task, projectName);
}
