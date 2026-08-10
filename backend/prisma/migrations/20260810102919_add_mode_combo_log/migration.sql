-- CreateTable
CREATE TABLE "mode_combo_logs" (
    "id" BIGINT NOT NULL PRIMARY KEY,
    "user_id" TEXT NOT NULL,
    "mode_id_a" TEXT NOT NULL,
    "mode_id_b" TEXT NOT NULL,
    "date" TEXT NOT NULL,
    "hour" INTEGER NOT NULL,
    "worked" BOOLEAN,
    "focused_minutes" INTEGER NOT NULL DEFAULT 0,
    "feeling" TEXT NOT NULL DEFAULT '[]',
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateIndex
CREATE UNIQUE INDEX "mode_combo_logs_user_id_mode_id_a_mode_id_b_date_hour_key" ON "mode_combo_logs"("user_id", "mode_id_a", "mode_id_b", "date", "hour");
