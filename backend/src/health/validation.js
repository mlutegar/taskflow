/** health/validation.js — validações zod compartilhadas das rotas de Saúde. */
import { z } from "zod";
import { FREQUENCIES } from "./schedule.js";
import { INTAKE_STATUSES } from "./stock.js";

/** "YYYY-MM-DD" e dia civil real (rejeita 2026-02-30). */
export const dateStr = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "Data deve estar no formato YYYY-MM-DD")
  .refine((s) => {
    const [y, m, d] = s.split("-").map(Number);
    const dt = new Date(Date.UTC(y, m - 1, d));
    return dt.getUTCFullYear() === y && dt.getUTCMonth() === m - 1 && dt.getUTCDate() === d;
  }, "Data inválida");

/** "HH:MM" 00:00–23:59. */
export const timeStr = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, "Horário deve estar no formato HH:MM");

const scheduleInput = z.object({
  id: z.string().min(1).optional(),
  time: timeStr,
  doseQty: z.number().positive().max(1000).default(1),
});

const medicationBase = z.object({
  name: z.string().trim().min(1).max(120),
  dose: z.string().trim().max(120).nullable().optional(),
  frequency: z.enum(FREQUENCIES).default("daily"),
  daysOfWeek: z.array(z.number().int().min(0).max(6)).default([]),
  intervalDays: z.number().int().min(1).max(365).nullable().optional(),
  startDate: dateStr,
  endDate: dateStr.nullable().optional(),
  stockQty: z.number().min(0).max(100000).default(0),
  lowStockThreshold: z.number().min(0).max(100000).default(5),
  schedules: z.array(scheduleInput).max(12).default([]),
});

function issue(ctx, path, message) {
  ctx.addIssue({ code: "custom", path: [path], message });
}

export const medicationCreate = medicationBase.superRefine((v, ctx) => {
  if (v.frequency === "custom_days" && v.daysOfWeek.length === 0) issue(ctx, "daysOfWeek", "Escolha ao menos um dia da semana");
  if (v.frequency === "every_n_days" && !v.intervalDays) issue(ctx, "intervalDays", "Informe o intervalo em dias");
  if (v.endDate && v.endDate < v.startDate) issue(ctx, "endDate", "Fim antes do início");
});

/** PATCH: tudo opcional (sem defaults) + `active` para arquivar/reativar. */
export const medicationUpdate = z
  .object({
    name: z.string().trim().min(1).max(120).optional(),
    dose: z.string().trim().max(120).nullable().optional(),
    frequency: z.enum(FREQUENCIES).optional(),
    daysOfWeek: z.array(z.number().int().min(0).max(6)).optional(),
    intervalDays: z.number().int().min(1).max(365).nullable().optional(),
    startDate: dateStr.optional(),
    endDate: dateStr.nullable().optional(),
    stockQty: z.number().min(0).max(100000).optional(),
    lowStockThreshold: z.number().min(0).max(100000).optional(),
    schedules: z.array(scheduleInput).max(12).optional(),
    active: z.boolean().optional(),
  })
  .superRefine((v, ctx) => {
    if (v.frequency === "custom_days" && v.daysOfWeek && v.daysOfWeek.length === 0) {
      issue(ctx, "daysOfWeek", "Escolha ao menos um dia da semana");
    }
    if (v.endDate && v.startDate && v.endDate < v.startDate) issue(ctx, "endDate", "Fim antes do início");
  });

export const intakeInput = z.object({
  scheduleId: z.string().min(1),
  date: dateStr,
  status: z.enum(INTAKE_STATUSES),
});

export const dateQuery = z.object({ date: dateStr });

export const rangeQuery = z.object({
  from: dateStr,
  to: dateStr,
  medicationId: z.string().min(1).optional(),
});

/** Primeira mensagem de erro legível de um ZodError. */
export function zodMessage(err) {
  const i = err.issues?.[0];
  return i ? `${i.path.join(".") || "corpo"}: ${i.message}` : "Dados inválidos";
}
