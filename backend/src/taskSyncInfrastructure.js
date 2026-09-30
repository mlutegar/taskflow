import prisma from "./prisma.js";

const listeners = new Map();
let sequence = Date.now();
const counters = {
  mutations: 0,
  replays: 0,
  conflicts: 0,
  failures: 0,
  events: 0,
};

export function syncMetric(name) {
  if (Object.hasOwn(counters, name)) counters[name] += 1;
}

export function syncMetrics() {
  return { ...counters, subscribers: [...listeners.values()].reduce((sum, set) => sum + set.size, 0) };
}

export function publishTaskEvent(userId, event) {
  const message = { id: ++sequence, at: new Date().toISOString(), ...event };
  counters.events += 1;
  for (const listener of listeners.get(userId) ?? []) listener(message);
  return message;
}

export function subscribeTaskEvents(userId, listener) {
  const userListeners = listeners.get(userId) ?? new Set();
  userListeners.add(listener);
  listeners.set(userId, userListeners);
  return () => {
    userListeners.delete(listener);
    if (userListeners.size === 0) listeners.delete(userId);
  };
}

export async function recordTaskChange({ userId, taskId, action, before, after, metadata }) {
  const serialize = (value) => JSON.stringify(value, (_key, item) => typeof item === "bigint" ? item.toString() : item);
  const row = await prisma.taskChange.create({
    data: {
      userId,
      taskId: taskId ?? null,
      action,
      before: before == null ? null : serialize(before),
      after: after == null ? null : serialize(after),
      metadata: metadata == null ? null : serialize(metadata),
    },
  });
  // Anexa o payload da tarefa quando `after` é uma tarefa (não um item de
  // checklist). O cliente usa isso direto e evita um GET extra + a corrida
  // read-after-write. Heurística: tarefas têm `version` e a chave `due_date`.
  const isTaskShape = after != null && typeof after === "object"
    && typeof after.version === "number" && "due_date" in after;
  publishTaskEvent(userId, {
    type: action === "delete" ? "task-deleted" : "task-changed",
    taskId,
    changeId: row.id,
    ...(isTaskShape ? { task: after } : {}),
  });
  counters.mutations += 1;
  return row;
}

export function parseSnapshot(value) {
  if (!value) return null;
  try { return JSON.parse(value); } catch { return null; }
}

const MUTATING = new Set(["POST", "PATCH", "PUT", "DELETE"]);

// Hooks de idempotência. A chave é reservada antes do handler; reenvios
// recebem exatamente a resposta anterior sem repetir o efeito no banco.
export function installTaskIdempotency(fastify) {
  fastify.addHook("preHandler", async (req, reply) => {
    if (!MUTATING.has(req.method)) return;
    const key = req.headers["x-idempotency-key"];
    if (!key) return;
    if (typeof key !== "string" || key.length < 8 || key.length > 100) {
      return reply.status(400).send({ error: "X-Idempotency-Key inválida." });
    }
    try {
      const receipt = await prisma.taskMutationReceipt.create({
        data: { userId: req.userId, key, method: req.method, path: req.url },
      });
      req.taskMutationReceiptId = receipt.id;
    } catch (error) {
      if (error?.code !== "P2002") throw error;
      const receipt = await prisma.taskMutationReceipt.findUnique({
        where: { userId_key: { userId: req.userId, key } },
      });
      if (!receipt || receipt.status === 0 || !receipt.response) {
        return reply.status(409).send({ error: "Esta operação ainda está sendo processada.", code: "IDEMPOTENCY_IN_PROGRESS" });
      }
      req.taskMutationReplay = true;
      syncMetric("replays");
      return reply.status(receipt.status).send(parseSnapshot(receipt.response));
    }
  });

  fastify.addHook("onSend", async (req, reply, payload) => {
    if (!req.taskMutationReceiptId || req.taskMutationReplay) return payload;
    if (reply.statusCode >= 500) {
      await prisma.taskMutationReceipt.delete({ where: { id: req.taskMutationReceiptId } }).catch(() => {});
      syncMetric("failures");
      return payload;
    }
    const response = typeof payload === "string" ? payload : JSON.stringify(payload ?? null);
    await prisma.taskMutationReceipt.update({
      where: { id: req.taskMutationReceiptId },
      data: { status: reply.statusCode, response },
    });
    return payload;
  });
}
