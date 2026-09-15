/**
 * auth.js — Valida JWTs emitidos pelo backend próprio (SQLite + JWT).
 * Usa jsonwebtoken para verificar a assinatura localmente, sem chamadas externas.
 */

import jwt from "jsonwebtoken";

// Em produção, um JWT_SECRET forte é obrigatório. Falhar cedo evita subir o
// servidor assinando tokens com um segredo padrão fraco (falha de segurança).
if (process.env.NODE_ENV === "production" && !process.env.JWT_SECRET) {
  throw new Error(
    "[auth] JWT_SECRET não definido em produção. Defina uma chave segura via variável de ambiente."
  );
}

export const JWT_SECRET =
  process.env.JWT_SECRET || "taskflow-dev-secret-2026";

/**
 * Fastify preHandler — verifica o JWT local e injeta userId no request.
 * Retorna 401 se o token for inválido ou ausente.
 */
export function authenticate(request, reply, done) {
  const header = request.headers["authorization"] || "";
  const token = header.startsWith("Bearer ") ? header.slice(7) : null;

  if (!token) {
    reply.status(401).send({ code: "TOKEN_MISSING", message: "Token ausente." });
    return;
  }

  try {
    const payload = jwt.verify(token, JWT_SECRET);
    request.userId = payload.userId;
    done();
  } catch {
    reply.status(401).send({ code: "TOKEN_INVALID", message: "Token inválido ou expirado." });
  }
}
