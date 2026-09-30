-- Fusão Modos/Uso (#2) — Supabase/Postgres.
-- Idempotência por client_id em vez do composite unique (user_id, mode_id, date, hour),
-- que fazia duas sessões do mesmo modo na mesma hora colidirem (perda de sessão).
-- Obs.: o backend autoritativo é o Fastify/Prisma (SQLite). Esta migração cobre
-- deployments que usam Supabase diretamente.

ALTER TABLE session_usage_logs ADD COLUMN IF NOT EXISTS client_id TEXT;

-- Remove o unique composto (nome pode variar conforme criação original).
ALTER TABLE session_usage_logs
  DROP CONSTRAINT IF EXISTS session_usage_logs_user_id_mode_id_date_hour_key;

-- Idempotência por UUID do cliente (múltiplos NULLs permitidos em unique no Postgres).
CREATE UNIQUE INDEX IF NOT EXISTS session_usage_logs_client_id_key
  ON session_usage_logs(client_id);

-- Índice não-único para as consultas por modo/dia.
CREATE INDEX IF NOT EXISTS session_usage_logs_user_id_mode_id_date_idx
  ON session_usage_logs(user_id, mode_id, date);
