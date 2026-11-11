import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  financeApi,
  type EntryInput,
  type FinanceCategory,
  type FinanceItem,
  type MonthSummary,
  type SeriesInput,
  type SeriesReviseInput,
} from "../api/financas";
import { financeKeys } from "../lib/financeKeys";

export function useFinanceCategories(all = false) {
  return useQuery<FinanceCategory[]>({
    queryKey: [...financeKeys.categories(), { all }],
    queryFn: () => financeApi.categories(all),
    staleTime: 5 * 60_000,
  });
}

export function useFinanceEntries(month: string) {
  return useQuery<FinanceItem[]>({ queryKey: financeKeys.entries(month), queryFn: () => financeApi.entries(month) });
}

export function useFinanceSummary(month: string) {
  return useQuery<MonthSummary>({ queryKey: financeKeys.summary(month), queryFn: () => financeApi.summary(month) });
}

/** Qualquer mudança de lançamento/série invalida lançamentos e resumos de todos os meses. */
function useInvalidateMoney() {
  const qc = useQueryClient();
  return () => {
    qc.invalidateQueries({ queryKey: financeKeys.entriesAll() });
    qc.invalidateQueries({ queryKey: financeKeys.summaryAll() });
  };
}

export function useSaveEntry() {
  const done = useInvalidateMoney();
  return useMutation<unknown, Error, { id?: string; data: Partial<EntryInput> & EntryInput }>({
    mutationFn: ({ id, data }) => (id ? financeApi.updateEntry(id, data) : financeApi.createEntry(data)),
    onSuccess: done,
  });
}

export function useDeleteEntry() {
  const done = useInvalidateMoney();
  return useMutation<void, Error, string>({ mutationFn: (id) => financeApi.deleteEntry(id), onSuccess: done });
}

export function useCreateSeries() {
  const done = useInvalidateMoney();
  return useMutation<unknown, Error, SeriesInput>({ mutationFn: (d) => financeApi.createSeries(d), onSuccess: done });
}

export function useReviseSeries() {
  const done = useInvalidateMoney();
  return useMutation<unknown, Error, { id: string; data: SeriesReviseInput }>({
    mutationFn: ({ id, data }) => financeApi.reviseSeries(id, data),
    onSuccess: done,
  });
}

export function useEndSeries() {
  const done = useInvalidateMoney();
  return useMutation<unknown, Error, { id: string; fromMonth: string }>({
    mutationFn: ({ id, fromMonth }) => financeApi.endSeries(id, fromMonth),
    onSuccess: done,
  });
}

/** Pular o mês (skipped) ou desfazer (skipped=false sem valor remove a exceção). */
export function useSeriesException() {
  const done = useInvalidateMoney();
  return useMutation<unknown, Error, { id: string; month: string; skipped: boolean; amountCents?: number | null }>({
    mutationFn: ({ id, month, ...d }) =>
      d.skipped || d.amountCents ? financeApi.setException(id, month, d) : financeApi.clearException(id, month),
    onSuccess: done,
  });
}

export function useCategoryMutations() {
  const qc = useQueryClient();
  const done = () => qc.invalidateQueries({ queryKey: financeKeys.categories() });
  return {
    create: useMutation({ mutationFn: financeApi.createCategory, onSuccess: done }),
    update: useMutation({
      mutationFn: ({ id, data }: { id: string; data: Parameters<typeof financeApi.updateCategory>[1] }) =>
        financeApi.updateCategory(id, data),
      onSuccess: done,
    }),
    archive: useMutation({ mutationFn: financeApi.archiveCategory, onSuccess: done }),
  };
}
