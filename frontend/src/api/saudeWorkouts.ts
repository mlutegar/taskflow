import { api } from "../lib/apiClient";

// ── Exercícios (prefixo /saude/workouts) ──────────────────────────────────────
export interface Workout {
  id: string;
  date: string;
  type: string;
  durationMin: number;
  notes: string | null;
  planId: string | null;
}

export interface WorkoutInput {
  date: string;
  type: string;
  durationMin: number;
  notes?: string | null;
  /** Item do plano de origem (botão "Fiz"); não é editável depois de criado. */
  planId?: string | null;
}

export interface WorkoutPlanItem {
  id: string;
  weekday: number; // 0=dom … 6=sáb
  type: string;
  durationMin: number | null;
  order: number;
}

export interface WorkoutPlanInput {
  weekday: number;
  type: string;
  durationMin?: number | null;
}

export interface PlannedToday {
  planId: string;
  type: string;
  durationMin: number | null;
  done: boolean;
  workoutId: string | null;
}

export interface WorkoutsToday {
  date: string;
  planned: PlannedToday[];
  workouts: Workout[];
}

export interface WorkoutsRange {
  workouts: Workout[];
  summary: { count: number; totalMin: number };
}

export const workoutsApi = {
  range: (from: string, to: string) => api.get<WorkoutsRange>(`/saude/workouts?from=${from}&to=${to}`),
  today: (date: string) => api.get<WorkoutsToday>(`/saude/workouts/today?date=${date}`),
  create: (data: WorkoutInput) => api.post<Workout>("/saude/workouts", data),
  update: (id: string, data: Partial<Omit<WorkoutInput, "planId">>) => api.patch<Workout>(`/saude/workouts/${id}`, data),
  remove: (id: string) => api.delete<void>(`/saude/workouts/${id}`),

  plan: () => api.get<WorkoutPlanItem[]>("/saude/workouts/plan"),
  createPlanItem: (data: WorkoutPlanInput) => api.post<WorkoutPlanItem>("/saude/workouts/plan", data),
  updatePlanItem: (id: string, data: Partial<WorkoutPlanInput>) =>
    api.patch<WorkoutPlanItem>(`/saude/workouts/plan/${id}`, data),
  removePlanItem: (id: string) => api.delete<void>(`/saude/workouts/plan/${id}`),
};
