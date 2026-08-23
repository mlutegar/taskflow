const KEY = "taskflow.taskTemplates";

export interface TaskTemplate {
  id?: string;
  title?: string;
  description?: string;
  priority?: number;
  recurrence?: string;
  due_date?: string;
  [key: string]: unknown;
}

export function getTemplates(): TaskTemplate[] {
  try {
    return JSON.parse(localStorage.getItem(KEY) || "[]");
  } catch {
    return [];
  }
}

export function saveTemplate(template: TaskTemplate): void {
  const templates = getTemplates();
  const existing = templates.findIndex((t) => t.id === template.id);
  if (existing >= 0) {
    templates[existing] = template;
  } else {
    templates.push({ ...template, id: `tpl_${Date.now()}_${Math.random().toString(36).slice(2, 7)}` });
  }
  localStorage.setItem(KEY, JSON.stringify(templates));
}

export function deleteTemplate(id: string): void {
  const templates = getTemplates().filter((t) => t.id !== id);
  localStorage.setItem(KEY, JSON.stringify(templates));
}

export function applyTemplate(template: TaskTemplate): {
  title: string;
  description: string;
  priority: number;
  recurrence: string;
  due_date: string;
} {
  return {
    title: template.title || "",
    description: template.description || "",
    priority: template.priority || 3,
    recurrence: template.recurrence || "",
    due_date: "",
  };
}
