-- Enriquecimento do checkpoint emocional: intensidade, momento "end", contexto de sessão e dedup.
ALTER TABLE "daily_focus_emotions" ADD COLUMN "intensity" TEXT;
ALTER TABLE "daily_focus_emotions" ADD COLUMN "timestamp" TEXT;
ALTER TABLE "daily_focus_emotions" ADD COLUMN "task_id" TEXT;
ALTER TABLE "daily_focus_emotions" ADD COLUMN "mode_ids" TEXT;
ALTER TABLE "daily_focus_emotions" ADD COLUMN "level" INTEGER;
ALTER TABLE "daily_focus_emotions" ADD COLUMN "rush_mode" BOOLEAN;
ALTER TABLE "daily_focus_emotions" ADD COLUMN "tab_mode" BOOLEAN;
ALTER TABLE "daily_focus_emotions" ADD COLUMN "pause_secs" INTEGER;
ALTER TABLE "daily_focus_emotions" ADD COLUMN "completed" BOOLEAN;
ALTER TABLE "daily_focus_emotions" ADD COLUMN "used_secs" INTEGER;
ALTER TABLE "daily_focus_emotions" ADD COLUMN "total_secs" INTEGER;
