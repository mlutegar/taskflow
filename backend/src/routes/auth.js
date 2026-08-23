import { z } from "zod";
import prisma from "../prisma.js";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { JWT_SECRET } from "../auth.js";

const JWT_EXPIRES = "7d";

// ── Zod schemas ──────────────────────────────────────────────────────────────
const registerSchema = z.object({
  email:    z.string().email("E-mail inválido."),
  password: z.string().min(6, "A senha deve ter pelo menos 6 caracteres.").max(128),
  name:     z.string().min(1).max(100).optional(),
});
const loginSchema = z.object({
  email:    z.string().email("E-mail inválido."),
  password: z.string().min(1, "Senha obrigatória."),
});

// ── Rate limiting ─────────────────────────────────────────────────────────────
const loginAttempts    = new Map();
const registerAttempts = new Map();
const MAX_LOGIN_ATTEMPTS    = 10;
const MAX_REGISTER_ATTEMPTS = 5;
const WINDOW_MS             = 15 * 60 * 1000;

function makeRateLimiter(map, max) {
  return {
    check(key) {
      const now   = Date.now();
      const entry = map.get(key) ?? { count: 0, resetAt: now + WINDOW_MS };
      if (now > entry.resetAt) {
        map.set(key, { count: 1, resetAt: now + WINDOW_MS });
        return { blocked: false };
      }
      entry.count++;
      map.set(key, entry);
      if (entry.count > max) {
        const retryAfter = Math.ceil((entry.resetAt - now) / 1000);
        return { blocked: true, retryAfter };
      }
      return { blocked: false };
    },
    clear(key) { map.delete(key); },
  };
}

const loginLimiter    = makeRateLimiter(loginAttempts,    MAX_LOGIN_ATTEMPTS);
const registerLimiter = makeRateLimiter(registerAttempts, MAX_REGISTER_ATTEMPTS);

function signToken(payload) {
  return jwt.sign(payload, JWT_SECRET, { expiresIn: JWT_EXPIRES });
}

export default async function authRoutes(fastify) {
  // POST /auth/register
  fastify.post("/register", async (req, reply) => {
    const parsed = registerSchema.safeParse(req.body ?? {});
    if (!parsed.success) {
      return reply.status(400).send({ code: "VALIDATION_ERROR", message: "Dados inválidos.", details: parsed.error.flatten().fieldErrors });
    }
    const { email, password } = parsed.data;

    const ip = req.ip || req.headers["x-forwarded-for"] || "unknown";
    const { blocked: regBlocked, retryAfter: regRetry } = registerLimiter.check(ip);
    if (regBlocked) {
      reply.header("Retry-After", String(regRetry));
      return reply.status(429).send({
        code: "RATE_LIMIT_EXCEEDED",
        message: `Muitas tentativas de cadastro. Tente novamente em ${Math.ceil(regRetry / 60)} minuto(s).`,
      });
    }

    const existing = await prisma.user.findUnique({ where: { email } });
    if (existing) {
      return reply.status(409).send({ code: "EMAIL_TAKEN", message: "Este e-mail já está cadastrado." });
    }

    const passwordHash = await bcrypt.hash(password, 10);
    const user = await prisma.user.create({ data: { email, passwordHash } });

    const token = signToken({ userId: user.id, email: user.email });
    return reply.status(201).send({
      token,
      user: { id: user.id, email: user.email },
      isNewUser: true,
    });
  });

  // POST /auth/login
  fastify.post("/login", async (req, reply) => {
    const parsed = loginSchema.safeParse(req.body ?? {});
    if (!parsed.success) {
      return reply.status(400).send({ code: "VALIDATION_ERROR", message: "Dados inválidos.", details: parsed.error.flatten().fieldErrors });
    }
    const { email, password } = parsed.data;

    const { blocked, retryAfter } = loginLimiter.check(email);
    if (blocked) {
      reply.header("Retry-After", String(retryAfter));
      return reply.status(429).send({
        code: "RATE_LIMIT_EXCEEDED",
        message: `Muitas tentativas. Tente novamente em ${Math.ceil(retryAfter / 60)} minuto(s).`,
      });
    }

    const user = await prisma.user.findUnique({ where: { email } });
    if (!user) {
      return reply.status(401).send({ code: "INVALID_CREDENTIALS", message: "E-mail ou senha incorretos." });
    }

    const valid = await bcrypt.compare(password, user.passwordHash);
    if (!valid) {
      return reply.status(401).send({ code: "INVALID_CREDENTIALS", message: "E-mail ou senha incorretos." });
    }

    loginLimiter.clear(email);

    const token = signToken({ userId: user.id, email: user.email });
    return reply.send({ token, user: { id: user.id, email: user.email } });
  });

  // POST /auth/refresh
  fastify.post("/refresh", async (req, reply) => {
    const header = req.headers["authorization"] || "";
    const token  = header.startsWith("Bearer ") ? header.slice(7) : null;

    if (!token) return reply.status(401).send({ code: "TOKEN_MISSING", message: "Token ausente." });

    let payload;
    try {
      payload = jwt.verify(token, JWT_SECRET, { ignoreExpiration: true });
    } catch {
      return reply.status(401).send({ code: "TOKEN_INVALID", message: "Token inválido." });
    }

    const user = await prisma.user.findUnique({
      where: { id: payload.userId },
      select: { id: true, email: true },
    });
    if (!user) return reply.status(401).send({ code: "USER_NOT_FOUND", message: "Usuário não encontrado." });

    const newToken = signToken({ userId: user.id, email: user.email });
    return reply.send({ token: newToken, user });
  });
}
