import { z } from "zod";
import prisma from "../prisma.js";
import { authenticate } from "../auth.js";

const projectSchema = z.object({
  name: z.string().trim().min(1, "Nome obrigatório.").max(100),
  description: z.string().trim().max(500).optional().nullable(),
  color: z.string().regex(/^#[0-9a-fA-F]{6}$/).optional(),
  emoji: z.string().trim().min(1).max(16).optional(),
  parent_id: z.string().uuid().optional().nullable(),
  default_estimated_minutes: z.number().int().min(0).max(1440).optional().nullable(),
});

const updateProjectSchema = projectSchema.partial().extend({ archived: z.boolean().optional() });

function shape(project, taskCount = project._count?.tasks ?? 0) {
  return {
    id: project.id,
    name: project.name,
    description: project.description,
    color: project.color,
    emoji: project.emoji,
    parent_id: project.parentId,
    archived: project.archived,
    default_estimated_minutes: project.defaultEstimatedMinutes ?? null,
    task_count: taskCount,
    direct_task_count: project._count?.tasks ?? 0,
    child_count: project._count?.children ?? 0,
    created_at: project.createdAt?.toISOString(),
    updated_at: project.updatedAt?.toISOString(),
  };
}

async function ownedProject(userId, id) {
  if (!id) return null;
  return prisma.project.findFirst({ where: { id, userId } });
}

async function wouldCreateCycle(userId, projectId, parentId) {
  let cursor = parentId;
  const seen = new Set();
  while (cursor) {
    if (cursor === projectId || seen.has(cursor)) return true;
    seen.add(cursor);
    const parent = await prisma.project.findFirst({ where: { id: cursor, userId }, select: { parentId: true } });
    if (!parent) return false;
    cursor = parent.parentId;
  }
  return false;
}

async function descendantIds(userId, projectId) {
  const projects = await prisma.project.findMany({ where: { userId }, select: { id: true, parentId: true } });
  const ids = new Set([projectId]);
  let changed = true;
  while (changed) {
    changed = false;
    for (const project of projects) {
      if (project.parentId && ids.has(project.parentId) && !ids.has(project.id)) {
        ids.add(project.id); changed = true;
      }
    }
  }
  return [...ids];
}

async function ancestorIds(userId, projectId) {
  const ids = [];
  const seen = new Set([projectId]);
  let cursor = await prisma.project.findFirst({
    where: { id: projectId, userId },
    select: { parentId: true },
  });
  while (cursor?.parentId && !seen.has(cursor.parentId)) {
    seen.add(cursor.parentId);
    ids.push(cursor.parentId);
    cursor = await prisma.project.findFirst({
      where: { id: cursor.parentId, userId },
      select: { parentId: true },
    });
  }
  return ids;
}

export default async function projectsRoutes(fastify) {
  fastify.addHook("preHandler", authenticate);

  fastify.get("/", async (req) => {
    const includeArchived = req.query?.archived === "true";
    const rows = await prisma.project.findMany({
      where: { userId: req.userId, ...(includeArchived ? {} : { archived: false }) },
      orderBy: [{ name: "asc" }],
      include: { _count: { select: { tasks: true, children: true } } },
    });
    const children = new Map();
    for (const row of rows) {
      const parentId = row.parentId || null;
      children.set(parentId, [...(children.get(parentId) || []), row.id]);
    }
    const directCounts = new Map(rows.map((row) => [row.id, row._count.tasks]));
    const totalCount = (projectId, trail = new Set()) => {
      if (trail.has(projectId)) return 0;
      const nextTrail = new Set(trail).add(projectId);
      return (directCounts.get(projectId) || 0)
        + (children.get(projectId) || []).reduce((sum, childId) => sum + totalCount(childId, nextTrail), 0);
    };
    return rows.map((row) => shape(row, totalCount(row.id)));
  });

  fastify.post("/", async (req, reply) => {
    const parsed = projectSchema.safeParse(req.body ?? {});
    if (!parsed.success) return reply.status(400).send({ error: "Dados inválidos.", details: parsed.error.flatten().fieldErrors });
    const body = parsed.data;
    if (body.parent_id) {
      const parent = await ownedProject(req.userId, body.parent_id);
      if (!parent || parent.archived) return reply.status(400).send({ error: "Projeto-pai inválido ou arquivado." });
    }
    const duplicate = await prisma.project.findFirst({
      where: { userId: req.userId, parentId: body.parent_id || null, name: body.name }, select: { id: true },
    });
    if (duplicate) return reply.status(409).send({ error: "Já existe um projeto com esse nome neste grupo." });
    try {
      const project = await prisma.project.create({
        data: {
          userId: req.userId, name: body.name, description: body.description || null,
          color: body.color || "#7c6ef5", emoji: body.emoji || "📁", parentId: body.parent_id || null,
          defaultEstimatedMinutes: body.default_estimated_minutes ?? null,
        },
        include: { _count: { select: { tasks: true, children: true } } },
      });
      return reply.status(201).send(shape(project));
    } catch (error) {
      if (error?.code === "P2002") return reply.status(409).send({ error: "Já existe um projeto com esse nome neste grupo." });
      throw error;
    }
  });

  fastify.patch("/:id", async (req, reply) => {
    const parsed = updateProjectSchema.safeParse(req.body ?? {});
    if (!parsed.success) return reply.status(400).send({ error: "Dados inválidos.", details: parsed.error.flatten().fieldErrors });
    const existing = await ownedProject(req.userId, req.params.id);
    if (!existing) return reply.status(404).send({ error: "Projeto não encontrado." });
    const body = parsed.data;
    if (body.parent_id) {
      const parent = await ownedProject(req.userId, body.parent_id);
      if (!parent || parent.archived) return reply.status(400).send({ error: "Projeto-pai inválido ou arquivado." });
      if (await wouldCreateCycle(req.userId, existing.id, body.parent_id)) return reply.status(400).send({ error: "Um projeto não pode ficar dentro de si mesmo." });
    }
    if (body.name !== undefined || body.parent_id !== undefined) {
      const duplicate = await prisma.project.findFirst({
        where: {
          userId: req.userId,
          parentId: body.parent_id !== undefined ? (body.parent_id || null) : existing.parentId,
          name: body.name ?? existing.name,
          id: { not: existing.id },
        },
        select: { id: true },
      });
      if (duplicate) return reply.status(409).send({ error: "Já existe um projeto com esse nome neste grupo." });
    }
    try {
      if (body.archived !== undefined) {
        const ids = await descendantIds(req.userId, existing.id);
        const relatedIds = body.archived ? ids : [...new Set([...ids, ...(await ancestorIds(req.userId, existing.id))])];
        await prisma.project.updateMany({ where: { id: { in: relatedIds }, userId: req.userId }, data: { archived: body.archived } });
      }
      const project = await prisma.project.update({
        where: { id: existing.id },
        data: {
          ...(body.name !== undefined ? { name: body.name } : {}),
          ...(body.description !== undefined ? { description: body.description || null } : {}),
          ...(body.color !== undefined ? { color: body.color } : {}),
          ...(body.emoji !== undefined ? { emoji: body.emoji } : {}),
          ...(body.parent_id !== undefined ? { parentId: body.parent_id || null } : {}),
          ...(body.archived !== undefined ? { archived: body.archived } : {}),
          ...(body.default_estimated_minutes !== undefined ? { defaultEstimatedMinutes: body.default_estimated_minutes ?? null } : {}),
        },
        include: { _count: { select: { tasks: true, children: true } } },
      });
      return shape(project);
    } catch (error) {
      if (error?.code === "P2002") return reply.status(409).send({ error: "Já existe um projeto com esse nome neste grupo." });
      throw error;
    }
  });

  fastify.delete("/:id", async (req, reply) => {
    const project = await prisma.project.findFirst({
      where: { id: req.params.id, userId: req.userId },
      include: { _count: { select: { tasks: true, children: true } } },
    });
    if (!project) return reply.status(404).send({ error: "Projeto não encontrado." });
    if (project._count.tasks || project._count.children) {
      return reply.status(409).send({ error: "Mova as tarefas e subprojetos antes de excluir. Você também pode arquivar este projeto." });
    }
    await prisma.project.delete({ where: { id: project.id } });
    return reply.status(204).send();
  });
}
