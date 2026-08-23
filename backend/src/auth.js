import jwt from "jsonwebtoken";

if (!process.env.JWT_SECRET && process.env.NODE_ENV === "production") {
  throw new Error("JWT_SECRET não definida em produção. Defina a variável de ambiente.");
}

export const JWT_SECRET = process.env.JWT_SECRET || "dev-secret-change-in-prod";

/**
 * Fastify preHandler — verifica o JWT local e injeta userId no request.
 */
export async function authenticate(request, reply) {
  const header = request.headers["authorization"] || "";
  const token = header.startsWith("Bearer ") ? header.slice(7) : null;

  if (!token) {
    return reply.status(401).send({ error: "Token ausente." });
  }

  try {
    const payload = jwt.verify(token, JWT_SECRET);
    request.userId = payload.userId;
  } catch {
    return reply.status(401).send({ error: "Token inválido ou expirado." });
  }
}
