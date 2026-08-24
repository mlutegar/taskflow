/**
 * auth.js — Valida JWTs emitidos pelo backend próprio (SQLite + JWT).
 * Usa jsonwebtoken para verificar a assinatura localmente, sem chamadas externas.
 */

import jwt from "jsonwebtoken";

export const JWT_SECRET =
  process.env.JWT_SECRET || "taskflow-dev-secret-2026";

if (process.env.NODE_ENV === "production" && !process.env.JWT_SECRET) {
  console.warn(
    "[auth] AVISO: JWT_SECRET não definido em produção. Use uma chave segura via variável de ambiente."
  );
}

/**
 * Fastify preHandler — verifica o JWT local e injeta userId no request.
 * Retorna 401 se o token for inválido ou ausente.
 */
export function authenticate(request, reply, done) {
  const header = request.headers["authorization"] || "";
  const token = header.startsWith("Bearer ") ? header.slice(7) : null;

  if (!token) {
    reply.status(401).send({ error: "Token ausente." });
    return;
  }

  try {
    const payload = jwt.verify(token, JWT_SECRET);
    request.userId = payload.userId;
    done();
  } catch {
    reply.status(401).send({ error: "Token inválido ou expirado." });
  }
}
