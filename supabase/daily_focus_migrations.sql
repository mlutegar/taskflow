-- Daily Focus Sync — Migration SQL
-- Execute no SQL Editor do Supabase

-- ─── 1. Sessões ───────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS daily_focus_sessions (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  date DATE NOT NULL,
  completed_at TIME,
  level INTEGER NOT NULL DEFAULT 1,
  tasks TEXT[] NOT NULL DEFAULT '{}',
  timings JSONB NOT NULL DEFAULT '[]',
  rush_mode BOOLEAN NOT NULL DEFAULT false,
  estado_id TEXT,
  tab_mode BOOLEAN NOT NULL DEFAULT false,
  cycle_count INTEGER NOT NULL DEFAULT 0,
  tabs_opened INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now()
);
ALTER TABLE daily_focus_sessions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "user_own_sessions" ON daily_focus_sessions
  FOR ALL USING (auth.uid() = user_id);

-- ─── 2. Check-ins ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS daily_focus_checkins (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  estado_id TEXT NOT NULL,
  mode_id TEXT NOT NULL,
  date DATE NOT NULL,
  hour INTEGER NOT NULL,
  rating SMALLINT DEFAULT NULL CHECK (rating IN (-1, 1)),
  created_at TIMESTAMPTZ DEFAULT now()
);
ALTER TABLE daily_focus_checkins ENABLE ROW LEVEL SECURITY;
CREATE POLICY "user_own_checkins" ON daily_focus_checkins
  FOR ALL USING (auth.uid() = user_id);

-- ─── 3. Estado do dia ─────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS daily_focus_day_state (
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  date DATE NOT NULL,
  level INTEGER NOT NULL DEFAULT 0,
  used_modes JSONB NOT NULL DEFAULT '{}',
  updated_at TIMESTAMPTZ DEFAULT now(),
  PRIMARY KEY (user_id, date)
);
ALTER TABLE daily_focus_day_state ENABLE ROW LEVEL SECURITY;
CREATE POLICY "user_own_day_state" ON daily_focus_day_state
  FOR ALL USING (auth.uid() = user_id);

-- ─── 4. Achievements ──────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS daily_focus_achievements (
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  achievement_ids TEXT[] NOT NULL DEFAULT '{}',
  updated_at TIMESTAMPTZ DEFAULT now(),
  PRIMARY KEY (user_id)
);
ALTER TABLE daily_focus_achievements ENABLE ROW LEVEL SECURITY;
CREATE POLICY "user_own_achievements" ON daily_focus_achievements
  FOR ALL USING (auth.uid() = user_id);
