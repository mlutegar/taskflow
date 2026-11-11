/**
 * routes/saude/medications.js — Saúde / Remédios (prefixo /saude/medications).
 * Dados pessoais de saúde: TODAS as rotas exigem JWT e filtram por userId.
 *
 * Preservação de histórico:
 *  - horários nunca são apagados (active=false); intakes guardam snapshot de hora/dose;
 *  - remédio é "arquivado" (active=false); o DELETE real exige ?confirm=true.
 */
import prisma from "../../prisma.js";
import { authenticate } from "../../auth.js";
import { appliesOnDate } from "../../health/schedule.js";
import { applyIntake, isLowStock, daysOfStockLeft } from "../../health/stock.js";
import {
  medicationCreate,
  medicationUpdate,
  intakeInput,
  dateQuery,
  rangeQuery,
  restockInput,
  zodMessage,
} from "../../health/validation.js";

function parseJson(val, fallback) {
  try { return JSON.parse(val); } catch { return fallback; }
}

/** Dia civil local do servidor — só usado como fallback de "hoje" quando o cliente não manda date. */
function todayServer() {
  const d = new Date();
  return [d.getFullYear(), String(d.getMonth() + 1).padStart(2, "0"), String(d.getDate()).padStart(2, "0")].join("-");
}

function httpError(statusCode, message) {
  const err = new Error(message);
  err.statusCode = statusCode;
  return err;
}

function shapeSchedule(s) {
  return { id: s.id, time: s.time, doseQty: s.doseQty, active: s.active, order: s.order };
}

/** Regra de recorrência a partir do registro do banco. */
function ruleOf(m) {
  return {
    frequency: m.frequency,
    daysOfWeek: parseJson(m.daysOfWeek, []),
    intervalDays: m.intervalDays,
    startDate: m.startDate,
    endDate: m.endDate,
  };
}

function shapeMedication(m, today) {
  const schedules = (m.schedules ?? []).filter((s) => s.active).sort((a, b) => a.time.localeCompare(b.time) || a.order - b.order);
  const rule = ruleOf(m);
  return {
    id: m.id,
    name: m.name,
    dose: m.dose,
    frequency: m.frequency,
    daysOfWeek: rule.daysOfWeek,
    intervalDays: m.intervalDays,
    startDate: m.startDate,
    endDate: m.endDate,
    stockQty: m.stockQty,
    lowStockThreshold: m.lowStockThreshold,
    lowStock: isLowStock(m.stockQty, m.lowStockThreshold),
    daysLeft: daysOfStockLeft({ ...rule, stockQty: m.stockQty }, schedules, today),
    active: m.active,
    createdAt: m.createdAt,
    schedules: schedules.map(shapeSchedule),
  };
}

export default async function medicationsRoutes(fastify) {
  fastify.addHook("preHandler", authenticate);

  // GET /saude/medications?includeArchived=true
  fastify.get("/", async (req) => {
    const includeArchived = req.query?.includeArchived === "true";
    const meds = await prisma.medication.findMany({
      where: { userId: req.userId, ...(includeArchived ? {} : { active: true }) },
      orderBy: [{ active: "desc" }, { name: "asc" }],
      include: { schedules: true },
    });
    const today = todayServer();
    return meds.map((m) => shapeMedication(m, today));
  });

  // POST /saude/medications
  fastify.post("/", async (req, reply) => {
    const parsed = medicationCreate.safeParse(req.body ?? {});
    if (!parsed.success) return reply.status(400).send({ error: zodMessage(parsed.error) });
    const v = parsed.data;
    const med = await prisma.medication.create({
      data: {
        userId: req.userId,
        name: v.name,
        dose: v.dose ?? null,
        frequency: v.frequency,
        daysOfWeek: JSON.stringify(v.daysOfWeek),
        intervalDays: v.frequency === "every_n_days" ? v.intervalDays : null,
        startDate: v.startDate,
        endDate: v.endDate ?? null,
        stockQty: v.stockQty,
        lowStockThreshold: v.lowStockThreshold,
        schedules: {
          create: v.schedules.map((s, i) => ({ time: s.time, doseQty: s.doseQty, order: i })),
        },
      },
      include: { schedules: true },
    });
    return reply.status(201).send(shapeMedication(med, todayServer()));
  });

  // PATCH /saude/medications/:id  (editar, arquivar via active=false, ajustar estoque)
  fastify.patch("/:id", async (req, reply) => {
    const parsed = medicationUpdate.safeParse(req.body ?? {});
    if (!parsed.success) return reply.status(400).send({ error: zodMessage(parsed.error) });
    const v = parsed.data;

    const updated = await prisma.$transaction(async (tx) => {
      const med = await tx.medication.findFirst({
        where: { id: req.params.id, userId: req.userId },
        include: { schedules: true },
      });
      if (!med) throw httpError(404, "Remédio não encontrado.");

      const data = {};
      for (const k of ["name", "dose", "frequency", "intervalDays", "startDate", "endDate", "stockQty", "lowStockThreshold", "active"]) {
        if (v[k] !== undefined) data[k] = v[k];
      }
      if (v.daysOfWeek !== undefined) data.daysOfWeek = JSON.stringify(v.daysOfWeek);

      // Consistência final (frequência × campos) considerando o que já existia.
      const frequency = data.frequency ?? med.frequency;
      const startDate = data.startDate ?? med.startDate;
      const endDate = data.endDate !== undefined ? data.endDate : med.endDate;
      if (endDate && endDate < startDate) throw httpError(400, "endDate: Fim antes do início");
      if (frequency === "every_n_days" && !(data.intervalDays ?? med.intervalDays)) {
        throw httpError(400, "intervalDays: Informe o intervalo em dias");
      }
      if (frequency === "custom_days" && parseJson(data.daysOfWeek ?? med.daysOfWeek, []).length === 0) {
        throw httpError(400, "daysOfWeek: Escolha ao menos um dia da semana");
      }
      if (frequency !== "every_n_days") data.intervalDays = null;

      await tx.medication.update({ where: { id: med.id }, data });

      // Sincroniza horários SEM apagar: ids ausentes viram active=false (intakes antigos intactos).
      if (v.schedules) {
        const existing = new Map(med.schedules.map((s) => [s.id, s]));
        const keep = new Set();
        for (let i = 0; i < v.schedules.length; i++) {
          const s = v.schedules[i];
          if (s.id && existing.has(s.id)) {
            keep.add(s.id);
            await tx.medicationSchedule.update({
              where: { id: s.id },
              data: { time: s.time, doseQty: s.doseQty, order: i, active: true },
            });
          } else {
            await tx.medicationSchedule.create({
              data: { medicationId: med.id, time: s.time, doseQty: s.doseQty, order: i },
            });
          }
        }
        const toDeactivate = med.schedules.filter((s) => s.active && !keep.has(s.id)).map((s) => s.id);
        if (toDeactivate.length) {
          await tx.medicationSchedule.updateMany({ where: { id: { in: toDeactivate } }, data: { active: false } });
        }
      }

      return tx.medication.findUnique({ where: { id: med.id }, include: { schedules: true } });
    });

    return shapeMedication(updated, todayServer());
  });

  // POST /saude/medications/:id/restock { qty }  — soma qty ao estoque (reposição rápida)
  fastify.post("/:id/restock", async (req, reply) => {
    const parsed = restockInput.safeParse(req.body ?? {});
    if (!parsed.success) return reply.status(400).send({ error: zodMessage(parsed.error) });
    const med = await prisma.medication.findFirst({ where: { id: req.params.id, userId: req.userId } });
    if (!med) return reply.status(404).send({ error: "Remédio não encontrado." });
    // increment atômico: duas reposições simultâneas não se sobrescrevem
    const updated = await prisma.medication.update({
      where: { id: med.id },
      data: { stockQty: { increment: parsed.data.qty } },
      include: { schedules: true },
    });
    return shapeMedication(updated, todayServer());
  });

  // DELETE /saude/medications/:id?confirm=true  (apaga também o histórico!)
  fastify.delete("/:id", async (req, reply) => {
    if (req.query?.confirm !== "true") {
      return reply.status(400).send({
        error: "Excluir apaga também todo o histórico deste remédio. Para arquivar use PATCH active=false; para excluir de vez envie ?confirm=true.",
      });
    }
    const med = await prisma.medication.findFirst({ where: { id: req.params.id, userId: req.userId } });
    if (!med) return reply.status(404).send({ error: "Remédio não encontrado." });
    await prisma.medication.delete({ where: { id: med.id } });
    return reply.status(204).send();
  });

  // GET /saude/medications/today?date=YYYY-MM-DD
  fastify.get("/today", async (req, reply) => {
    const q = dateQuery.safeParse(req.query ?? {});
    if (!q.success) return reply.status(400).send({ error: zodMessage(q.error) });
    const { date } = q.data;

    const meds = await prisma.medication.findMany({
      where: { userId: req.userId, active: true },
      include: { schedules: { where: { active: true } } },
    });
    const due = meds.filter((m) => appliesOnDate(ruleOf(m), date));
    const intakes = await prisma.medicationIntake.findMany({
      where: { userId: req.userId, date, medicationId: { in: due.map((m) => m.id) } },
    });
    const bySchedule = new Map(intakes.map((i) => [i.scheduleId, i]));

    const items = [];
    for (const m of due) {
      for (const s of m.schedules) {
        const intake = bySchedule.get(s.id);
        items.push({
          medicationId: m.id,
          name: m.name,
          dose: m.dose,
          scheduleId: s.id,
          // Dose já registrada mostra o horário do snapshot; pendente usa o horário atual.
          time: intake?.scheduledTime ?? s.time,
          doseQty: intake?.doseQty ?? s.doseQty,
          status: intake?.status ?? "pending",
          takenAt: intake?.takenAt ?? null,
          stockQty: m.stockQty,
          lowStock: isLowStock(m.stockQty, m.lowStockThreshold),
        });
      }
    }
    items.sort((a, b) => a.time.localeCompare(b.time) || a.name.localeCompare(b.name));
    return { date, items };
  });

  // PUT /saude/medications/intakes  { scheduleId, date, status: taken|skipped|pending }
  fastify.put("/intakes", async (req, reply) => {
    const parsed = intakeInput.safeParse(req.body ?? {});
    if (!parsed.success) return reply.status(400).send({ error: zodMessage(parsed.error) });
    const { scheduleId, date, status } = parsed.data;

    const result = await prisma.$transaction(async (tx) => {
      const sched = await tx.medicationSchedule.findFirst({
        where: { id: scheduleId, active: true, medication: { userId: req.userId } },
        include: { medication: true },
      });
      if (!sched) throw httpError(404, "Horário não encontrado.");

      const prev = await tx.medicationIntake.findFirst({ where: { scheduleId, date } });
      const { intake, stock } = applyIntake(prev, status, sched.doseQty, sched.medication.stockQty);

      if (stock !== sched.medication.stockQty) {
        await tx.medication.update({ where: { id: sched.medicationId }, data: { stockQty: stock } });
      }

      let saved = null;
      if (!intake) {
        if (prev) await tx.medicationIntake.delete({ where: { id: prev.id } });
      } else if (prev) {
        saved = await tx.medicationIntake.update({
          where: { id: prev.id },
          data: {
            status: intake.status,
            doseQty: intake.doseQty,
            takenAt: intake.status === "taken" ? (prev.takenAt ?? new Date()) : null,
          },
        });
      } else {
        saved = await tx.medicationIntake.create({
          data: {
            userId: req.userId,
            medicationId: sched.medicationId,
            scheduleId,
            date,
            scheduledTime: sched.time,
            status: intake.status,
            doseQty: intake.doseQty,
            takenAt: intake.status === "taken" ? new Date() : null,
          },
        });
      }
      return {
        status: saved?.status ?? "pending",
        stockQty: stock,
        lowStock: isLowStock(stock, sched.medication.lowStockThreshold),
        intake: saved,
      };
    });

    return result;
  });

  // GET /saude/medications/history?from=&to=&medicationId=
  fastify.get("/history", async (req, reply) => {
    const q = rangeQuery.safeParse(req.query ?? {});
    if (!q.success) return reply.status(400).send({ error: zodMessage(q.error) });
    const { from, to, medicationId } = q.data;
    if (to < from) return reply.status(400).send({ error: "to: Fim antes do início" });

    const rows = await prisma.medicationIntake.findMany({
      where: {
        userId: req.userId,
        date: { gte: from, lte: to },
        ...(medicationId ? { medicationId } : {}),
      },
      include: { medication: { select: { name: true, dose: true } } },
      orderBy: [{ date: "desc" }, { scheduledTime: "desc" }],
      take: 1000,
    });
    return rows.map((r) => ({
      id: r.id,
      medicationId: r.medicationId,
      medicationName: r.medication.name,
      dose: r.medication.dose,
      date: r.date,
      scheduledTime: r.scheduledTime,
      status: r.status,
      doseQty: r.doseQty,
      takenAt: r.takenAt,
    }));
  });
}
