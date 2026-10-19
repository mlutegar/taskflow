-- AddTaskAssignedTo
-- Renomeia user_id → created_by e adiciona assigned_to
-- Migração SQLite: usa técnica de criar tabela nova, copiar, dropar antiga, renomear

PRAGMA foreign_keys=OFF;

-- Criar tabela tasks_new com schema atualizado
CREATE TABLE "tasks_new" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "created_by" TEXT NOT NULL,
    "assigned_to" TEXT,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "completed" BOOLEAN NOT NULL DEFAULT false,
    "priority" INTEGER NOT NULL DEFAULT 4,
    "due_date" DATETIME,
    "due_time" TEXT,
    "recurrence" TEXT,
    "recurrence_rule" TEXT,
    "project_id" TEXT,
    "estimated_minutes" INTEGER,
    "actual_minutes" INTEGER,
    "orbita_projects" TEXT,
    "orbita_prompt" TEXT,
    "orbita_last_key" TEXT,
    "orbita_last_provider" TEXT,
    "orbita_history" TEXT,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "version" INTEGER NOT NULL DEFAULT 0,
    "completed_at" DATETIME,
    "deleted_at" DATETIME,
    CONSTRAINT "tasks_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "tasks_assigned_to_fkey" FOREIGN KEY ("assigned_to") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "tasks_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "projects"("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- Copiar dados da tabela antiga para a nova
-- assigned_to = user_id (todas tarefas inicialmente atribuídas ao criador)
INSERT INTO "tasks_new" (
    "id",
    "created_by",
    "assigned_to",
    "title",
    "description",
    "completed",
    "priority",
    "due_date",
    "due_time",
    "recurrence",
    "recurrence_rule",
    "project_id",
    "estimated_minutes",
    "actual_minutes",
    "orbita_projects",
    "orbita_prompt",
    "orbita_last_key",
    "orbita_last_provider",
    "orbita_history",
    "created_at",
    "updated_at",
    "version",
    "completed_at",
    "deleted_at"
)
SELECT
    "id",
    "user_id" as "created_by",
    "user_id" as "assigned_to",
    "title",
    "description",
    "completed",
    "priority",
    "due_date",
    "due_time",
    "recurrence",
    "recurrence_rule",
    "project_id",
    "estimated_minutes",
    "actual_minutes",
    "orbita_projects",
    "orbita_prompt",
    "orbita_last_key",
    "orbita_last_provider",
    "orbita_history",
    "created_at",
    "updated_at",
    "version",
    "completed_at",
    "deleted_at"
FROM "tasks";

-- Dropar tabela antiga
DROP TABLE "tasks";

-- Renomear tabela nova
ALTER TABLE "tasks_new" RENAME TO "tasks";

-- Recriar índices otimizados
CREATE INDEX "tasks_created_by_idx" ON "tasks"("created_by");
CREATE INDEX "tasks_assigned_to_idx" ON "tasks"("assigned_to");
CREATE INDEX "tasks_created_by_assigned_to_idx" ON "tasks"("created_by", "assigned_to");
CREATE INDEX "tasks_created_by_completed_idx" ON "tasks"("created_by", "completed");
CREATE INDEX "tasks_assigned_to_completed_idx" ON "tasks"("assigned_to", "completed");
CREATE INDEX "tasks_created_by_due_date_idx" ON "tasks"("created_by", "due_date");
CREATE INDEX "tasks_created_by_deleted_at_idx" ON "tasks"("created_by", "deleted_at");
CREATE INDEX "tasks_created_by_project_id_idx" ON "tasks"("created_by", "project_id");

PRAGMA foreign_keys=ON;
