import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  workoutsApi,
  type Workout,
  type WorkoutInput,
  type WorkoutPlanInput,
  type WorkoutPlanItem,
  type WorkoutsRange,
  type WorkoutsToday,
} from "../api/saudeWorkouts";
import { healthKeys } from "../lib/healthKeys";

export function useWorkoutsToday(date: string) {
  return useQuery<WorkoutsToday>({ queryKey: healthKeys.workoutsToday(date), queryFn: () => workoutsApi.today(date) });
}

export function useWorkoutsRange(from: string, to: string) {
  return useQuery<WorkoutsRange>({
    queryKey: healthKeys.workoutsRange(from, to),
    queryFn: () => workoutsApi.range(from, to),
  });
}

export function useWorkoutPlan() {
  return useQuery<WorkoutPlanItem[]>({ queryKey: healthKeys.workoutPlan(), queryFn: workoutsApi.plan });
}

/** "Hoje", histórico e plano dependem uns dos outros: tudo de exercícios é invalidado junto. */
function useInvalidateWorkouts() {
  const qc = useQueryClient();
  return () => qc.invalidateQueries({ queryKey: healthKeys.workoutsAll() });
}

export function useSaveWorkout() {
  const invalidate = useInvalidateWorkouts();
  return useMutation<Workout, Error, { id?: string; data: WorkoutInput }>({
    mutationFn: ({ id, data }) => {
      if (!id) return workoutsApi.create(data);
      const { type, durationMin, notes, date } = data;
      return workoutsApi.update(id, { type, durationMin, notes, date });
    },
    onSuccess: () => {
      invalidate();
    },
  });
}

export function useDeleteWorkout() {
  const invalidate = useInvalidateWorkouts();
  return useMutation<void, Error, string>({
    mutationFn: (id) => workoutsApi.remove(id),
    onSuccess: () => {
      invalidate();
    },
  });
}

export function useSavePlanItem() {
  const invalidate = useInvalidateWorkouts();
  return useMutation<WorkoutPlanItem, Error, { id?: string; data: WorkoutPlanInput }>({
    mutationFn: ({ id, data }) => (id ? workoutsApi.updatePlanItem(id, data) : workoutsApi.createPlanItem(data)),
    onSuccess: () => {
      invalidate();
    },
  });
}

export function useDeletePlanItem() {
  const invalidate = useInvalidateWorkouts();
  return useMutation<void, Error, string>({
    mutationFn: (id) => workoutsApi.removePlanItem(id),
    onSuccess: () => {
      invalidate();
    },
  });
}
