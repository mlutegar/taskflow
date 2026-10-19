import "./loadEnv.js"; // DEVE ser o primeiro import (carrega .env antes do prisma)
import Fastify from "fastify";
import cors from "@fastify/cors";
import rateLimit from "@fastify/rate-limit";

import authRoutes from "./routes/auth.js";
import tasksRoutes from "./routes/tasks.js";
import routinesRoutes from "./routes/routines.js";
import dailyTasksRoutes from "./routes/dailyTasks.js";
import modeStatsRoutes from "./routes/modeStats.js";
import dailyFocusRoutes from "./routes/dailyFocus.js";
import preferencesRoutes from "./routes/preferences.js";
import sessionUsageLogsRoutes from "./routes/sessionUsageLogs.js";
import modeComboLogRoutes from "./routes/modeComboLog.js";
import aiRoutes from "./routes/ai.js";
import projectsRoutes from "./routes/projects.js";
import uploadsRoutes from "./routes/uploads.js";
import orbitaRoutes from "./routes/orbita.js";
import icalRoutes from "./routes/ical.js";

const PORT = process.env.PORT || 3001;
const CORS_ORIGIN = process.env.CORS_ORIGIN || "http://localhost:5175";

const fastify = Fastify({
  logger: true,
  // Serializa BigInt como string em todas as respostas JSON,
  // sem precisar de monkey-patch global em BigInt.prototype
  serializerOpts: {
    bigint: true,
  },
});

// Hook de serialização para BigInt → string
fastify.addHook("preSerialization", async (_req, _reply, payload) => {
  return JSON.parse(JSON.stringify(payload, (_k, v) =>
    typeof v === "bigint" ? v.toString() : v
  ));
});

// Parser JSON tolerante a corpo vazio: evita FST_ERR_CTP_EMPTY_JSON_BODY (400)
// em POSTs sem corpo mas com Content-Type: application/json (ex.: /auth/refresh).
fastify.addContentTypeParser(
  "application/json",
  { parseAs: "string" },
  (_req, body, done) => {
    if (!body || body.trim() === "") return done(null, {});
    try {
      done(null, JSON.parse(body));
    } catch (err) {
      err.statusCode = 400;
      done(err, undefined);
    }
  }
);

await fastify.register(rateLimit, {
  global: false,
});

await fastify.register(cors, {
  origin: CORS_ORIGIN,
  methods: ["GET", "POST", "PATCH", "PUT", "DELETE"],
  allowedHeaders: ["Content-Type", "Authorization", "X-Timezone", "X-Idempotency-Key"],
});

// Health check
fastify.get("/health", async () => ({ ok: true }));

// Server time (para detecção de clock drift)
fastify.get("/server-time", async () => ({ serverTime: Date.now() }));

// Rotas
fastify.register(authRoutes, { prefix: "/auth" });
fastify.register(tasksRoutes, { prefix: "/tasks" });
if (process.env.FEATURE_PROJECTS !== "false") {
  fastify.register(projectsRoutes, { prefix: "/projects" });
}
fastify.register(routinesRoutes, { prefix: "/routines" });
fastify.register(dailyTasksRoutes, { prefix: "/daily-tasks" });
fastify.register(modeStatsRoutes, { prefix: "/mode-stats" });
fastify.register(dailyFocusRoutes, { prefix: "/daily-focus" });
fastify.register(preferencesRoutes, { prefix: "/preferences" });
fastify.register(sessionUsageLogsRoutes, { prefix: "/session-usage-logs" });
fastify.register(modeComboLogRoutes, { prefix: "/mode-combo-log" });
fastify.register(aiRoutes, { prefix: "/ai" });
fastify.register(uploadsRoutes, { prefix: "/uploads" });
fastify.register(orbitaRoutes, { prefix: "/orbita" });
fastify.register(icalRoutes, { prefix: "/ical" });

// Erro global
fastify.setErrorHandler((error, request, reply) => {
  fastify.log.error(error);

  // Drift de banco: schema/migrations à frente do banco em uso.
  // P2021 = tabela inexistente, P2022 = coluna inexistente.
  if (error.code === "P2022" || error.code === "P2021") {
    fastify.log.error(
      "[DB DRIFT] Banco desatualizado em relação ao schema. " +
        "Rode as migrations: `npm run db:deploy` (ou `prisma migrate deploy`)."
    );
    return reply.status(500).send({
      error:
        "Banco de dados desatualizado. As migrations precisam ser aplicadas (prisma migrate deploy).",
    });
  }

  const status = error.statusCode ?? 500;
  reply.status(status).send({ error: error.message || "Erro interno." });
});

// Encerramento gracioso: fecha o servidor (libera a porta) ao receber sinal,
// evitando processos órfãos que causam EADDRINUSE na próxima subida.
let shuttingDown = false;
for (const signal of ["SIGINT", "SIGTERM"]) {
  process.on(signal, async () => {
    if (shuttingDown) return;
    shuttingDown = true;
    console.log(`\n[API] Recebido ${signal} — encerrando servidor...`);
    try {
      await fastify.close();
      console.log("[API] Servidor encerrado. Porta liberada.");
    } catch (e) {
      console.error("[API] Erro ao encerrar:", e?.message || e);
    } finally {
      process.exit(0);
    }
  });
}

try {
  await fastify.listen({ port: Number(PORT), host: "0.0.0.0" });
  console.log(`TaskFlow API rodando em http://localhost:${PORT}`);
} catch (err) {
  if (err && err.code === "EADDRINUSE") {
    console.error(
      `\n[API] Porta ${PORT} já está em uso — provavelmente há uma instância anterior do backend rodando.\n` +
      `      Encerre o processo que ocupa a porta ${PORT} ou rode em outra porta com  PORT=3002 npm run dev.\n`
    );
  } else {
    fastify.log.error(err);
  }
  process.exit(1);
}
