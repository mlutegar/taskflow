-- Sessão de foco EM ANDAMENTO (cross-device): uma por usuário, last-write-wins.
CREATE TABLE "daily_focus_active_sessions" (
    "user_id" TEXT NOT NULL PRIMARY KEY,
    "date" DATETIME NOT NULL,
    "live" TEXT NOT NULL,
    "session" TEXT NOT NULL DEFAULT '{}',
    "focus_timer" TEXT,
    "updated_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);
