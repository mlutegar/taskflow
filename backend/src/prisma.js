import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

/**
 * SQLite em WAL — requisito do Litestream.
 *
 * O Litestream só replica bancos em `journal_mode=WAL`; com o padrão
 * (`delete`) ele falha com "attempt to write a readonly database" e a
 * replicação morre **em silêncio** — o app segue funcionando e o backup não
 * existe. Foi exatamente o que aconteceu no primeiro deploy do KVM 8.
 *
 * O modo é gravado no cabeçalho do arquivo, então persiste entre reinícios;
 * aplicamos no boot para que qualquer banco novo (deploy limpo) já nasça certo.
 * `synchronous=NORMAL` é o par recomendado do WAL: seguro contra crash do
 * processo, sem o custo de fsync a cada commit.
 */
export async function enableWalMode() {
  try {
    const [{ journal_mode: mode }] = await prisma.$queryRawUnsafe("PRAGMA journal_mode=WAL;");
    await prisma.$queryRawUnsafe("PRAGMA synchronous=NORMAL;");
    if (String(mode).toLowerCase() !== "wal") {
      console.warn(`[prisma] journal_mode ficou em "${mode}" — Litestream não vai replicar.`);
    }
    return mode;
  } catch (err) {
    // Não derruba a API: sem WAL o app funciona, só o backup fica degradado.
    console.warn("[prisma] não foi possível ativar WAL:", err?.message ?? err);
    return null;
  }
}

export default prisma;
