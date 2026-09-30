-- Concorrência otimística (version) + tombstone (ended_at) para a sessão ativa cross-device.
ALTER TABLE "daily_focus_active_sessions" ADD COLUMN "version" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "daily_focus_active_sessions" ADD COLUMN "ended_at" DATETIME;
