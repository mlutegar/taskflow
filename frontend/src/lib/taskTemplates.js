const KEY = "taskflow.taskTemplates";

export function getTemplates() {
  try {
    return JSON.parse(localStorage.getItem(KEY) || "[]");
  } catch {
    return [];
  }
}

export function saveTemplate(template) {
  const templates = getTemplates();
  const existing = templates.findIndex((t) => t.id === template.id);
  if (existing >= 0) {
    templates[existing] = template;
  } else {
    templates.push({ ...template, id: `tpl_${Date.now()}_${Math.random().toString(36).slice(2, 7)}` });
  }
  localStorage.setItem(KEY, JSON.stringify(templates));
}

export function deleteTemplate(id) {
  const templates = getTemplates().filter((t) => t.id !== id);
  localStorage.setItem(KEY, JSON.stringify(templates));
}

export function applyTemplate(template) {
  return {
    title: template.title || "",
    description: template.description || "",
    priority: template.priority || 3,
    recurrence: template.recurrence || "",
    due_date: "",
  };
}
