-- Checkpoint emocional por sessão do Daily Focus (registrado a cada início/retomada do timer).
CREATE TABLE "daily_focus_emotions" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "user_id" TEXT NOT NULL,
    "emotion" TEXT NOT NULL,
    "moment" TEXT NOT NULL,
    "date" DATETIME NOT NULL,
    "hour" INTEGER NOT NULL,
    "task_title" TEXT,
    "task_index" INTEGER,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX "daily_focus_emotions_user_id_date_idx" ON "daily_focus_emotions"("user_id", "date");
