/** health/workoutValidation.js — validações zod de Exercícios. */
import { z } from "zod";
import { dateStr } from "./validation.js";

const type = z.string().trim().min(1).max(60);
const duration = z.number().int().min(1).max(1440);

export const workoutCreate = z.object({
  date: dateStr,
  type,
  durationMin: duration,
  notes: z.string().trim().max(1000).nullable().optional(),
  planId: z.string().min(1).nullable().optional(),
});

export const workoutUpdate = z.object({
  date: dateStr.optional(),
  type: type.optional(),
  durationMin: duration.optional(),
  notes: z.string().trim().max(1000).nullable().optional(),
});

export const planCreate = z.object({
  weekday: z.number().int().min(0).max(6),
  type,
  durationMin: duration.nullable().optional(),
});

export const planUpdate = z.object({
  weekday: z.number().int().min(0).max(6).optional(),
  type: type.optional(),
  durationMin: duration.nullable().optional(),
});
