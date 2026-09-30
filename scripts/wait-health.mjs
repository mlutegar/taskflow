#!/usr/bin/env node
/**
 * wait-health.mjs — aguarda um endpoint de health responder antes de prosseguir.
 * Sem dependências (usa o fetch global do Node 18+). Nunca bloqueia pra sempre:
 * ao estourar o timeout, sai com código 0 e deixa o chamador seguir.
 *
 * Uso: node scripts/wait-health.mjs http://localhost:3001/health [timeoutMs]
 */
const url = process.argv[2] || "http://localhost:3001/health";
const timeoutMs = Number(process.argv[3] || 30000);
const start = Date.now();

process.stdout.write(`[wait-health] aguardando ${url} `);
while (Date.now() - start < timeoutMs) {
  try {
    const res = await fetch(url);
    if (res.ok) {
      console.log("→ ok");
      process.exit(0);
    }
  } catch {
    // ainda não subiu
  }
  process.stdout.write(".");
  await new Promise((r) => setTimeout(r, 500));
}
console.log(`\n[wait-health] timeout após ${timeoutMs}ms — seguindo mesmo assim.`);
process.exit(0);
