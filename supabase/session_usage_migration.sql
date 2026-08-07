-- Migration: session_usage_logs
-- Registros de uso pós-sessão de modos (dados qualitativos de foco e estado)

CREATE TABLE IF NOT EXISTS session_usage_logs (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id          UUID REFERENCES auth.users NOT NULL,
  mode_id          TEXT NOT NULL,
  date             DATE NOT NULL,
  hour             SMALLINT NOT NULL CHECK (hour >= 0 AND hour <= 23),
  worked           BOOLEAN,
  focused_minutes  SMALLINT CHECK (focused_minutes >= 0),
  idle_minutes     SMALLINT CHECK (idle_minutes >= 0),
  idle_reason      TEXT[],
  feeling          TEXT[],
  created_at       TIMESTAMPTZ DEFAULT now()
);

-- Row Level Security
ALTER TABLE session_usage_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read own session usage logs"
  ON session_usage_logs FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own session usage logs"
  ON session_usage_logs FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- Índices para queries de análise
CREATE INDEX IF NOT EXISTS idx_session_usage_user_date
  ON session_usage_logs (user_id, date DESC);

CREATE INDEX IF NOT EXISTS idx_session_usage_mode
  ON session_usage_logs (user_id, mode_id);
