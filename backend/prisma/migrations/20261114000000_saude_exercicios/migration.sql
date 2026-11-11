-- Saúde / Exercícios (Fase D). Migration ADITIVA: só CREATE TABLE/INDEX.

-- CreateTable
CREATE TABLE "workouts" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "user_id" TEXT NOT NULL,
    "date" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "duration_min" INTEGER NOT NULL,
    "notes" TEXT,
    "plan_id" TEXT,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateTable
CREATE TABLE "workout_plans" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "user_id" TEXT NOT NULL,
    "weekday" INTEGER NOT NULL,
    "type" TEXT NOT NULL,
    "duration_min" INTEGER,
    "order" INTEGER NOT NULL DEFAULT 0,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateIndex
CREATE INDEX "workouts_user_id_date_idx" ON "workouts"("user_id", "date");

-- CreateIndex
CREATE INDEX "workout_plans_user_id_weekday_idx" ON "workout_plans"("user_id", "weekday");
