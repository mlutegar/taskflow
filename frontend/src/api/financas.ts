import { api } from "../lib/apiClient";

// ── Finanças (prefixo /financas). Valores em centavos (Int); datas YYYY-MM-DD; meses YYYY-MM ──
export type FinanceType = "expense" | "income";
export type PaymentMethod = "pix" | "dinheiro" | "debito" | "credito" | "boleto" | "outro";

export interface FinanceCategory {
  id: string;
  name: string;
  kind: FinanceType;
  emoji: string | null;
  color: string | null;
  order: number;
  active: boolean;
}

export interface FinanceItem {
  /** Lançamento real: uuid; ocorrência de série: `s:<seriesId>:<YYYY-MM>`. */
  id: string;
  origin: "single" | "series";
  type: FinanceType;
  amountCents: number;
  date: string;
  categoryId: string | null;
  description: string | null;
  paymentMethod: PaymentMethod | null;
  seriesId: string | null;
  kind: "monthly" | "installment" | null;
  installmentIndex: number | null;
  installmentTotal: number | null;
  skipped: boolean;
}

export interface EntryInput {
  type: FinanceType;
  amountCents: number;
  date: string;
  categoryId?: string | null;
  description?: string | null;
  paymentMethod?: PaymentMethod | null;
}

export interface SeriesInput {
  type: FinanceType;
  kind: "monthly" | "installment";
  /** Fixo mensal: valor do mês. Parcelado: valor TOTAL. */
  amountCents: number;
  installments?: number;
  startDate: string;
  categoryId?: string | null;
  description?: string | null;
  paymentMethod?: PaymentMethod | null;
}

export interface SeriesReviseInput {
  effectiveMonth: string;
  amountCents?: number;
  categoryId?: string | null;
  description?: string | null;
  paymentMethod?: PaymentMethod | null;
  dayOfMonth?: number;
}

export interface CategoryTotal {
  categoryId: string | null;
  totalCents: number;
  pct: number;
}
interface Totals {
  incomeCents: number;
  expenseCents: number;
  balanceCents: number;
}
export interface MonthSummary extends Totals {
  month: string;
  previousMonth: string;
  byCategory: CategoryTotal[];
  previous: Totals;
  delta: {
    incomeCents: number;
    expenseCents: number;
    balanceCents: number;
    expensePct: number | null;
    incomePct: number | null;
  };
}

type CategoryPatch = Partial<Pick<FinanceCategory, "name" | "emoji" | "color" | "order" | "active">>;

export const financeApi = {
  categories: (all = false) => api.get<FinanceCategory[]>(`/financas/categories${all ? "?all=1" : ""}`),
  createCategory: (d: { name: string; kind: FinanceType; emoji?: string | null; color?: string | null }) =>
    api.post<FinanceCategory>("/financas/categories", d),
  updateCategory: (id: string, d: CategoryPatch) => api.patch<FinanceCategory>(`/financas/categories/${id}`, d),
  archiveCategory: (id: string) => api.delete<void>(`/financas/categories/${id}`),

  entries: (month: string) => api.get<FinanceItem[]>(`/financas/entries?month=${month}`),
  createEntry: (d: EntryInput) => api.post<FinanceItem>("/financas/entries", d),
  updateEntry: (id: string, d: Partial<EntryInput>) => api.patch<FinanceItem>(`/financas/entries/${id}`, d),
  deleteEntry: (id: string) => api.delete<void>(`/financas/entries/${id}`),

  createSeries: (d: SeriesInput) => api.post<unknown>("/financas/series", d),
  reviseSeries: (id: string, d: SeriesReviseInput) => api.post<unknown>(`/financas/series/${id}/revise`, d),
  endSeries: (id: string, fromMonth: string) => api.post<unknown>(`/financas/series/${id}/end`, { fromMonth }),
  setException: (id: string, month: string, d: { skipped: boolean; amountCents?: number | null }) =>
    api.put<unknown>(`/financas/series/${id}/exceptions/${month}`, d),
  clearException: (id: string, month: string) => api.delete<void>(`/financas/series/${id}/exceptions/${month}`),

  summary: (month: string) => api.get<MonthSummary>(`/financas/summary?month=${month}`),
};

// ── Fase B: fontes, rendas previstas, saldo inicial e projeção ──
export type SourceKind = "job" | "freelance" | "sales" | "other";
export type ExpectedStatus = "confirmed" | "probable" | "uncertain";

export interface IncomeSource {
  id: string;
  name: string;
  kind: SourceKind;
  active: boolean;
}
export interface ExpectedIncome {
  id: string;
  sourceId: string | null;
  amountCents: number;
  expectedDate: string;
  status: ExpectedStatus;
  description: string | null;
  receivedEntryId: string | null;
}
export interface ExpectedInput {
  sourceId?: string | null;
  amountCents: number;
  expectedDate: string;
  status: ExpectedStatus;
  description?: string | null;
}
export interface ReceiveInput {
  amountCents?: number;
  date?: string;
  categoryId?: string | null;
  description?: string | null;
  paymentMethod?: PaymentMethod | null;
}
export interface FinanceSettings {
  openingBalanceCents: number;
  openingDate: string | null;
}
export interface ProjectionMonth {
  month: string;
  incomeCents: number;
  expenseCents: number;
  expectedConfirmedCents: number;
  expectedProbableCents: number;
  confirmedBalanceCents: number;
  withProbableBalanceCents: number;
}
export interface Projection {
  from: string;
  monthsCount: number;
  openingBalanceCents: number;
  openingDate: string | null;
  startingBalanceCents: number;
  months: ProjectionMonth[];
  negativeMonths: { confirmed: string[]; withProbable: string[] };
}

export const incomeApi = {
  sources: (all = false) => api.get<IncomeSource[]>(`/financas/income-sources${all ? "?all=1" : ""}`),
  createSource: (d: { name: string; kind: SourceKind }) => api.post<IncomeSource>("/financas/income-sources", d),
  updateSource: (id: string, d: Partial<Pick<IncomeSource, "name" | "kind" | "active">>) =>
    api.patch<IncomeSource>(`/financas/income-sources/${id}`, d),
  archiveSource: (id: string) => api.delete<void>(`/financas/income-sources/${id}`),

  expected: () => api.get<ExpectedIncome[]>("/financas/expected-incomes"),
  createExpected: (d: ExpectedInput) => api.post<ExpectedIncome>("/financas/expected-incomes", d),
  updateExpected: (id: string, d: Partial<ExpectedInput>) => api.patch<ExpectedIncome>(`/financas/expected-incomes/${id}`, d),
  deleteExpected: (id: string) => api.delete<void>(`/financas/expected-incomes/${id}`),
  receive: (id: string, d: ReceiveInput) => api.post<FinanceItem>(`/financas/expected-incomes/${id}/receive`, d),

  settings: () => api.get<FinanceSettings>("/financas/settings"),
  saveSettings: (d: FinanceSettings) => api.put<FinanceSettings>("/financas/settings", d),
  projection: (from: string, months: number) => api.get<Projection>(`/financas/projection?from=${from}&months=${months}`),
};
