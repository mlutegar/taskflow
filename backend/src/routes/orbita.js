import { authenticate } from "../auth.js";
import prisma from "../prisma.js";

// Integração com o Órbita (Claude Web) — o app em gerenciar_claude_no_iphone,
// servidor Python na porta 8765. Este backend atua como PROXY: o token e o
// endereço do Órbita ficam aqui (fora do navegador), evitando CORS e vazamento
// do token no front. O Órbita roda LOCAL na máquina do usuário; o TaskFlow pode
// estar remoto (ex.: acessado via Tailscale) — por isso o endereço é configurável.
//
// Env:
//   ORBITA_WEB_URL         base usada por ESTE backend p/ falar com o Órbita
//   ORBITA_WEB_PUBLIC_URL  base que o NAVEGADOR usa p/ abrir a UI (default = URL)
//   ORBITA_WEB_TOKEN       token do Órbita (?t=). Default "mlute-7q2x9k".
const ORBITA_WEB_URL = (process.env.ORBITA_WEB_URL || "http://localhost:8765").replace(/\/+$/, "");
const ORBITA_WEB_PUBLIC_URL = (process.env.ORBITA_WEB_PUBLIC_URL || ORBITA_WEB_URL).replace(/\/+$/, "");
const ORBITA_WEB_TOKEN = process.env.ORBITA_WEB_TOKEN || "mlute-7q2x9k";

const ABORT_MS = 12_000;
const HISTORY_MAX = 20;
const PROVIDERS = new Set(["claude", "codex", "antigravity"]);

async function orbitaFetch(path, { method = "POST", body } = {}) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), ABORT_MS);
  const sep = path.includes("?") ? "&" : "?";
  const url = `${ORBITA_WEB_URL}${path}${sep}t=${encodeURIComponent(ORBITA_WEB_TOKEN)}`;
  try {
    const res = await fetch(url, {
      method,
      headers: { "Content-Type": "application/json", accept: "application/json" },
      body: body !== undefined ? JSON.stringify(body) : undefined,
      signal: controller.signal,
    });
    const payload = await res.json().catch(() => null);
    return { ok: res.ok, status: res.status, payload };
  } catch (err) {
    const aborted = err?.name === "AbortError";
    return { ok: false, status: 0, reason: aborted ? "timeout" : "offline" };
  } finally {
    clearTimeout(timer);
  }
}

// Mensagens de erro específicas (item "robustez"): distingue Órbita offline,
// timeout, projeto inválido e falha genérica.
function describeError(r, fallback) {
  if (r.reason === "offline") return { code: "offline", msg: "Órbita offline — o Claude Web está rodando e acessível?" };
  if (r.reason === "timeout") return { code: "timeout", msg: "O Órbita demorou demais para responder." };
  if (r.status === 403) return { code: "forbidden", msg: "Órbita recusou o acesso (token/projeto não permitido)." };
  if (r.status === 400) return { code: "invalid", msg: r.payload?.error || "Projeto inválido para o Órbita." };
  return { code: "error", msg: r.payload?.error || fallback };
}

async function appendHistory(userId, taskId, entry) {
  if (!taskId) return;
  const task = await prisma.task.findFirst({ where: { id: taskId, userId }, select: { orbitaHistory: true } });
  if (!task) return;
  let history = [];
  try { const p = JSON.parse(task.orbitaHistory || "[]"); if (Array.isArray(p)) history = p; } catch { /* noop */ }
  history.unshift(entry);
  history = history.slice(0, HISTORY_MAX);
  await prisma.task.update({
    where: { id: taskId },
    data: {
      orbitaHistory: JSON.stringify(history),
      orbitaLastKey: entry.key,
      orbitaLastProvider: entry.provider,
    },
  });
}

export default async function orbitaRoutes(fastify) {
  fastify.addHook("preHandler", authenticate);

  // GET /orbita/projects → lista as pastas/projetos do Órbita (Claude Web).
  fastify.get("/projects", async (_req, reply) => {
    const r = await orbitaFetch("/api/projects", { method: "GET" });
    if (!r.ok) {
      const e = describeError(r, "Não foi possível contatar o Órbita.");
      return reply.status(502).send({ error: e.msg, code: e.code });
    }
    const folders = Array.isArray(r.payload?.folders) ? r.payload.folders : [];
    return { folders };
  });

  // POST /orbita/launch { taskId?, path, prompt, provider?, reuseKey? }
  // - reuseKey ausente → abre nova aba (/api/open) e envia (/api/send).
  // - reuseKey presente → continua a mesma aba (só /api/send).
  // Registra o launch no histórico da tarefa (se taskId informado) e devolve a
  // URL pronta para o navegador focar aquela aba.
  fastify.post("/launch", async (req, reply) => {
    const taskId = (req.body?.taskId || "").trim() || null;
    const path = (req.body?.path || "").trim();
    const prompt = (req.body?.prompt || "").trim();
    const reuseKey = (req.body?.reuseKey || "").trim();
    let provider = (req.body?.provider || "claude").trim().toLowerCase();
    if (!PROVIDERS.has(provider)) provider = "claude";

    if (!prompt) return reply.status(400).send({ error: "Prompt é obrigatório.", code: "invalid" });
    if (!reuseKey && !path) return reply.status(400).send({ error: "Projeto (path) é obrigatório.", code: "invalid" });

    let key = reuseKey;
    let reused = Boolean(reuseKey);

    if (!reuseKey) {
      const open = await orbitaFetch("/api/open", { body: { path, provider } });
      if (!open.ok || !open.payload?.key) {
        const e = describeError(open, "Falha ao abrir a aba no Órbita.");
        return reply.status(502).send({ error: e.msg, code: e.code });
      }
      key = open.payload.key;
    }

    const send = await orbitaFetch("/api/send", { body: { key, text: prompt } });
    if (!send.ok) {
      const e = describeError(send, "Falha ao enviar o prompt.");
      return reply.status(502).send({ error: `${reused ? "" : "Aba aberta, mas "}${e.msg}`, code: e.code, key });
    }

    // Timestamp vem do servidor (Date permitido aqui, fora de workflow).
    await appendHistory(req.userId, taskId, {
      key, provider, path: path || null, reused, at: new Date().toISOString(),
    });

    const openUrl =
      `${ORBITA_WEB_PUBLIC_URL}/?t=${encodeURIComponent(ORBITA_WEB_TOKEN)}` +
      `&key=${encodeURIComponent(key)}`;
    return { ok: true, key, openUrl, reused, provider };
  });
}
