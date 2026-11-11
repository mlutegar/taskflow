import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { nutritionApi, type Meal, type MealInput, type WaterDay } from "../api/saude";
import { healthKeys } from "../lib/healthKeys";

export function useMeals(date: string) {
  return useQuery<Meal[]>({ queryKey: healthKeys.meals(date), queryFn: () => nutritionApi.meals(date) });
}

export function useWater(date: string) {
  return useQuery<WaterDay>({ queryKey: healthKeys.water(date), queryFn: () => nutritionApi.water(date) });
}

/** +1 copo (delta 1) ou desfazer (delta -1), com update otimista e rollback em erro. */
export function useAddWater(date: string) {
  const qc = useQueryClient();
  return useMutation<WaterDay, Error, number, { prev?: WaterDay }>({
    mutationFn: (delta) => nutritionApi.addWater(date, delta),
    onMutate: async (delta) => {
      await qc.cancelQueries({ queryKey: healthKeys.water(date) });
      const prev = qc.getQueryData<WaterDay>(healthKeys.water(date));
      if (prev) {
        const count = Math.max(0, prev.count + delta);
        qc.setQueryData<WaterDay>(healthKeys.water(date), { ...prev, count, totalMl: count * prev.glassMl });
      }
      return { prev };
    },
    onError: (_e, _v, ctx) => {
      if (ctx?.prev) qc.setQueryData(healthKeys.water(date), ctx.prev);
    },
    onSuccess: (data) => {
      qc.setQueryData(healthKeys.water(date), data);
    },
  });
}

export function useSaveMeal() {
  const qc = useQueryClient();
  return useMutation<Meal, Error, { id?: string; data: MealInput }>({
    mutationFn: ({ id, data }) => (id ? nutritionApi.updateMeal(id, data) : nutritionApi.createMeal(data)),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: healthKeys.nutritionAll() });
    },
  });
}

export function useDeleteMeal() {
  const qc = useQueryClient();
  return useMutation<void, Error, string>({
    mutationFn: (id) => nutritionApi.deleteMeal(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: healthKeys.nutritionAll() });
    },
  });
}
