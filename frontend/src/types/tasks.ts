import type { RecurrenceRule } from "../components/RecurrenceFields";

export interface OrbitaLaunchEntry {
  key: string;
  provider: string;
  path?: string | null;
  reused?: boolean;
  at: string;
}

export interface TaskChecklistItem {
  id: string | number;
  parent_id?: string | number | null;
  description: string;
  note?: string | null;
  completed: boolean;
  order?: number;
}

export interface TaskRecord {
  id: string;
  created_by: string;
  assigned_to?: string | null;
  title: string;
  description?: string | null;
  priority: number;
  completed: boolean;
  due_date?: string | null;
  due_time?: string | null; // "HH:MM" (opcional)
  recurrence?: string | null;
  recurrence_rule?: RecurrenceRule | null;
  project_id?: string | null;
  estimated_minutes?: number | null;
  actual_minutes?: number | null;
  orbita_projects?: string[] | null;
  orbita_prompt?: string | null;
  orbita_last_key?: string | null;
  orbita_last_provider?: string | null;
  orbita_history?: OrbitaLaunchEntry[] | null;
  created_at?: string | null;
  updated_at?: string | null;
  createdAt?: string | null;
  updatedAt?: string | null;
  version: number;
  checklist: TaskChecklistItem[];
  checklist_count: number;
  checklist_completed_count: number;
  _completion_id?: string | null;
  _completion_message?: string;
}

export interface TaskCreateInput {
  client_id?: string;
  title: string;
  description?: string | null;
  priority?: number;
  due_date?: string | null;
  due_time?: string | null; // "HH:MM" (opcional)
  recurrence?: string | null;
  recurrence_rule?: RecurrenceRule | null;
  project_id?: string | null;
  estimated_minutes?: number | null;
  actual_minutes?: number | null;
  orbita_projects?: string[] | null;
  orbita_prompt?: string | null;
  assigned_to?: string | null;
}

export type TaskUpdateInput = Partial<TaskCreateInput> & {
  completed?: boolean;
  completed_at?: string | null;
  version?: number;
};

export type TaskSyncState = "idle" | "saving" | "saved" | "error" | "offline" | "pending";
