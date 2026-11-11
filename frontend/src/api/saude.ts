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

  /** Reposição rápida: soma `qty` (> 0) ao estoque. */
  restock: (id: string, qty: number) => api.post<Medication>(`/saude/medications/${id}/restock`, { qty }),

  today: (date: string) => api.get<TodayResponse>(`/saude/medications/today?date=${date}`),

  setIntake: (scheduleId: string, date: string, status: IntakeStatus) =>
    api.put<IntakeResult>("/saude/medications/intakes", { scheduleId, date, status }),

  history: (from: string, to: string) =>
    api.get<HistoryEntry[]>(`/saude/medications/history?from=${from}&to=${to}`),
};

// ── Skincare (prefixo /saude/skincare) e lista de compras ─────────────────────
export type Period = "morning" | "night";
export type ProductStatus = "have" | "low" | "need_to_buy";
export type ProductCategory = "protetor" | "hidratante" | "esfoliante" | "limpeza" | "serum" | "outro";

export interface SkincareProduct {
  id: string;
  name: string;
  category: ProductCategory;
  status: ProductStatus;
  notes: string | null;
}

export interface ProductInput {
  name: string;
  category: ProductCategory;
  status: ProductStatus;
  notes?: string | null;
}

export interface SkincareStep {
  id: string;
  period: Period;
  order: number;
  productId: string | null;
  productName: string | null;
  productCategory: ProductCategory | null;
  productStatus: ProductStatus | null;
  label: string;
  frequency: MedFrequency;
  daysOfWeek: number[];
  intervalDays: number | null;
  startDate: string;
  active: boolean;
}

export interface StepInput {
  period: Period;
  productId?: string | null;
  label: string;
  frequency: MedFrequency;
  daysOfWeek: number[];
  intervalDays?: number | null;
  startDate?: string;
}

export interface SkincareTodayItem {
  stepId: string;
  label: string;
  productId: string | null;
  productName: string | null;
  productStatus: ProductStatus | null;
  done: boolean;
  doneAt: string | null;
}

export interface SkincareToday {
  date: string;
  morning: SkincareTodayItem[];
  night: SkincareTodayItem[];
}

export interface ShoppingList {
  skincare: { id: string; name: string; category: ProductCategory; status: "low" | "need_to_buy" }[];
  medications: {
    id: string;
    name: string;
    dose: string | null;
    stockQty: number;
    lowStockThreshold: number;
    empty: boolean;
  }[];
  total: number;
}

export const skincareApi = {
  products: () => api.get<SkincareProduct[]>("/saude/skincare/products"),
  createProduct: (data: ProductInput) => api.post<SkincareProduct>("/saude/skincare/products", data),
  updateProduct: (id: string, data: Partial<ProductInput>) =>
    api.patch<SkincareProduct>(`/saude/skincare/products/${id}`, data),
  deleteProduct: (id: string) => api.delete<void>(`/saude/skincare/products/${id}`),
  purchased: (id: string) => api.post<SkincareProduct>(`/saude/skincare/products/${id}/purchased`),

  steps: () => api.get<SkincareStep[]>("/saude/skincare/steps"),
  createStep: (data: StepInput) => api.post<SkincareStep>("/saude/skincare/steps", data),
  updateStep: (id: string, data: Partial<Omit<StepInput, "period">> & { active?: boolean }) =>
    api.patch<SkincareStep>(`/saude/skincare/steps/${id}`, data),
  reorderSteps: (period: Period, ids: string[]) =>
    api.put<SkincareStep[]>("/saude/skincare/steps/reorder", { period, ids }),

  today: (date: string) => api.get<SkincareToday>(`/saude/skincare/today?date=${date}`),
  setCheck: (stepId: string, date: string, done: boolean) =>
    api.put<{ stepId: string; date: string; done: boolean }>("/saude/skincare/checks", { stepId, date, done }),
};

export const shoppingApi = {
  list: () => api.get<ShoppingList>("/saude/shopping-list"),
};

// ── Alimentação (prefixo /saude/nutrition) ────────────────────────────────────
export type MealType = "breakfast" | "lunch" | "snack" | "dinner";

export interface Meal {
  id: string;
  date: string;
  type: MealType;
  time: string; // HH:MM
  description: string;
}

export interface MealInput {
  date: string;
  type: MealType;
  time: string;
  description: string;
}

export interface WaterDay {
  date: string;
  count: number;
  glassMl: number;
  totalMl: number;
  goalGlasses: number;
}

export const nutritionApi = {
  meals: (date: string) => api.get<Meal[]>(`/saude/nutrition/meals?date=${date}`),
  createMeal: (data: MealInput) => api.post<Meal>("/saude/nutrition/meals", data),
  updateMeal: (id: string, data: Partial<MealInput>) => api.patch<Meal>(`/saude/nutrition/meals/${id}`, data),
  deleteMeal: (id: string) => api.delete<void>(`/saude/nutrition/meals/${id}`),

  water: (date: string) => api.get<WaterDay>(`/saude/nutrition/water?date=${date}`),
  /** +1 adiciona um copo; -1 desfaz (o servidor nunca deixa abaixo de 0). */
  addWater: (date: string, delta: number) => api.post<WaterDay>("/saude/nutrition/water/add", { date, delta }),
};
