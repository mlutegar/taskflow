-- Adiciona hora de vencimento opcional (formato "HH:MM") às tarefas.
ALTER TABLE "tasks" ADD COLUMN "due_time" TEXT;
