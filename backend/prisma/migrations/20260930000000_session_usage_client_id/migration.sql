-- Fusão Modos/Uso (#2): idempotência por clientId em vez do composite unique.
-- O unique (user_id, mode_id, date, hour) fazia duas sessões do mesmo modo na mesma
-- hora colidirem no upsert (uma sobrescrevia a outra → perda de sessão). Passamos a
-- deduplicar/idempotenciar por um UUID gerado no cliente (client_id).

ALTER TABLE "session_usage_logs" ADD COLUMN "client_id" TEXT;

DROP INDEX IF EXISTS "session_usage_logs_user_id_mode_id_date_hour_key";

CREATE UNIQUE INDEX "session_usage_logs_client_id_key" ON "session_usage_logs"("client_id");

CREATE INDEX "session_usage_logs_user_id_mode_id_date_idx" ON "session_usage_logs"("user_id", "mode_id", "date");
