import { z } from "zod";
import prisma from "../prisma.js";
import { authenticate } from "../auth.js";
import { computeNextDueDate, dateInTimeZone, parseRecurrenceRule, storedDate, validTimeZone } from "../taskRecurrence.js";
import { isVersionConflict } from "../taskVersion.js";
import { ALLOWED_TIME_BUCKETS, estimatedTimeWhere } from "../taskEstimatedTime.js";
import {
  installTaskIdempotency,
  parseSnapshot,
  recordTaskChange,
  subscribeTaskEvents,
  syncMetric,
  syncMetrics,
} from "../taskSyncInfrastructure.js";

// ── Zod schemas ───────────────────────────────────────────────────────────────
const ALLOWED_SORTS = new Set(["due_date_asc", "due_date", "due_date_desc", "created", "priority", "estimated"]);

const recurrenceValues = ["daily", "weekdays", "weekly", "biweekly", "monthly", "monthly_first", "yearly", "custom"];
const recurrenceRuleSchema = z.object({
  type: z.enum(["interval", "weekdays"]).optional(),
  intervalDays: z.number().int().min(1).max(365).optional(),
  weekdays: z.array(z.number().int().min(0).max(6)).max(7).optional(),
  skipWeekends: z.boolean().optional(),
  skipHolidays: z.boolean().optional(),
  reminderDaysBefore: z.number().int().min(0).max(365).optional(),
  birthdayYear: z.number().int().min(1900).max(new Date().getFullYear()).optional(),
}).optional().nullable();

const createTaskSchema = z.object({
  client_id:   z.string().uuid().optional(),
  title:       z.string().min(1, "Título obrigatório.").max(255),
  description: z.string().max(10000).optional().nullable(),
  priority:    z.number().int().min(1).max(4).optional(),
  due_date:    z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Data inválida (YYYY-MM-DD).").optional().nullable(),
  due_time:    z.string().regex(/^\d{2}:\d{2}$/, "Hora inválida (HH:MM).").optional().nullable(),
  recurrence:  z.enum(recurrenceValues).optional().nullable(),
  recurrence_rule: recurrenceRuleSchema,
  project_id: z.string().uuid().optional().nullable(),
  estimated_minutes: z.number().int().min(0).max(1440).optional().nullable(),
  actual_minutes: z.number().int().min(0).max(10080).optional().nullable(),
  orbita_projects: z.array(z.string().max(500)).max(50).optional().nullable(),
  orbita_prompt: z.string().max(10000).optional().nullable(),
  assigned_to: z.string().uuid().optional().nullable(),
});

const updateTaskSchema = z.object({
  title:        z.string().min(1).max(255).optional(),
  description:  z.string().max(10000).optional().nullable(),
  priority:     z.number().int().min(1).max(4).optional(),
  completed:    z.boolean().optional(),
  completed_at: z.string().optional().nullable(),
  due_date:     z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional().nullable(),
  due_time:     z.string().regex(/^\d{2}:\d{2}$/).optional().nullable(),
  recurrence:   z.enum(recurrenceValues).optional().nullable(),
  recurrence_rule: recurrenceRuleSchema,
  project_id: z.string().uuid().optional().nullable(),
  estimated_minutes: z.number().int().min(0).max(1440).optional().nullable(),
  actual_minutes: z.number().int().min(0).max(10080).optional().nullable(),
  orbita_projects: z.array(z.string().max(500)).max(50).optional().nullable(),
  orbita_prompt: z.string().max(10000).optional().nullable(),
  assigned_to: z.string().uuid().optional().nullable(),
  // Versão esperada pelo cliente. Se enviada e divergir da do servidor,
  // a edição é rejeitada com 409 (outra aba/dispositivo alterou antes).
  version:      z.number().int().min(0).optional(),
});

// ── Helpers ───────────────────────────────────────────────────────────────────

/** Recorrências que contam como "rotina" no painel/heatmap da aba Tarefas. */
const ROUTINE_RECURRENCES = ["daily", "weekdays"];
/** Teto do período pedido no heatmap (~13 meses). */
const MAX_CONSISTENCY_DAYS = 400;
/** Teto do histórico varrido para calcular a melhor sequência (~3 anos). */
const MAX_HISTORY_DAYS = 1100;

/** Soma dias a uma data ISO (YYYY-MM-DD), sem sofrer com fuso/DST. */
function shiftISO(isoDate, days) {
  const base = new Date(`${isoDate}T00:00:00.000Z`);
  base.setUTCDate(base.getUTCDate() + days);
  return base.toISOString().slice(0, 10);
}

/** Diferença em dias entre duas datas ISO (to - from). */
function diffISO(fromISO, toISO) {
  const a = Date.parse(`${fromISO}T00:00:00.000Z`);
  const b = Date.parse(`${toISO}T00:00:00.000Z`);
  return Math.round((b - a) / 86_400_000);
}

/**
 * Maior sequência de dias 100% concluídos. Dias sem rotina agendada são
 * neutros: não contam e não quebram a sequência.
 *
 * `onlyIndex` restringe o cálculo a uma rotina específica (usado para o filtro
 * "por rotina" do heatmap); sem ele, considera todas as rotinas do dia.
 */
function bestFullDayStreak(days, onlyIndex = null) {
  let best = 0;
  let run = 0;
  for (const day of days) {
    const expected = onlyIndex === null
      ? day.expected.length
      : (day.expected.includes(onlyIndex) ? 1 : 0);
    if (expected === 0) continue;
    const completed = onlyIndex === null
      ? day.completed.length
      : (day.completed.includes(onlyIndex) ? 1 : 0);
    if (completed >= expected) {
      run += 1;
      if (run > best) best = run;
    } else {
      run = 0;
    }
  }
  return best;
}

async function requestCalendar(req) {
  const headerZone = req.headers["x-timezone"];
  if (headerZone) {
    const timeZone = validTimeZone(headerZone);
    return { timeZone, today: dateInTimeZone(new Date(), timeZone) };
  }
  const prefs = await prisma.userPreferences.findUnique({
    where: { userId: req.userId }, select: { timezone: true },
  });
  const timeZone = validTimeZone(prefs?.timezone);
  return { timeZone, today: dateInTimeZone(new Date(), timeZone) };
}

async function projectAndDescendantIds(userId, projectId) {
  const projects = await prisma.project.findMany({ where: { userId }, select: { id: true, parentId: true } });
  if (!projects.some((project) => project.id === projectId)) return null;
  const ids = new Set([projectId]);
  let changed = true;
  while (changed) {
    changed = false;
    for (const project of projects) {
      if (project.parentId && ids.has(project.parentId) && !ids.has(project.id)) {
        ids.add(project.id);
        changed = true;
      }
    }
  }
  return [...ids];
}

async function validateProject(userId, projectId) {
  if (!projectId) return true;
  return Boolean(await prisma.project.findFirst({ where: { id: projectId, userId, archived: false }, select: { id: true } }));
}

// Recorrências ficam concluídas até o dia da próxima ocorrência. Ao chegar
// esse dia, elas voltam a ser ativas e o checklist começa limpo.
async function reactivateDueRecurringTasks(userId, today) {
  const due = await prisma.task.findMany({
    where: {
      createdBy: userId,
      completed: true,
      recurrence: { not: null },
      dueDate: { lte: storedDate(today) },
    },
    select: { id: true },
  });
  if (due.length === 0) return;

  const ids = due.map((task) => task.id);
  await prisma.$transaction([
    prisma.task.updateMany({
      where: { id: { in: ids }, createdBy: userId },
      data: { completed: false, completedAt: null },
    }),
    prisma.checklistItem.updateMany({
      where: { taskId: { in: ids } },
      data: { completed: false },
    }),
  ]);
}

// Compatibilidade com o comportamento antigo, que avançava a data mas deixava
// a tarefa como ativa. Se ela já tem uma conclusão e a próxima data é futura,
// deve permanecer concluída até essa data chegar.
async function normalizePreviouslyCompletedRecurrences(userId, today) {
  await prisma.task.updateMany({
    where: {
      createdBy: userId,
      completed: false,
      completedAt: { not: null },
      recurrence: { not: null },
      dueDate: { gt: storedDate(today) },
    },
    data: { completed: true },
  });
}

// Projetos do Órbita associados ficam serializados como JSON (compat SQLite).
function parseOrbitaProjects(raw) {
  if (!raw) return [];
  try {
    const arr = JSON.parse(raw);
    return Array.isArray(arr) ? arr.filter((s) => typeof s === "string" && s.trim()) : [];
  } catch {
    return [];
  }
}

function parseJsonArray(raw) {
  if (!raw) return [];
  try {
    const arr = JSON.parse(raw);
    return Array.isArray(arr) ? arr : [];
  } catch {
    return [];
  }
}

function shapeTask(task) {
  const checklist = (task.checklist ?? []).sort((a, b) => a.order - b.order || Number(a.id) - Number(b.id));
  return {
    ...task,
    created_by: task.createdBy,
    assigned_to: task.assignedTo ?? null,
    due_date: task.dueDate?.toISOString().slice(0, 10) ?? null,
    due_time: task.dueTime ?? null,
    project_id: task.projectId ?? null,
    estimated_minutes: task.estimatedMinutes ?? null,
    actual_minutes: task.actualMinutes ?? null,
    orbita_projects: parseOrbitaProjects(task.orbitaProjects),
    orbita_prompt: task.orbitaPrompt ?? null,
    orbita_last_key: task.orbitaLastKey ?? null,
    orbita_last_provider: task.orbitaLastProvider ?? null,
    orbita_history: parseJsonArray(task.orbitaHistory),
    updated_at: task.updatedAt?.toISOString() ?? null,
    completed_at: task.completedAt?.toISOString() ?? null,
    recurrence_rule: parseRecurrenceRule(task.recurrenceRule),
    checklist,
    checklist_count: checklist.length,
    checklist_completed_count: checklist.filter((c) => c.completed).length,
  };
}

function snapshotToTaskData(snapshot) {
  return {
    title: snapshot.title,
    description: snapshot.description ?? null,
    priority: snapshot.priority ?? 4,
    completed: Boolean(snapshot.completed),
    dueDate: snapshot.due_date ? storedDate(snapshot.due_date) : null,
    dueTime: snapshot.due_time ?? null,
    recurrence: snapshot.recurrence ?? null,
    recurrenceRule: snapshot.recurrence_rule ? JSON.stringify(snapshot.recurrence_rule) : null,
    projectId: snapshot.project_id ?? null,
    estimatedMinutes: snapshot.estimated_minutes ?? null,
    actualMinutes: snapshot.actual_minutes ?? null,
    orbitaProjects: Array.isArray(snapshot.orbita_projects) ? JSON.stringify(snapshot.orbita_projects) : null,
    orbitaPrompt: snapshot.orbita_prompt ?? null,
    completedAt: snapshot.completed_at ? new Date(snapshot.completed_at) : null,
    deletedAt: null,
    version: { increment: 1 },
  };
}

const MUTATION_RATE_LIMIT = {
  config: {
    rateLimit: {
      max: 100,
      timeWindow: 5 * 60 * 1000,
      keyGenerator: (req) => req.userId ?? req.ip,
      errorResponseBuilder: () => ({
        statusCode: 429,
        error: "Too Many Requests",
        message: "Muitas requisições. Tente novamente em alguns minutos.",
      }),
    },
  },
};

export default async function tasksRoutes(fastify) {
  fastify.addHook("preHandler", authenticate);
  installTaskIdempotency(fastify);

  // Stream autenticado consumido com fetch streaming (EventSource não permite
  // o header Authorization). Heartbeats mantêm proxies/túneis ativos.
  fastify.get("/sync/events", async (req, reply) => {
    reply.hijack();
    reply.raw.writeHead(200, {
      "Content-Type": "text/event-stream; charset=utf-8",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no",
    });
    reply.raw.write(`event: ready\ndata: ${JSON.stringify({ at: new Date().toISOString() })}\n\n`);
    const send = (event) => reply.raw.write(`id: ${event.id}\nevent: task-change\ndata: ${JSON.stringify(event)}\n\n`);
    const unsubscribe = subscribeTaskEvents(req.userId, send);
    const heartbeat = setInterval(() => reply.raw.write(": heartbeat\n\n"), 20_000);
    req.raw.on("close", () => { clearInterval(heartbeat); unsubscribe(); });
  });

  fastify.get("/sync/metrics", async () => ({ ...syncMetrics(), uptime_seconds: Math.round(process.uptime()) }));

  // GET /tasks
  fastify.get("/", async (req) => {
    const { status, sort: rawSort, project_id: projectId, time: rawTime, assigned_to, priorities, due_filter } = req.query;
    const userId = req.userId;

    const { today } = await requestCalendar(req);
    await normalizePreviouslyCompletedRecurrences(userId, today);
    await reactivateDueRecurringTasks(userId, today);

    // Whitelist de valores permitidos para sort
    const sort = ALLOWED_SORTS.has(rawSort) ? rawSort : "priority";

    const where = { createdBy: userId, deletedAt: null };
    if (status === "active") where.completed = false;
    else if (status === "today") {
      where.OR = [
        {
          completed: false,
          OR: [{ dueDate: null }, { dueDate: { lte: storedDate(today) } }],
        },
        {
          completed: true,
          completions: { some: { scheduledFor: storedDate(today), undoneAt: null } },
        },
      ];
    }
    else if (status === "upcoming") {
      where.completed = false;
      where.dueDate = { gt: storedDate(today) };
    }
    else if (status === "completed") where.completed = true;
    else if (status === "yearly") where.recurrence = "yearly";

    if (projectId === "none") {
      where.projectId = null;
    } else if (projectId) {
      const ids = await projectAndDescendantIds(userId, projectId);
      if (!ids) return [];
      where.projectId = { in: ids };
    }

    // Filtro por responsável
    if (assigned_to === "me") {
      where.OR = [
        { assignedTo: userId },
        { assignedTo: null },
      ];
    } else if (assigned_to === "none") {
      where.assignedTo = null;
    } else if (assigned_to) {
      // UUID específico (futuro: multi-user)
      where.assignedTo = assigned_to;
    }

    // Filtro por prioridades (multisseleção: "1,2")
    if (priorities) {
      const prioList = priorities.split(",").map(Number).filter((p) => p >= 1 && p <= 4);
      if (prioList.length > 0) {
        where.priority = { in: prioList };
      }
    }

    // Filtro por vencimento
    if (due_filter === "overdue") {
      where.dueDate = { lt: storedDate(today) };
      where.completed = false;
    } else if (due_filter === "today") {
      where.dueDate = storedDate(today);
    } else if (due_filter === "this_week") {
      const todayDate = new Date(today);
      const endOfWeek = new Date(todayDate);
      endOfWeek.setDate(todayDate.getDate() + (7 - todayDate.getDay()));
      where.dueDate = {
        gte: storedDate(today),
        lte: storedDate(endOfWeek.toISOString().slice(0, 10)),
      };
    } else if (due_filter === "no_date") {
      where.dueDate = null;
    }

    // Filtro por tempo estimado (faixas) — limites vêm de taskEstimatedTime.js
    const time = ALLOWED_TIME_BUCKETS.has(rawTime) ? rawTime : null;
    if (time === "none") where.estimatedMinutes = null;
    else if (time) {
      const fragment = estimatedTimeWhere(time);
      if (fragment) where.estimatedMinutes = fragment;
    }

    let orderBy;
    if (sort === "due_date_asc" || sort === "due_date") {
      orderBy = [{ dueDate: "asc" }, { priority: "asc" }];
    } else if (sort === "due_date_desc") {
      orderBy = [{ dueDate: "desc" }, { priority: "asc" }];
    } else if (sort === "created") {
      orderBy = [{ createdAt: "desc" }];
    } else if (sort === "estimated") {
      orderBy = [{ estimatedMinutes: { sort: "asc", nulls: "last" } }, { priority: "asc" }];
    } else {
      orderBy = [{ priority: "asc" }, { createdAt: "desc" }];
    }

    const tasks = await prisma.task.findMany({
      where,
      orderBy,
      include: { checklist: true },
    });

    return tasks.map((t) => shapeTask({ ...t, checklist: t.checklist }));
  });

  // Busca granular usada pelos eventos em tempo real, sem recarregar a lista toda.
  fastify.get("/:id", async (req, reply) => {
    const task = await prisma.task.findFirst({
      where: { id: req.params.id, createdBy: req.userId, deletedAt: null }, include: { checklist: true },
    });
    if (!task) return reply.status(404).send({ error: "Tarefa não encontrada." });
    return shapeTask(task);
  });

  fastify.get("/:id/changes", async (req, reply) => {
    const task = await prisma.task.findFirst({ where: { id: req.params.id, createdBy: req.userId }, select: { id: true } });
    const hasHistory = await prisma.taskChange.findFirst({ where: { taskId: req.params.id, userId: req.userId }, select: { id: true } });
    if (!task && !hasHistory) return reply.status(404).send({ error: "Tarefa não encontrada." });
    const rows = await prisma.taskChange.findMany({
      where: { taskId: req.params.id, userId: req.userId }, orderBy: { createdAt: "desc" }, take: 100,
    });
    return rows.map((row) => ({
      id: row.id,
      task_id: row.taskId,
      action: row.action,
      before: parseSnapshot(row.before),
      after: parseSnapshot(row.after),
      metadata: parseSnapshot(row.metadata),
      created_at: row.createdAt.toISOString(),
      undone_at: row.undoneAt?.toISOString() ?? null,
      can_undo: !row.undoneAt && ["create", "update", "delete", "restore"].includes(row.action),
    }));
  });

  fastify.post("/changes/:changeId/undo", MUTATION_RATE_LIMIT, async (req, reply) => {
    const changeId = Number(req.params.changeId);
    if (!Number.isInteger(changeId)) return reply.status(400).send({ error: "Alteração inválida." });
    const change = await prisma.taskChange.findFirst({ where: { id: changeId, userId: req.userId, undoneAt: null } });
    if (!change?.taskId) return reply.status(404).send({ error: "Alteração não encontrada." });
    const before = parseSnapshot(change.before);
    let task;
    await prisma.$transaction(async (tx) => {
      if (change.action === "update" && before) {
        task = await tx.task.update({ where: { id: change.taskId }, data: snapshotToTaskData(before), include: { checklist: true } });
      } else if (change.action === "delete") {
        task = await tx.task.update({ where: { id: change.taskId }, data: { deletedAt: null, version: { increment: 1 } }, include: { checklist: true } });
      } else if (change.action === "create" || change.action === "restore") {
        task = await tx.task.update({ where: { id: change.taskId }, data: { deletedAt: new Date(), version: { increment: 1 } }, include: { checklist: true } });
      } else {
        const error = new Error("Esta alteração não pode ser desfeita automaticamente.");
        error.statusCode = 400;
        throw error;
      }
      await tx.taskChange.update({ where: { id: change.id }, data: { undoneAt: new Date() } });
    });
    const shaped = shapeTask(task);
    await recordTaskChange({ userId: req.userId, taskId: change.taskId, action: "undo", after: shaped, metadata: { changeId } });
    return shaped;
  });

  // POST /tasks
  fastify.post("/", MUTATION_RATE_LIMIT, async (req, reply) => {
    const parsed = createTaskSchema.safeParse(req.body ?? {});
    if (!parsed.success) {
      return reply.status(400).send({
        error: "Dados inválidos.",
        details: parsed.error.flatten().fieldErrors,
      });
    }
    const { client_id, title, description, priority, due_date, due_time, recurrence, recurrence_rule, project_id, estimated_minutes, actual_minutes, orbita_projects, orbita_prompt, assigned_to } = parsed.data;
    if (!(await validateProject(req.userId, project_id))) {
      return reply.status(400).send({ error: "Projeto inválido ou arquivado." });
    }

    // Herança: sem estimativa explícita, usa o padrão do projeto (se houver).
    let estimatedMinutes = estimated_minutes ?? null;
    if (estimatedMinutes == null && project_id) {
      const project = await prisma.project.findFirst({
        where: { id: project_id, createdBy: req.userId }, select: { defaultEstimatedMinutes: true },
      });
      estimatedMinutes = project?.defaultEstimatedMinutes ?? null;
    }

    const task = await prisma.task.create({
      data: {
        ...(client_id ? { id: client_id } : {}),
        createdBy: req.userId,
        assignedTo: assigned_to ?? req.userId,
        title,
        description,
        priority: priority ?? 4,
        dueDate: due_date ? storedDate(due_date) : null,
        dueTime: due_time ?? null,
        recurrence,
        recurrenceRule: recurrence_rule ? JSON.stringify(recurrence_rule) : null,
        projectId: project_id || null,
        estimatedMinutes,
        actualMinutes: actual_minutes ?? null,
        orbitaProjects: orbita_projects?.length ? JSON.stringify(orbita_projects) : null,
        orbitaPrompt: orbita_prompt ?? null,
      },
      include: { checklist: true },
    });
    const shaped = shapeTask({ ...task, checklist: task.checklist });
    await recordTaskChange({ userId: req.userId, taskId: task.id, action: "create", after: shaped });
    reply.status(201);
    return shaped;
  });

  // PATCH /tasks/:id
  fastify.patch("/:id", MUTATION_RATE_LIMIT, async (req, reply) => {
    const { id } = req.params;

    const parsed = updateTaskSchema.safeParse(req.body ?? {});
    if (!parsed.success) {
      return reply.status(400).send({
        error: "Dados inválidos.",
        details: parsed.error.flatten().fieldErrors,
      });
    }
    const body = parsed.data;

    // Mapeia campos snake_case → camelCase do Prisma
    const data = {};
    if (body.title !== undefined) data.title = body.title;
    if (body.description !== undefined) data.description = body.description;
    if (body.priority !== undefined) data.priority = body.priority;
    if (body.completed !== undefined) data.completed = body.completed;
    if (body.completed_at !== undefined) data.completedAt = body.completed_at ? new Date(body.completed_at) : null;
    if (body.due_date !== undefined) data.dueDate = body.due_date ? storedDate(body.due_date) : null;
    if (body.due_time !== undefined) data.dueTime = body.due_time ?? null;
    if (body.recurrence !== undefined) data.recurrence = body.recurrence;
    if (body.recurrence_rule !== undefined) data.recurrenceRule = body.recurrence_rule ? JSON.stringify(body.recurrence_rule) : null;
    if (body.estimated_minutes !== undefined) data.estimatedMinutes = body.estimated_minutes ?? null;
    if (body.actual_minutes !== undefined) data.actualMinutes = body.actual_minutes ?? null;
    if (body.orbita_projects !== undefined) data.orbitaProjects = body.orbita_projects?.length ? JSON.stringify(body.orbita_projects) : null;
    if (body.orbita_prompt !== undefined) data.orbitaPrompt = body.orbita_prompt ?? null;
    if (body.assigned_to !== undefined) data.assignedTo = body.assigned_to || null;
    if (body.project_id !== undefined) {
      if (!(await validateProject(req.userId, body.project_id))) {
        return reply.status(400).send({ error: "Projeto inválido ou arquivado." });
      }
      data.projectId = body.project_id || null;
    }

    const existing = await prisma.task.findFirst({ where: { id, createdBy: req.userId } });
    if (!existing) return reply.status(404).send({ error: "Tarefa não encontrada." });

    // Versionamento otimista: se o cliente informou a versão que tinha em mãos
    // e ela não bate com a atual, outra origem alterou a tarefa nesse meio-tempo.
    if (isVersionConflict(existing.version, body.version)) {
      syncMetric("conflicts");
      const current = await prisma.task.findFirst({ where: { id }, include: { checklist: true } });
      return reply.status(409).send({
        error: "Esta tarefa foi alterada em outro lugar. Recarregamos a versão mais recente.",
        task: shapeTask({ ...current, checklist: current.checklist }),
      });
    }

    // O filtro por `version` na própria escrita fecha a janela entre a leitura
    // acima e o update: duas requisições com a mesma versão não podem vencer.
    data.version = { increment: 1 };
    if (body.version !== undefined) {
      const changed = await prisma.task.updateMany({
        where: { id, createdBy: req.userId, version: body.version },
        data,
      });
      if (changed.count === 0) {
        syncMetric("conflicts");
        const current = await prisma.task.findFirst({ where: { id, createdBy: req.userId }, include: { checklist: true } });
        if (!current) return reply.status(404).send({ error: "Tarefa não encontrada." });
        return reply.status(409).send({
          error: "Esta tarefa foi alterada em outro lugar. Recarregamos a versão mais recente.",
          task: shapeTask({ ...current, checklist: current.checklist }),
        });
      }
    } else {
      await prisma.task.update({ where: { id }, data });
    }
    const task = await prisma.task.findFirst({ where: { id, createdBy: req.userId }, include: { checklist: true } });
    const before = shapeTask({ ...existing, checklist: [] });
    const after = shapeTask({ ...task, checklist: task.checklist });
    await recordTaskChange({ userId: req.userId, taskId: id, action: "update", before, after });
    return after;
  });

  // DELETE /tasks/:id
  fastify.delete("/:id", MUTATION_RATE_LIMIT, async (req, reply) => {
    const { id } = req.params;
    const existing = await prisma.task.findFirst({ where: { id, createdBy: req.userId, deletedAt: null }, include: { checklist: true } });
    if (!existing) return reply.status(404).send({ error: "Tarefa não encontrada." });
    await prisma.task.update({ where: { id }, data: { deletedAt: new Date(), version: { increment: 1 } } });
    await recordTaskChange({ userId: req.userId, taskId: id, action: "delete", before: shapeTask(existing) });
    reply.status(204).send();
  });

  fastify.post("/:id/restore", MUTATION_RATE_LIMIT, async (req, reply) => {
    const task = await prisma.task.findFirst({ where: { id: req.params.id, createdBy: req.userId, deletedAt: { not: null } }, include: { checklist: true } });
    if (!task) return reply.status(404).send({ error: "Tarefa excluída não encontrada." });
    const restored = await prisma.task.update({
      where: { id: task.id }, data: { deletedAt: null, version: { increment: 1 } }, include: { checklist: true },
    });
    const shaped = shapeTask(restored);
    await recordTaskChange({ userId: req.userId, taskId: task.id, action: "restore", before: shapeTask(task), after: shaped });
    return shaped;
  });

  // POST /tasks/:id/complete
  fastify.post("/:id/complete", MUTATION_RATE_LIMIT, async (req, reply) => {
    const { id } = req.params;
    const { timeZone, today } = await requestCalendar(req);
    const result = await prisma.$transaction(async (tx) => {
      const task = await tx.task.findFirst({ where: { id, createdBy: req.userId }, include: { checklist: true } });
      if (!task) return null;

      // Idempotência: toque duplo não avança a recorrência duas vezes.
      if (task.completed) {
        const latest = await tx.taskCompletion.findFirst({
          where: { taskId: id, userId: req.userId, undoneAt: null }, orderBy: { completedAt: "desc" },
        });
        return { task, completion: latest, alreadyCompleted: true };
      }

      const completedAt = new Date();
      const previousDueDate = task.dueDate;
      const nextDate = task.recurrence
        ? computeNextDueDate(
            task.dueDate?.toISOString().slice(0, 10), task.recurrence,
            parseRecurrenceRule(task.recurrenceRule), completedAt, timeZone,
          )
        : null;
      const completion = await tx.taskCompletion.create({
        data: {
          taskId: id,
          userId: req.userId,
          scheduledFor: storedDate(today),
          previousDueDate,
          nextDueDate: nextDate ? storedDate(nextDate) : null,
          completedAt,
        },
      });
      const updated = await tx.task.update({
        where: { id },
        data: task.recurrence
          ? { dueDate: storedDate(nextDate), completed: true, completedAt, version: { increment: 1 } }
          : { completed: true, completedAt, version: { increment: 1 } },
        include: { checklist: true },
      });
      return { task: updated, completion, alreadyCompleted: false };
    });
    if (!result) return reply.status(404).send({ error: "Tarefa não encontrada." });

    const shaped = shapeTask(result.task);
    if (!result.alreadyCompleted) {
      await recordTaskChange({ userId: req.userId, taskId: id, action: "complete", after: shaped });
    }
    const next = shaped.due_date ? shaped.due_date.split("-").reverse().join("/") : null;
    return {
      ...shaped,
      _completion_id: result.completion?.id ?? null,
      _completion_message: result.alreadyCompleted
        ? "Esta tarefa já estava concluída."
        : result.task.recurrence ? `Concluída hoje — volta em ${next}.` : "Tarefa concluída.",
    };
  });

  // POST /tasks/:id/undo-complete
  fastify.post("/:id/undo-complete", MUTATION_RATE_LIMIT, async (req, reply) => {
    const completionId = req.body?.completion_id;
    const result = await prisma.$transaction(async (tx) => {
      const completion = await tx.taskCompletion.findFirst({
        where: { id: completionId, taskId: req.params.id, userId: req.userId, undoneAt: null },
      });
      if (!completion) return null;
      await tx.taskCompletion.update({ where: { id: completion.id }, data: { undoneAt: new Date() } });
      return tx.task.update({
        where: { id: req.params.id },
        data: { completed: false, completedAt: null, dueDate: completion.previousDueDate, version: { increment: 1 } },
        include: { checklist: true },
      });
    });
    if (!result) return reply.status(409).send({ error: "Esta conclusão não pode mais ser desfeita." });
    const shaped = shapeTask(result);
    await recordTaskChange({ userId: req.userId, taskId: req.params.id, action: "undo-complete", after: shaped });
    return shaped;
  });

  // GET /tasks/:id/history
  fastify.get("/:id/history", async (req, reply) => {
    const task = await prisma.task.findFirst({ where: { id: req.params.id, createdBy: req.userId }, select: { id: true } });
    if (!task) return reply.status(404).send({ error: "Tarefa não encontrada." });
    const rows = await prisma.taskCompletion.findMany({
      where: { taskId: task.id, userId: req.userId }, orderBy: { completedAt: "desc" }, take: 90,
    });
    return rows.map((row) => ({
      id: row.id,
      date: row.scheduledFor?.toISOString().slice(0, 10) ?? row.completedAt.toISOString().slice(0, 10),
      completed_at: row.completedAt.toISOString(),
      undone: Boolean(row.undoneAt),
    }));
  });

  // POST /tasks/:id/reopen
  fastify.post("/:id/reopen", MUTATION_RATE_LIMIT, async (req, reply) => {
    const { id } = req.params;
    const existing = await prisma.task.findFirst({ where: { id, createdBy: req.userId } });
    if (!existing) return reply.status(404).send({ error: "Tarefa não encontrada." });

    const latest = await prisma.taskCompletion.findFirst({
      where: { taskId: id, userId: req.userId, undoneAt: null }, orderBy: { completedAt: "desc" },
    });
    if (latest) {
      await prisma.taskCompletion.update({ where: { id: latest.id }, data: { undoneAt: new Date() } });
    }
    const task = await prisma.task.update({
      where: { id },
      data: { completed: false, completedAt: null, version: { increment: 1 }, ...(latest ? { dueDate: latest.previousDueDate } : {}) },
      include: { checklist: true },
    });
    const shaped = shapeTask({ ...task, checklist: task.checklist });
    await recordTaskChange({ userId: req.userId, taskId: id, action: "reopen", before: shapeTask({ ...existing, checklist: [] }), after: shaped });
    return shaped;
  });

  // GET /tasks/due-today
  fastify.get("/due-today", async (req) => {
    const { today } = await requestCalendar(req);
    await normalizePreviouslyCompletedRecurrences(req.userId, today);
    await reactivateDueRecurringTasks(req.userId, today);

    const tasks = await prisma.task.findMany({
      where: {
        createdBy: req.userId,
        completed: false,
        dueDate: storedDate(today),
      },
      orderBy: { priority: "asc" },
      take: 10,
      select: { id: true, title: true, priority: true, dueDate: true },
    });
    return tasks;
  });

  // GET /tasks/completed-today-count
  fastify.get("/completed-today-count", async (req) => {
    const { today } = await requestCalendar(req);
    const count = await prisma.taskCompletion.count({
      where: {
        userId: req.userId,
        scheduledFor: storedDate(today),
        undoneAt: null,
      },
    });
    return { count };
  });

  /**
   * GET /tasks/routines/consistency?from=YYYY-MM-DD&to=YYYY-MM-DD
   *
   * Heatmap de consistência das rotinas (aba Tarefas). "Rotina" = tarefa com
   * recorrência `daily` ou `weekdays` — o mesmo critério do painel Rotina Diária.
   *
   * Faz DUAS queries agregadas (rotinas + conclusões) e devolve, por dia:
   *   expected  = ÍNDICES (em `routines`) das rotinas que se aplicavam ao dia
   *   completed = índices das que foram concluídas (undone não conta)
   *
   * Índices em vez de UUIDs porque o payload de 1 ano × N rotinas fica pequeno,
   * e com eles o cliente monta o tooltip ("quais rotinas") e filtra por rotina
   * sem refetch nenhum.
   *
   * `best_streak` considera TODO o histórico, não apenas o período pedido.
   */
  fastify.get("/routines/consistency", async (req) => {
    const { timeZone, today } = await requestCalendar(req);
    const ISO = /^\d{4}-\d{2}-\d{2}$/;

    const rawTo = req.query?.to;
    const to = ISO.test(rawTo ?? "") && rawTo < today ? rawTo : today;
    const rawFrom = req.query?.from;
    let from = ISO.test(rawFrom ?? "") ? rawFrom : shiftISO(to, -179);
    if (from > to) from = to;
    if (diffISO(from, to) > MAX_CONSISTENCY_DAYS) from = shiftISO(to, -MAX_CONSISTENCY_DAYS);

    const routines = await prisma.task.findMany({
      where: {
        createdBy: req.userId,
        deletedAt: null,
        recurrence: { in: ROUTINE_RECURRENCES },
      },
      select: { id: true, title: true, recurrence: true, createdAt: true },
      orderBy: { createdAt: "asc" },
    });
    if (routines.length === 0) {
      // Sem rotinas ainda: devolve o período inteiro em branco para a grade
      // renderizar cinza em vez de colapsar.
      const blank = [];
      for (let day = from; day <= to; day = shiftISO(day, 1)) {
        blank.push({ date: day, expected: [], completed: [] });
      }
      return { from, to, routines: [], days: blank, best_streak: 0, best_streak_by_routine: [] };
    }

    const born = routines.map((r) => ({
      recurrence: r.recurrence,
      since: dateInTimeZone(r.createdAt, timeZone),
    }));

    // Janela completa = desde a rotina mais antiga (teto de MAX_HISTORY_DAYS).
    const oldest = born.reduce((min, r) => (r.since < min ? r.since : min), today);
    const historyFloor = shiftISO(to, -MAX_HISTORY_DAYS);
    const history = oldest < historyFloor ? historyFloor : oldest;
    // ...mas nunca depois de `from`: `days` precisa cobrir o período PEDIDO por
    // inteiro. Sem isso, um usuário cuja rotina mais antiga nasceu hoje recebia
    // um único dia e o heatmap desenhava uma célula só. Dias anteriores à
    // criação saem com `expected: []` → célula neutra, que é o correto.
    const start = from < history ? from : history;

    const completions = await prisma.taskCompletion.findMany({
      where: {
        userId: req.userId,
        undoneAt: null,
        taskId: { in: routines.map((r) => r.id) },
        scheduledFor: { gte: storedDate(start), lte: storedDate(to) },
      },
      select: { taskId: true, scheduledFor: true },
    });

    // Dedup: a mesma rotina concluída 2x no mesmo dia conta uma vez só.
    const doneByDay = new Map();
    for (const row of completions) {
      if (!row.scheduledFor) continue;
      const day = row.scheduledFor.toISOString().slice(0, 10);
      if (!doneByDay.has(day)) doneByDay.set(day, new Set());
      doneByDay.get(day).add(row.taskId);
    }

    const all = [];
    for (let day = start; day <= to; day = shiftISO(day, 1)) {
      const dow = new Date(`${day}T00:00:00.000Z`).getUTCDay(); // 0=dom … 6=sáb
      const doneToday = doneByDay.get(day);
      const expected = [];
      const completed = [];
      born.forEach((r, i) => {
        if (r.since > day) return;
        if (r.recurrence === "weekdays" && (dow === 0 || dow === 6)) return;
        expected.push(i);
        if (doneToday?.has(routines[i].id)) completed.push(i);
      });
      all.push({ date: day, expected, completed });
    }

    return {
      from,
      to,
      routines: routines.map((r) => ({ id: r.id, title: r.title, recurrence: r.recurrence })),
      days: all.filter((d) => d.date >= from),
      best_streak: bestFullDayStreak(all),
      // Melhor sequência de cada rotina isolada, para o filtro "por rotina"
      // continuar mostrando o recorde de todo o histórico (e não só do período).
      best_streak_by_routine: routines.map((_, i) => bestFullDayStreak(all, i)),
    };
  });

  // POST /tasks/:id/checklist
  fastify.post("/:id/checklist", MUTATION_RATE_LIMIT, async (req, reply) => {
    const { id: taskId } = req.params;
    const { description, parent_id: parentId = null } = req.body ?? {};

    if (!description || typeof description !== "string" || !description.trim()) {
      return reply.status(400).send({ error: "Descrição do item é obrigatória." });
    }

    const task = await prisma.task.findFirst({ where: { id: taskId, createdBy: req.userId } });
    if (!task) return reply.status(404).send({ error: "Tarefa não encontrada." });

    const count = await prisma.checklistItem.count({
      where: { taskId, parentId: parentId ?? null },
    });

    const [item] = await prisma.$transaction([
      prisma.checklistItem.create({
        data: { taskId, parentId, description: description.trim(), order: count },
      }),
      prisma.task.update({ where: { id: taskId }, data: { version: { increment: 1 } } }),
    ]);
    await recordTaskChange({ userId: req.userId, taskId, action: "checklist-add", after: item });
    reply.status(201);
    return item;
  });

  // POST /tasks/:id/checklist/batch — adicionar múltiplos itens de uma vez
  fastify.post("/:id/checklist/batch", MUTATION_RATE_LIMIT, async (req, reply) => {
    const { id: taskId } = req.params;
    const { items } = req.body ?? {};

    if (!Array.isArray(items) || items.length === 0) {
      return reply.status(400).send({ error: "Array de itens obrigatório." });
    }

    const task = await prisma.task.findFirst({ where: { id: taskId, createdBy: req.userId } });
    if (!task) return reply.status(404).send({ error: "Tarefa não encontrada." });

    const baseCount = await prisma.checklistItem.count({ where: { taskId } });

    const created = await prisma.$transaction([
      ...items
        .filter(item => item.description?.trim())
        .map((item, index) =>
          prisma.checklistItem.create({
            data: {
              taskId,
              description: item.description.trim(),
              parentId: item.parent_id ? BigInt(item.parent_id) : null,
              order: baseCount + index,
            },
          })
        ),
      prisma.task.update({ where: { id: taskId }, data: { version: { increment: 1 } } }),
    ]);

    // Remove o último item (que é a atualização da task)
    const newItems = created.slice(0, -1);

    await recordTaskChange({
      userId: req.userId,
      taskId,
      action: "checklist-batch-add",
      after: { count: newItems.length, items: newItems }
    });

    reply.status(201);
    return newItems;
  });

  // PATCH /tasks/:id/checklist/:itemId
  fastify.patch("/:id/checklist/:itemId", MUTATION_RATE_LIMIT, async (req, reply) => {
    const { id: taskId, itemId } = req.params;
    const { description, note } = req.body ?? {};

    const task = await prisma.task.findFirst({ where: { id: taskId, createdBy: req.userId } });
    if (!task) return reply.status(404).send({ error: "Tarefa não encontrada." });
    const existingItem = await prisma.checklistItem.findFirst({ where: { id: BigInt(itemId), taskId } });
    if (!existingItem) return reply.status(404).send({ error: "Item não encontrado." });

    const data = {};
    if (description !== undefined) data.description = description;
    if (note !== undefined) data.note = note;

    const [item] = await prisma.$transaction([
      prisma.checklistItem.update({ where: { id: BigInt(itemId) }, data }),
      prisma.task.update({ where: { id: taskId }, data: { version: { increment: 1 } } }),
    ]);
    await recordTaskChange({ userId: req.userId, taskId, action: "checklist-update", before: existingItem, after: item });
    return item;
  });

  // PATCH /tasks/:id/checklist/:itemId/toggle
  fastify.patch("/:id/checklist/:itemId/toggle", MUTATION_RATE_LIMIT, async (req, reply) => {
    const { id: taskId, itemId } = req.params;

    const task = await prisma.task.findFirst({ where: { id: taskId, createdBy: req.userId } });
    if (!task) return reply.status(404).send({ error: "Tarefa não encontrada." });

    const current = await prisma.checklistItem.findFirst({ where: { id: BigInt(itemId), taskId } });
    if (!current) return reply.status(404).send({ error: "Item não encontrado." });

    const [item] = await prisma.$transaction([
      prisma.checklistItem.update({
        where: { id: BigInt(itemId) },
        data: { completed: !current.completed },
      }),
      prisma.task.update({ where: { id: taskId }, data: { version: { increment: 1 } } }),
    ]);
    await recordTaskChange({ userId: req.userId, taskId, action: "checklist-toggle", before: current, after: item });
    return item;
  });

  // PATCH /tasks/:id/checklist/:itemId/order — reordenar item
  fastify.patch("/:id/checklist/:itemId/order", MUTATION_RATE_LIMIT, async (req, reply) => {
    const { id: taskId, itemId } = req.params;
    const { newOrder } = req.body ?? {};

    if (typeof newOrder !== "number") {
      return reply.status(400).send({ error: "newOrder deve ser um número." });
    }

    const task = await prisma.task.findFirst({ where: { id: taskId, createdBy: req.userId } });
    if (!task) return reply.status(404).send({ error: "Tarefa não encontrada." });

    const existingItem = await prisma.checklistItem.findFirst({ where: { id: BigInt(itemId), taskId } });
    if (!existingItem) return reply.status(404).send({ error: "Item não encontrado." });

    const [item] = await prisma.$transaction([
      prisma.checklistItem.update({
        where: { id: BigInt(itemId) },
        data: { order: newOrder },
      }),
      prisma.task.update({ where: { id: taskId }, data: { version: { increment: 1 } } }),
    ]);

    await recordTaskChange({ userId: req.userId, taskId, action: "checklist-reorder", before: existingItem, after: item });
    return item;
  });

  // DELETE /tasks/:id/checklist/:itemId
  fastify.delete("/:id/checklist/:itemId", MUTATION_RATE_LIMIT, async (req, reply) => {
    const { id: taskId, itemId } = req.params;

    const task = await prisma.task.findFirst({ where: { id: taskId, createdBy: req.userId } });
    if (!task) return reply.status(404).send({ error: "Tarefa não encontrada." });

    const item = await prisma.checklistItem.findFirst({ where: { id: BigInt(itemId), taskId } });
    if (!item) return reply.status(404).send({ error: "Item não encontrado." });
    await prisma.$transaction([
      prisma.checklistItem.delete({ where: { id: BigInt(itemId) } }),
      prisma.task.update({ where: { id: taskId }, data: { version: { increment: 1 } } }),
    ]);
    await recordTaskChange({ userId: req.userId, taskId, action: "checklist-delete", before: item });
    reply.status(204).send();
  });
}
