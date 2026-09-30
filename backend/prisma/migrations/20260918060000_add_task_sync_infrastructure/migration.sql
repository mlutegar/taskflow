-- Histórico/auditoria de tarefas
CREATE TABLE "task_changes" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "user_id" TEXT NOT NULL,
    "task_id" TEXT,
    "action" TEXT NOT NULL,
    "before" TEXT,
    "after" TEXT,
    "metadata" TEXT,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "undone_at" DATETIME
);

-- Recibos de idempotência para reenvios seguros
CREATE TABLE "task_mutation_receipts" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "user_id" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "method" TEXT NOT NULL,
    "path" TEXT NOT NULL,
    "status" INTEGER NOT NULL DEFAULT 0,
    "response" TEXT,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX "task_changes_user_id_created_at_idx" ON "task_changes"("user_id", "created_at");
CREATE INDEX "task_changes_task_id_created_at_idx" ON "task_changes"("task_id", "created_at");
CREATE UNIQUE INDEX "task_mutation_receipts_user_id_key_key" ON "task_mutation_receipts"("user_id", "key");
CREATE INDEX "task_mutation_receipts_created_at_idx" ON "task_mutation_receipts"("created_at");
