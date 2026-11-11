import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  medicationsApi,
  type IntakeResult,
  type IntakeStatus,
  type Medication,
  type MedicationInput,
  type TodayResponse,
} from "../api/saude";
import { healthKeys } from "../lib/healthKeys";

export function useMedications(includeArchived = false) {
  return useQuery<Medication[]>({
    queryKey: healthKeys.medications(includeArchived),
    queryFn: () => medicationsApi.list(includeArchived),
  });
}

export function useTodayDoses(date: string, enabled = true) {
  return useQuery<TodayResponse>({
    queryKey: healthKeys.today(date),
    queryFn: () => medicationsApi.today(date),
    enabled,
    staleTime: 60_000,
  });
}

export function useMedicationHistory(from: string, to: string) {
  return useQuery({
    queryKey: healthKeys.history(from, to),
    queryFn: () => medicationsApi.history(from, to),
  });
}

/** Invalida tudo que depende de remédios (lista, doses do dia e histórico). */
function useInvalidateMedications() {
  const qc = useQueryClient();
  return () =>
    Promise.all([
      qc.invalidateQueries({ queryKey: healthKeys.medicationsAll() }),
      qc.invalidateQueries({ queryKey: healthKeys.todayAll() }),
      qc.invalidateQueries({ queryKey: healthKeys.historyAll() }),
    ]);
}

/** Marca tomei/pulei/desmarcar com atualização otimista do check (rollback em erro). */
export function useSetIntake(date: string) {
  const qc = useQueryClient();
  const invalidate = useInvalidateMedications();
  return useMutation<IntakeResult, Error, { scheduleId: string; status: IntakeStatus }, { prev?: TodayResponse }>({
    mutationFn: ({ scheduleId, status }) => medicationsApi.setIntake(scheduleId, date, status),
    onMutate: async ({ scheduleId, status }) => {
      await qc.cancelQueries({ queryKey: healthKeys.today(date) });
      const prev = qc.getQueryData<TodayResponse>(healthKeys.today(date));
      if (prev) {
        qc.setQueryData<TodayResponse>(healthKeys.today(date), {
          ...prev,
          items: prev.items.map((i) => (i.scheduleId === scheduleId ? { ...i, status } : i)),
        });
      }
      return { prev };
    },
    onError: (_e, _v, ctx) => {
      if (ctx?.prev) qc.setQueryData(healthKeys.today(date), ctx.prev);
    },
    onSettled: () => {
      invalidate();
    },
  });
}

export function useSaveMedication() {
  const invalidate = useInvalidateMedications();
  return useMutation<Medication, Error, { id?: string; data: MedicationInput }>({
    mutationFn: ({ id, data }) => (id ? medicationsApi.update(id, data) : medicationsApi.create(data)),
    onSuccess: () => {
      invalidate();
    },
  });
}

export function useArchiveMedication() {
  const invalidate = useInvalidateMedications();
  return useMutation<Medication, Error, { id: string; active: boolean }>({
    mutationFn: ({ id, active }) => medicationsApi.update(id, { active }),
    onSuccess: () => {
      invalidate();
    },
  });
}

export function useDeleteMedication() {
  const invalidate = useInvalidateMedications();
  return useMutation<void, Error, string>({
    mutationFn: (id) => medicationsApi.remove(id),
    onSuccess: () => {
      invalidate();
    },
  });
}
