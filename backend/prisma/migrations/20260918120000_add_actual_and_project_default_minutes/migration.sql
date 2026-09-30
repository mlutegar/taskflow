-- Tempo real gasto por tarefa e tempo estimado padrão por projeto.
-- Observação: em Postgres, prefira "ADD COLUMN IF NOT EXISTS" ao portar este passo.
ALTER TABLE "tasks" ADD COLUMN "actual_minutes" INTEGER;
ALTER TABLE "projects" ADD COLUMN "default_estimated_minutes" INTEGER;
