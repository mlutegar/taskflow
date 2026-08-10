import Fastify from "fastify";
import cors from "@fastify/cors";

// Prisma usa BigInt para IDs autoincrement — precisamos serializar corretamente
BigInt.prototype.toJSON = function () {
  return this.toString();
};
import tasksRoutes from "./routes/tasks.js";
import routinesRoutes from "./routes/routines.js";
import dailyTasksRoutes from "./routes/dailyTasks.js";
import modeStatsRoutes from "./routes/modeStats.js";
import dailyFocusRoutes from "./routes/dailyFocus.js";
import preferencesRoutes from "./routes/preferences.js";
import sessionUsageLogsRoutes from "./routes/sessionUsageLogs.js";
import modeLogRoutes from "./routes/modeLog.js";
import modeComboLogRoutes from "./routes/modeComboLog.js";

const PORT = process.env.PORT || 3001;
const CORS_ORIGIN = process.env.CORS_ORIGIN || "http://localhost:5175";

const fastify = Fastify({ logger: true });

await fastify.register(cors, {
  origin: CORS_ORIGIN,
  methods: ["GET", "POST", "PATCH", "PUT", "DELETE"],
  allowedHeaders: ["Content-Type", "Authorization"],
});

// Health check
fastify.get("/health", async () => ({ ok: true }));

// Rotas
fastify.register(tasksRoutes, { prefix: "/tasks" });
fastify.register(routinesRoutes, { prefix: "/routines" });
fastify.register(dailyTasksRoutes, { prefix: "/daily-tasks" });
fastify.register(modeStatsRoutes, { prefix: "/mode-stats" });
fastify.register(dailyFocusRoutes, { prefix: "/daily-focus" });
fastify.register(preferencesRoutes, { prefix: "/preferences" });
fastify.register(sessionUsageLogsRoutes, { prefix: "/session-usage-logs" });
fastify.register(modeLogRoutes, { prefix: "/mode-log" });
fastify.register(modeComboLogRoutes, { prefix: "/mode-combo-log" });

// Erro global
fastify.setErrorHandler((error, request, reply) => {
  fastify.log.error(error);
  const status = error.statusCode ?? 500;
  reply.status(status).send({ error: error.message || "Erro interno." });
});

try {
  await fastify.listen({ port: Number(PORT), host: "0.0.0.0" });
  console.log(`TaskFlow API rodando em http://localhost:${PORT}`);
} catch (err) {
  fastify.log.error(err);
  process.exit(1);
}
