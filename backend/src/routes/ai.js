import { authenticate } from "../auth.js";

const ORBITA_TOKEN = process.env.ORBITA_TOKEN || "mlute-7q2x9k";
const ORBITA_URL = `https://orbita.mlutegar.com/api/ask?t=${ORBITA_TOKEN}`;

// Timeouts encadeados: Orbita (60s) < abort do backend (65s) < abort do frontend (70s).
export const ORBITA_TIMEOUT_S = 60;
const BACKEND_ABORT_MS = (ORBITA_TIMEOUT_S + 5) * 1000;

// Domínio: alinhado a frontend/src/data/modes.ts (CATEGORY_ORDER + type).
const CATEGORIES = ["Música", "Ciclos", "Foco", "Memória", "Ritual", "Mobile", "Personalizados"];
const TYPES = ["durante", "entre"]; // durante o foco / entre tarefas

/**
 * Extrai o primeiro bloco JSON de um texto em linguagem natural.
 * A resposta do Orbita costuma vir com texto (ou cercas markdown) ao redor do JSON.
 * Exportada para testes unitários.
 */
export function extractJson(text) {
  if (!text || typeof text !== "string") return null;
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/i);
  const candidate = fenced ? fenced[1] : text;
  const start = candidate.indexOf("{");
  const end = candidate.lastIndexOf("}");
  if (start === -1 || end === -1 || end <= start) return null;
  try {
    return JSON.parse(candidate.slice(start, end + 1));
  } catch {
    return null;
  }
}

function buildPrompt(partial, { strict = false } = {}) {
  const filled = {};
  for (const [k, v] of Object.entries(partial ?? {})) {
    if (Array.isArray(v)) {
      const arr = v.filter((s) => typeof s === "string" && s.trim());
      if (arr.length) filled[k] = arr;
    } else if (typeof v === "string" && v.trim()) {
      filled[k] = v.trim();
    }
  }

  const example = {
    emoji: "🧠",
    name: "Deep Work",
    tagline: "Blocos de foco sem interrupção",
    steps: ["Silencie notificações", "Defina 1 objetivo claro", "Trabalhe 50 min", "Descanse 10 min"],
    prerequisite: "Ter uma tarefa única e bem definida para focar.",
    whyItWorks: "Remover interrupções permite entrar em estado de fluxo mais rápido.",
    whenToUse: "Quando precisa de concentração profunda em tarefas complexas.",
    tips: "Deixe água e o material por perto antes de começar.",
    category: "Foco",
    type: "durante",
  };

  return [
    strict
      ? "ATENÇÃO: sua resposta anterior não era um JSON válido. Responda AGORA APENAS com o objeto JSON, sem nenhum texto, sem markdown."
      : "Você é um assistente que cria \"modos de produtividade\" para um app de foco.",
    "Com base nas informações já preenchidas pelo usuário, gere um modo completo e coerente, em português.",
    "",
    "Informações já preenchidas (preserve-as, não altere):",
    JSON.stringify(filled, null, 2),
    "",
    "Responda APENAS com um objeto JSON válido (sem texto antes ou depois, sem markdown), com as chaves:",
    "- name: string (nome curto do modo)",
    "- tagline: string (frase curta de efeito)",
    "- steps: array de 3 a 5 strings (passos práticos e acionáveis)",
    "- prerequisite: string (o que ter/fazer antes de iniciar)",
    "- whyItWorks: string (a lógica por trás do modo)",
    "- whenToUse: string (situação/estado mental ideal)",
    "- tips: string (dica extra opcional)",
    "- emoji: string (um único emoji que represente o modo)",
    `- category: string (uma de: ${CATEGORIES.join(", ")})`,
    `- type: string (uma de: ${TYPES.join(", ")} — "durante" = durante o foco, "entre" = entre tarefas)`,
    "",
    "Exemplo do formato exato esperado:",
    JSON.stringify(example),
  ].join("\n");
}

async function callOrbita(prompt) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), BACKEND_ABORT_MS);
  try {
    const res = await fetch(ORBITA_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json", accept: "application/json" },
      body: JSON.stringify({ message: prompt, timeout: ORBITA_TIMEOUT_S }),
      signal: controller.signal,
    });
    if (!res.ok) return { error: `IA retornou erro ${res.status}.`, status: res.status };
    const payload = await res.json().catch(() => null);
    const rawText =
      typeof payload === "string"
        ? payload
        : payload?.response ?? payload?.answer ?? payload?.message ?? payload?.result ?? "";
    return { text: rawText };
  } catch (err) {
    const aborted = err?.name === "AbortError";
    return { error: aborted ? "A IA demorou demais para responder." : "Falha ao contatar a IA.", aborted };
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Coage o `type` retornado pela IA para o vocabulário do app ("durante" | "entre").
 * A IA às vezes devolve valores livres (ex.: "productivity-mode", "focus", "break").
 * Exportada para testes.
 */
export function coerceType(raw) {
  if (typeof raw !== "string") return undefined;
  const v = raw.trim().toLowerCase();
  if (!v) return undefined;
  if (TYPES.includes(v)) return v;
  // "entre tarefas" / pausas / transições.
  const ENTRE = ["entre", "between", "break", "pausa", "pause", "transition", "transição", "rest", "descanso", "interval", "intervalo"];
  // "durante o foco" / trabalho / produtividade.
  const DURANTE = ["durante", "during", "focus", "foco", "work", "trabalho", "deep", "productivity", "produtividade", "concentr", "flow", "fluxo"];
  if (ENTRE.some((k) => v.includes(k))) return "entre";
  if (DURANTE.some((k) => v.includes(k))) return "durante";
  return undefined;
}

function normalize(parsed) {
  const str = (v) => (typeof v === "string" && v.trim() ? v.trim() : undefined);
  return {
    emoji: str(parsed.emoji),
    name: str(parsed.name),
    tagline: str(parsed.tagline),
    steps: Array.isArray(parsed.steps)
      ? parsed.steps.filter((s) => typeof s === "string" && s.trim()).map((s) => s.trim())
      : undefined,
    prerequisite: str(parsed.prerequisite),
    whyItWorks: str(parsed.whyItWorks),
    whenToUse: str(parsed.whenToUse),
    tips: str(parsed.tips),
    category: CATEGORIES.includes(parsed.category) ? parsed.category : undefined,
    type: coerceType(parsed.type),
  };
}

const GENERATE_MODE_SCHEMA = {
  body: {
    type: "object",
    additionalProperties: false,
    properties: {
      emoji: { type: "string", maxLength: 16 },
      name: { type: "string", maxLength: 120 },
      tagline: { type: "string", maxLength: 200 },
      steps: { type: "array", maxItems: 12, items: { type: "string", maxLength: 300 } },
      prerequisite: { type: "string", maxLength: 500 },
      whyItWorks: { type: "string", maxLength: 500 },
      whenToUse: { type: "string", maxLength: 500 },
      tips: { type: "string", maxLength: 500 },
    },
  },
};

const AI_RATE_LIMIT = {
  rateLimit: {
    max: 20,
    timeWindow: 5 * 60 * 1000,
    keyGenerator: (req) => req.userId ?? req.ip,
    errorResponseBuilder: () => ({
      statusCode: 429,
      error: "Too Many Requests",
      message: "Muitas gerações de IA em pouco tempo. Tente novamente em alguns minutos.",
    }),
  },
};

export default async function aiRoutes(fastify) {
  fastify.addHook("preHandler", authenticate);

  // POST /ai/generate-mode
  fastify.post(
    "/generate-mode",
    { schema: GENERATE_MODE_SCHEMA, config: AI_RATE_LIMIT },
    async (req, reply) => {
      const startedAt = Date.now();

      // 1ª tentativa + 1 retry "estrito" se a resposta não for JSON parseável.
      let parsed = null;
      let lastError = null;
      for (let attempt = 0; attempt < 2 && !parsed; attempt++) {
        const result = await callOrbita(buildPrompt(req.body, { strict: attempt > 0 }));
        if (result.error) {
          lastError = result.error;
          // Timeout/erro de rede: não adianta tentar de novo.
          if (result.aborted || result.status) break;
          continue;
        }
        parsed = extractJson(result.text);
        if (!parsed) lastError = "Não foi possível interpretar a resposta da IA.";
      }

      const latencyMs = Date.now() - startedAt;
      if (!parsed) {
        req.log.warn({ latencyMs, lastError }, "ai.generate-mode: falha");
        return reply.status(502).send({ error: lastError || "Falha ao gerar com IA." });
      }

      req.log.info({ latencyMs }, "ai.generate-mode: ok");
      return normalize(parsed);
    },
  );
}
