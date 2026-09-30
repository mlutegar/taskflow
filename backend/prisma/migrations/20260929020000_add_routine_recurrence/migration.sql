-- Adiciona agendamento opcional às rotinas (hábitos): NULL/"none" = sempre;
-- "daily" = todo dia; "weekdays" = seg–sex. Espelha a lógica de recorrência
-- das tarefas (frontend lib/dailyRoutine.ts).
ALTER TABLE "routines" ADD COLUMN "recurrence" TEXT;
