import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  shoppingApi,
  skincareApi,
  type Period,
  type ProductInput,
  type ShoppingList,
  type SkincareProduct,
  type SkincareStep,
  type SkincareToday,
  type StepInput,
} from "../api/saude";
import { healthKeys } from "../lib/healthKeys";

export function useSkincareToday(date: string) {
  return useQuery<SkincareToday>({
    queryKey: healthKeys.skincareToday(date),
    queryFn: () => skincareApi.today(date),
    staleTime: 60_000,
  });
}

export function useSkincareSteps() {
  return useQuery<SkincareStep[]>({ queryKey: healthKeys.skincareSteps(), queryFn: skincareApi.steps });
}

export function useSkincareProducts() {
  return useQuery<SkincareProduct[]>({ queryKey: healthKeys.skincareProducts(), queryFn: skincareApi.products });
}

export function useShoppingList() {
  return useQuery<ShoppingList>({ queryKey: healthKeys.shopping(), queryFn: shoppingApi.list });
}

/** Produtos/passos/checks mudam a tela do dia e a lista de compras. */
function useInvalidateSkincare() {
  const qc = useQueryClient();
  return () =>
    Promise.all([
      qc.invalidateQueries({ queryKey: healthKeys.skincareAll() }),
      qc.invalidateQueries({ queryKey: healthKeys.shopping() }),
    ]);
}

/** Check do passo com update otimista (rollback em erro). */
export function useSetStepCheck(date: string) {
  const qc = useQueryClient();
  const invalidate = useInvalidateSkincare();
  return useMutation<unknown, Error, { stepId: string; done: boolean }, { prev?: SkincareToday }>({
    mutationFn: ({ stepId, done }) => skincareApi.setCheck(stepId, date, done),
    onMutate: async ({ stepId, done }) => {
      await qc.cancelQueries({ queryKey: healthKeys.skincareToday(date) });
      const prev = qc.getQueryData<SkincareToday>(healthKeys.skincareToday(date));
      if (prev) {
        const patch = (items: SkincareToday["morning"]) =>
          items.map((i) => (i.stepId === stepId ? { ...i, done } : i));
        qc.setQueryData<SkincareToday>(healthKeys.skincareToday(date), {
          ...prev,
          morning: patch(prev.morning),
          night: patch(prev.night),
        });
      }
      return { prev };
    },
    onError: (_e, _v, ctx) => {
      if (ctx?.prev) qc.setQueryData(healthKeys.skincareToday(date), ctx.prev);
    },
    onSettled: () => {
      invalidate();
    },
  });
}

export function useSaveStep() {
  const invalidate = useInvalidateSkincare();
  return useMutation<SkincareStep, Error, { id?: string; data: StepInput }>({
    mutationFn: ({ id, data }) => {
      if (!id) return skincareApi.createStep(data);
      const { period: _period, ...rest } = data;
      return skincareApi.updateStep(id, rest);
    },
    onSuccess: () => {
      invalidate();
    },
  });
}

/** "Remover" = active=false (soft delete; os checks antigos ficam). */
export function useRemoveStep() {
  const invalidate = useInvalidateSkincare();
  return useMutation<SkincareStep, Error, string>({
    mutationFn: (id) => skincareApi.updateStep(id, { active: false }),
    onSuccess: () => {
      invalidate();
    },
  });
}

export function useReorderSteps() {
  const invalidate = useInvalidateSkincare();
  return useMutation<SkincareStep[], Error, { period: Period; ids: string[] }>({
    mutationFn: ({ period, ids }) => skincareApi.reorderSteps(period, ids),
    onSuccess: () => {
      invalidate();
    },
  });
}

export function useSaveProduct() {
  const invalidate = useInvalidateSkincare();
  return useMutation<SkincareProduct, Error, { id?: string; data: ProductInput }>({
    mutationFn: ({ id, data }) => (id ? skincareApi.updateProduct(id, data) : skincareApi.createProduct(data)),
    onSuccess: () => {
      invalidate();
    },
  });
}

export function useDeleteProduct() {
  const invalidate = useInvalidateSkincare();
  return useMutation<void, Error, string>({
    mutationFn: (id) => skincareApi.deleteProduct(id),
    onSuccess: () => {
      invalidate();
    },
  });
}

export function useProductPurchased() {
  const invalidate = useInvalidateSkincare();
  return useMutation<SkincareProduct, Error, string>({
    mutationFn: (id) => skincareApi.purchased(id),
    onSuccess: () => {
      invalidate();
    },
  });
}

/** Troca rápida de status do produto (tenho / acabando / preciso comprar). */
export function useSetProductStatus() {
  const invalidate = useInvalidateSkincare();
  return useMutation<SkincareProduct, Error, { id: string; status: SkincareProduct["status"] }>({
    mutationFn: ({ id, status }) => skincareApi.updateProduct(id, { status }),
    onSuccess: () => {
      invalidate();
    },
  });
}
