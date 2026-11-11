import { api } from "../lib/apiClient";

// ── Remédios (prefixo /saude/medications) ─────────────────────────────────────
export type MedFrequency = "daily" | "weekdays" | "custom_days" | "every_n_days";
export type IntakeStatus = "taken" | "skipped" | "pending";

export interface MedSchedule {
  id: string;
  time: string; // HH:MM
  doseQty: number;
  active: boolean;
  order: number;
}

export interface Medication {
  id: string;
  name: string;
  dose: string | null;
  frequency: MedFrequency;
  daysOfWeek: number[];
  intervalDays: number | null;
  startDate: string; // YYYY-MM-DD
  endDate: string | null;
  stockQty: number;
  lowStockThreshold: number;
  lowStock: boolean;
  daysLeft: number | null;
  active: boolean;
  createdAt: string;
  schedules: MedSchedule[];
}

export interface MedScheduleInput {
  id?: string;
  time: string;
  doseQty: number;
}

export interface MedicationInput {
  name: string;
  dose?: string | null;
  frequency: MedFrequency;
  daysOfWeek: number[];
  intervalDays?: number | null;
  startDate: string;
  endDate?: string | null;
  stockQty: number;
  lowStockThreshold: number;
  schedules: MedScheduleInput[];
}

export interface TodayDose {
  medicationId: string;
  name: string;
  dose: string | null;
  scheduleId: string;
  time: string;
  doseQty: number;
  status: IntakeStatus;
  takenAt: string | null;
  stockQty: number;
  lowStock: boolean;
}

export interface TodayResponse {
  date: string;
  items: TodayDose[];
}

export interface IntakeResult {
  status: IntakeStatus;
  stockQty: number;
  lowStock: boolean;
}

export interface HistoryEntry {
  id: string;
  medicationId: string;
  medicationName: string;
  dose: string | null;
  date: string;
  scheduledTime: string;
  status: "taken" | "skipped";
  doseQty: number;
  takenAt: string | null;
}

export const medicationsApi = {
  list: (includeArchived = false) =>
    api.get<Medication[]>(`/saude/medications${includeArchived ? "?includeArchived=true" : ""}`),

  create: (data: MedicationInput) => api.post<Medication>("/saude/medications", data),

  update: (id: string, data: Partial<MedicationInput> & { active?: boolean }) =>
    api.patch<Medication>(`/saude/medications/${id}`, data),

  /** Exclusão real: apaga também o histórico. Exige confirmação explícita no servidor. */
  remove: (id: string) => api.delete<void>(`/saude/medications/${id}?confirm=true`),

  today: (date: string) => api.get<TodayResponse>(`/saude/medications/today?date=${date}`),

  setIntake: (scheduleId: string, date: string, status: IntakeStatus) =>
    api.put<IntakeResult>("/saude/medications/intakes", { scheduleId, date, status }),

  history: (from: string, to: string) =>
    api.get<HistoryEntry[]>(`/saude/medications/history?from=${from}&to=${to}`),
};
