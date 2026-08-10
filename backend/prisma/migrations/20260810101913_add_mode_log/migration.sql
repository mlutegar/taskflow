-- CreateTable
CREATE TABLE "mode_logs" (
    "id" BIGINT NOT NULL PRIMARY KEY,
    "user_id" TEXT NOT NULL,
    "mode_id" TEXT NOT NULL,
    "date" TEXT NOT NULL,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateIndex
CREATE UNIQUE INDEX "mode_logs_user_id_mode_id_date_key" ON "mode_logs"("user_id", "mode_id", "date");
