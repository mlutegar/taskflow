-- Task: reuso de aba + histórico de launches do Órbita
ALTER TABLE "tasks" ADD COLUMN "orbita_last_key" TEXT;
ALTER TABLE "tasks" ADD COLUMN "orbita_last_provider" TEXT;
ALTER TABLE "tasks" ADD COLUMN "orbita_history" TEXT;

-- UserPreferences: template global do prompt do Órbita
ALTER TABLE "user_preferences" ADD COLUMN "orbita_prompt_template" TEXT NOT NULL DEFAULT '';
