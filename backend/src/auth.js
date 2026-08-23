/**
 * auth.js — Valida o JWT do Supabase consultando a própria API do Supabase.
 * Não precisa do JWT Secret — o Supabase verifica e retorna o usuário.
 */

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY;

if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
  throw new Error("Missing SUPABASE_URL or SUPABASE_ANON_KEY environment variables.");
}

/**
 * Fastify preHandler — verifica o JWT do Supabase e injeta userId no request.
 * Retorna 401 se o token for inválido ou ausente.
 */
export async function authenticate(request, reply) {
  const header = request.headers["authorization"] || "";
  const token = header.startsWith("Bearer ") ? header.slice(7) : null;

  if (!token) {
    return reply.status(401).send({ error: "Token ausente." });
  }

  try {
    const res = await fetch(`${SUPABASE_URL}/auth/v1/user`, {
      headers: {
        Authorization: `Bearer ${token}`,
        apikey: SUPABASE_ANON_KEY,
      },
    });

    if (!res.ok) {
      return reply.status(401).send({ error: "Token inválido ou expirado." });
    }

    const user = await res.json();

    if (!user?.id) {
      return reply.status(401).send({ error: "Token inválido." });
    }

    request.userId = user.id;
  } catch {
    return reply.status(401).send({ error: "Erro ao validar token." });
  }
}
