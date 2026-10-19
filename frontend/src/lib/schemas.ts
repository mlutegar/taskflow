import { z } from "zod";

export const taskSchema = z.object({
  title: z
    .string()
    .min(1, "O título é obrigatório.")
    .max(200, "O título deve ter no máximo 200 caracteres."),
  description: z
    .string()
    .max(10000, "A descrição deve ter no máximo 10000 caracteres.")
    .optional()
    .or(z.literal("")),
  priority: z
    .number()
    .int()
    .min(1, "Prioridade inválida.")
    .max(4, "Prioridade inválida."),
  due_date: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, "Data inválida.")
    .optional()
    .or(z.literal("")),
  recurrence: z
    .enum(["", "daily", "weekdays", "weekly", "biweekly", "monthly", "monthly_first", "yearly", "custom"])
    .optional(),
  recurrence_rule: z.object({
    type: z.enum(["interval", "weekdays"]).optional(),
    intervalDays: z.number().min(1).max(365).optional(),
    weekdays: z.array(z.number().min(0).max(6)).optional(),
    skipWeekends: z.boolean().optional(),
    skipHolidays: z.boolean().optional(),
    reminderDaysBefore: z.number().min(0).max(365).optional(),
    birthdayYear: z.number().min(1900).max(new Date().getFullYear()).optional(),
  }).nullable().optional(),
  project_id: z.string().uuid().nullable().optional(),
  estimated_minutes: z.number().int().min(0).max(1440).nullable().optional(),
  actual_minutes: z.number().int().min(0).max(10080).nullable().optional(),
});

export type TaskSchema = z.infer<typeof taskSchema>;

export const routineSchema = z.object({
  title: z
    .string()
    .min(1, "O nome é obrigatório.")
    .max(100, "O nome deve ter no máximo 100 caracteres."),
  description: z
    .string()
    .max(1000, "A descrição deve ter no máximo 1000 caracteres.")
    .optional()
    .or(z.literal("")),
  target_value: z
    .number()
    .min(0, "A meta deve ser um número positivo.")
    .optional()
    .nullable(),
  unit: z
    .string()
    .max(50, "A unidade deve ter no máximo 50 caracteres.")
    .optional()
    .nullable(),
  recurrence: z
    .enum(["none", "daily", "weekdays"])
    .optional()
    .nullable(),
});

export type RoutineSchema = z.infer<typeof routineSchema>;
