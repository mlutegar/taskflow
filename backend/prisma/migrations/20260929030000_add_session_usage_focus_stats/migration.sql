-- Métricas ricas do acumulador de foco do modo (sincronizado ao Daily Focus).
-- pause_count: nº de pausas do foco; paused_minutes: tempo total pausado;
-- focus_blocks: nº de blocos de foco (fragmentação); tasks_completed: tarefas
-- concluídas com o modo ativo.
ALTER TABLE "session_usage_logs" ADD COLUMN "pause_count" INTEGER;
ALTER TABLE "session_usage_logs" ADD COLUMN "paused_minutes" INTEGER;
ALTER TABLE "session_usage_logs" ADD COLUMN "focus_blocks" INTEGER;
ALTER TABLE "session_usage_logs" ADD COLUMN "tasks_completed" INTEGER;
