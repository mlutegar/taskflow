-- Adiciona a atividade contínua do dia (JSON como texto) ao estado diário do Daily Focus.
ALTER TABLE "daily_focus_day_state" ADD COLUMN "continuous_activity" TEXT;
