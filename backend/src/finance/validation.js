/** finance/validation.js — zod das rotas de Finanças. Valores em centavos (Int positivo). */
import { z } from "zod";
import { dateStr } from "../health/validation.js";

export { dateStr, zodMessage } from "../health/validation.js";

export const TYPES = ["expense", "income"];
export const PAYMENT_METHODS = ["pix", "dinheiro", "debito", "credito", "boleto", "outro"];

export const monthStr = z.string().regex(/^\d{4}-(0[1-9]|1[0-2])$/, "Mês deve estar no formato YYYY-MM");
export const cents = z
  .number()
  .int("Valor deve estar em centavos (inteiro)")
  .positive("Valor deve ser maior que zero")
  .max(10_000_000_000);

const optText = (n) => z.string().trim().max(n).nullable().optional();
const category = z.string().min(1).nullable().optional();
const payment = z.enum(PAYMENT_METHODS).nullable().optional();
const color = z.string().regex(/^#[0-9a-fA-F]{6}$/, "Cor inválida").nullable().optional();

export const monthQuery = z.object({ month: monthStr });

export const entryCreate = z.object({
  type: z.enum(TYPES),
  amountCents: cents,
  date: dateStr,
  categoryId: category,
  description: optText(200),
  paymentMethod: payment,
});
export const entryUpdate = entryCreate.partial().refine((o) => Object.keys(o).length > 0, "Nada para atualizar");

export const seriesCreate = z
  .object({
    type: z.enum(TYPES),
    kind: z.enum(["monthly", "installment"]),
    amountCents: cents, // mensal: valor do mês; parcelado: TOTAL
    installments: z.number().int().min(2).max(120).optional(),
    startDate: dateStr,
    categoryId: category,
    description: optText(200),
    paymentMethod: payment,
  })
  .superRefine((v, ctx) => {
    if (v.kind === "installment" && !v.installments)
      ctx.addIssue({ code: "custom", path: ["installments"], message: "Informe o nº de parcelas" });
    if (v.kind === "installment" && v.installments && v.amountCents < v.installments)
      ctx.addIssue({ code: "custom", path: ["amountCents"], message: "Total menor que o nº de parcelas" });
    if (v.kind === "monthly" && v.installments)
      ctx.addIssue({ code: "custom", path: ["installments"], message: "Fixo mensal não tem parcelas" });
  });

/** Edição cosmética (não altera valores nem meses passados). */
export const seriesCosmetic = z
  .object({ description: optText(200), paymentMethod: payment })
  .refine((o) => Object.keys(o).length > 0, "Nada para atualizar");

/** Revisão "a partir de um mês" (só fixo mensal). */
export const seriesRevise = z.object({
  effectiveMonth: monthStr,
  amountCents: cents.optional(),
  categoryId: category,
  description: optText(200),
  paymentMethod: payment,
  dayOfMonth: z.number().int().min(1).max(31).optional(),
});

export const seriesEnd = z.object({ fromMonth: monthStr });

export const exceptionBody = z.object({
  skipped: z.boolean().default(false),
  amountCents: cents.nullable().optional(),
});

export const categoryCreate = z.object({
  name: z.string().trim().min(1).max(60),
  kind: z.enum(TYPES),
  emoji: z.string().trim().max(8).nullable().optional(),
  color,
});
export const categoryUpdate = z
  .object({
    name: z.string().trim().min(1).max(60).optional(),
    emoji: z.string().trim().max(8).nullable().optional(),
    color,
    order: z.number().int().min(0).max(10000).optional(),
    active: z.boolean().optional(),
  })
  .refine((o) => Object.keys(o).length > 0, "Nada para atualizar");
