import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  incomeApi,
  type ExpectedIncome,
  type ExpectedInput,
  type FinanceSettings,
  type IncomeSource,
  type Projection,
  type ReceiveInput,
} from "../api/financas";
import { financeKeys } from "../lib/financeKeys";

export function useIncomeSources(all = true) {
  return useQuery<IncomeSource[]>({ queryKey: [...financeKeys.sources(), { all }], queryFn: () => incomeApi.sources(all) });
}
export function useExpectedIncomes() {
  return useQuery<ExpectedIncome[]>({ queryKey: financeKeys.expected(), queryFn: () => incomeApi.expected() });
}
export function useFinanceSettings() {
  return useQuery<FinanceSettings>({ queryKey: financeKeys.settings(), queryFn: () => incomeApi.settings() });
}
export function useProjection(from: string, months: number) {
  return useQuery<Projection>({ queryKey: financeKeys.projection(from, months), queryFn: () => incomeApi.projection(from, months) });
}

export function useSourceMutations() {
  const qc = useQueryClient();
  const done = () => qc.invalidateQueries({ queryKey: financeKeys.sources() });
  return {
    create: useMutation({ mutationFn: incomeApi.createSource, onSuccess: done }),
    update: useMutation({
      mutationFn: ({ id, data }: { id: string; data: Parameters<typeof incomeApi.updateSource>[1] }) => incomeApi.updateSource(id, data),
      onSuccess: done,
    }),
    archive: useMutation({ mutationFn: incomeApi.archiveSource, onSuccess: done }),
  };
}

export function useExpectedMutations() {
  const qc = useQueryClient();
  const done = () => {
    qc.invalidateQueries({ queryKey: financeKeys.expected() });
    qc.invalidateQueries({ queryKey: financeKeys.projectionAll() });
  };
  return {
    save: useMutation<unknown, Error, { id?: string; data: ExpectedInput }>({
      mutationFn: ({ id, data }) => (id ? incomeApi.updateExpected(id, data) : incomeApi.createExpected(data)),
      onSuccess: done,
    }),
    remove: useMutation({ mutationFn: incomeApi.deleteExpected, onSuccess: done }),
    // "Recebi" também cria um lançamento: atualiza lançamentos, resumos e projeção.
    receive: useMutation<unknown, Error, { id: string; data: ReceiveInput }>({
      mutationFn: ({ id, data }) => incomeApi.receive(id, data),
      onSuccess: () => {
        done();
        qc.invalidateQueries({ queryKey: financeKeys.entriesAll() });
        qc.invalidateQueries({ queryKey: financeKeys.summaryAll() });
      },
    }),
  };
}

export function useSaveSettings() {
  const qc = useQueryClient();
  return useMutation<FinanceSettings, Error, FinanceSettings>({
    mutationFn: incomeApi.saveSettings,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: financeKeys.settings() });
      qc.invalidateQueries({ queryKey: financeKeys.projectionAll() });
    },
  });
}
