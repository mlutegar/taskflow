-- AlterTable: adiciona tempo estimado (em minutos) para concluir a tarefa
ALTER TABLE "tasks" ADD COLUMN "estimated_minutes" INTEGER;
