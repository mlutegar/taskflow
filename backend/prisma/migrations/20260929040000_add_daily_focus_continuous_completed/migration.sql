-- Adiciona o log de atividades contínuas concluídas no dia (JSON como texto) ao estado diário do Daily Focus.
ALTER TABLE "daily_focus_day_state" ADD COLUMN "continuous_completed" TEXT;
