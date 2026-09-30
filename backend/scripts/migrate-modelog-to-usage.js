/**
 * migrate-modelog-to-usage.js — migração única (#3 da fusão Modos/Uso).
 *
 * Após a fusão, `session_usage_logs` é a fonte única do ranking "mais usados"
 * (`usageStats` soma `tasks_completed`). Os dados históricos de `mode_logs` ficaram
 * órfãos e não entram mais no ranking. Este script preserva esse histórico: para cada
 * `mode_logs(user, mode, date)` SEM um `session_usage_logs` correspondente no mesmo dia,
 * cria um registro mínimo de uso com `tasks_completed = 1`.
 *
 * É idempotente (só cria o que falta) e não sobrescreve nada existente.
 *
 * Uso:
 *   cd backend && node scripts/migrate-modelog-to-usage.js          # aplica
 *   cd backend && node scripts/migrate-modelog-to-usage.js --dry    # só relata
 *
 * Rode DEPOIS de aplicar a migration 20260930000000_session_usage_client_id
 * (prisma migrate deploy). Requer DATABASE_URL apontando para o banco.
 */
import "../src/loadEnv.js";
import prisma from "../src/prisma.js";

const DRY = process.argv.includes("--dry");

function uuid() {
  // UUID v4 simples, sem dependências (serve de client_id estável do registro migrado).
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    return (c === "x" ? r : (r & 0x3) | 0x8).toString(16);
  });
}

async function main() {
  const modeLogs = await prisma.modeLog.findMany({
    select: { userId: true, modeId: true, date: true },
  });
  console.log(`[migrate] ${modeLogs.length} registros em mode_logs.`);

  // Set de chaves (user|mode|date) que já têm ao menos um session_usage_log.
  const usage = await prisma.sessionUsageLog.findMany({
    select: { userId: true, modeId: true, date: true },
  });
  const haveUsage = new Set(usage.map((u) => `${u.userId}|${u.modeId}|${u.date}`));

  let created = 0;
  let skipped = 0;
  for (const m of modeLogs) {
    const key = `${m.userId}|${m.modeId}|${m.date}`;
    if (haveUsage.has(key)) { skipped++; continue; }
    if (DRY) { created++; haveUsage.add(key); continue; }
    await prisma.sessionUsageLog.create({
      data: {
        clientId:       uuid(),
        userId:         m.userId,
        modeId:         m.modeId,
        date:           m.date,
        hour:           0,
        worked:         null,
        focusedMinutes: 0,
        idleMinutes:    0,
        idleReason:     "[]",
        feeling:        "[]",
        tasksCompleted: 1,
      },
    });
    haveUsage.add(key); // evita duplicar se mode_logs tiver a mesma chave repetida
    created++;
  }

  console.log(`[migrate] ${DRY ? "(dry) " : ""}criados: ${created} · já tinham uso: ${skipped}`);
}

main()
  .catch((e) => { console.error("[migrate] erro:", e); process.exit(1); })
  .finally(async () => { await prisma.$disconnect(); });
