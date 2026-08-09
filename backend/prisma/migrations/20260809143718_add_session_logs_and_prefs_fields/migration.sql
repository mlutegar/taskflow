-- CreateTable
CREATE TABLE "session_usage_logs" (
    "id" BIGINT NOT NULL PRIMARY KEY,
    "user_id" TEXT NOT NULL,
    "mode_id" TEXT NOT NULL,
    "date" TEXT NOT NULL,
    "hour" INTEGER NOT NULL,
    "worked" BOOLEAN NOT NULL DEFAULT false,
    "focused_minutes" INTEGER NOT NULL DEFAULT 0,
    "idle_minutes" INTEGER NOT NULL DEFAULT 0,
    "idle_reason" TEXT NOT NULL DEFAULT '[]',
    "feeling" TEXT NOT NULL DEFAULT '[]',
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_user_preferences" (
    "user_id" TEXT NOT NULL PRIMARY KEY,
    "custom_modes" TEXT NOT NULL DEFAULT '[]',
    "deleted_mode_ids" TEXT NOT NULL DEFAULT '[]',
    "weekly_goal" INTEGER NOT NULL DEFAULT 5,
    "activities" TEXT NOT NULL DEFAULT '[]',
    "estados_custom" TEXT NOT NULL DEFAULT '[]',
    "paper_reminders" TEXT NOT NULL DEFAULT '[]',
    "last_estado_id" TEXT,
    "onboarded" BOOLEAN NOT NULL DEFAULT false,
    "updated_at" DATETIME NOT NULL
);
INSERT INTO "new_user_preferences" ("activities", "custom_modes", "estados_custom", "paper_reminders", "updated_at", "user_id", "weekly_goal") SELECT "activities", "custom_modes", "estados_custom", "paper_reminders", "updated_at", "user_id", "weekly_goal" FROM "user_preferences";
DROP TABLE "user_preferences";
ALTER TABLE "new_user_preferences" RENAME TO "user_preferences";
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;

-- CreateIndex
CREATE UNIQUE INDEX "session_usage_logs_user_id_mode_id_date_hour_key" ON "session_usage_logs"("user_id", "mode_id", "date", "hour");
