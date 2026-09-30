import { api } from "../lib/apiClient";

export interface Project {
  id: string;
  name: string;
  description?: string | null;
  color: string;
  emoji: string;
  parent_id?: string | null;
  archived: boolean;
  default_estimated_minutes?: number | null;
  task_count: number;
  direct_task_count?: number;
  child_count: number;
}

export interface ProjectInput {
  name: string;
  description?: string | null;
  color?: string;
  emoji?: string;
  parent_id?: string | null;
  archived?: boolean;
  default_estimated_minutes?: number | null;
}

export const projectsApi = {
  list: (includeArchived = false) => api.get(`/projects${includeArchived ? "?archived=true" : ""}`) as Promise<Project[]>,
  create: (data: ProjectInput) => api.post("/projects", data) as Promise<Project>,
  update: (id: string, data: Partial<ProjectInput>) => api.patch(`/projects/${id}`, data) as Promise<Project>,
  delete: (id: string) => api.delete(`/projects/${id}`),
};
