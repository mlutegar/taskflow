-- Idempotência do histórico de sessões: clientId gerado no cliente permite
-- upsert (dedupe) e retries seguros sem criar duplicatas.
ALTER TABLE "daily_focus_sessions" ADD COLUMN "client_id" TEXT;

-- Índice único composto (user_id, client_id). No SQLite, valores NULL são
-- considerados distintos entre si, então registros antigos sem client_id não
-- colidem. Espelha o @@unique([userId, clientId]) do schema (sem drift).
CREATE UNIQUE INDEX "daily_focus_sessions_user_id_client_id_key"
  ON "daily_focus_sessions" ("user_id", "client_id");
