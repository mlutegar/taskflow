-- Saúde / Remédios (Fase A). Migration ADITIVA: só CREATE TABLE/INDEX, sem tocar em tabelas existentes.

-- CreateTable
CREATE TABLE "medications" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "user_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "dose" TEXT,
    "frequency" TEXT NOT NULL DEFAULT 'daily',
    "days_of_week" TEXT NOT NULL DEFAULT '[]',
    "interval_days" INTEGER,
    "start_date" TEXT NOT NULL,
    "end_date" TEXT,
    "stock_qty" REAL NOT NULL DEFAULT 0,
    "low_stock_threshold" REAL NOT NULL DEFAULT 5,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateTable
CREATE TABLE "medication_schedules" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "medication_id" TEXT NOT NULL,
    "time" TEXT NOT NULL,
    "dose_qty" REAL NOT NULL DEFAULT 1,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "order" INTEGER NOT NULL DEFAULT 0,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "medication_schedules_medication_id_fkey" FOREIGN KEY ("medication_id") REFERENCES "medications" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "medication_intakes" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "user_id" TEXT NOT NULL,
    "medication_id" TEXT NOT NULL,
    "schedule_id" TEXT,
    "date" TEXT NOT NULL,
    "scheduled_time" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "dose_qty" REAL NOT NULL DEFAULT 1,
    "taken_at" DATETIME,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "medication_intakes_medication_id_fkey" FOREIGN KEY ("medication_id") REFERENCES "medications" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "medication_intakes_schedule_id_fkey" FOREIGN KEY ("schedule_id") REFERENCES "medication_schedules" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateIndex
CREATE INDEX "medications_user_id_idx" ON "medications"("user_id");

-- CreateIndex
CREATE INDEX "medication_schedules_medication_id_idx" ON "medication_schedules"("medication_id");

-- CreateIndex
CREATE UNIQUE INDEX "medication_intakes_schedule_id_date_key" ON "medication_intakes"("schedule_id", "date");

-- CreateIndex
CREATE INDEX "medication_intakes_user_id_date_idx" ON "medication_intakes"("user_id", "date");

-- CreateIndex
CREATE INDEX "medication_intakes_medication_id_date_idx" ON "medication_intakes"("medication_id", "date");
