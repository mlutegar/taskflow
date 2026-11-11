-- Financas (Fase A). Migration ADITIVA: so CREATE TABLE/INDEX.

-- CreateTable
CREATE TABLE "finance_categories" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "user_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "emoji" TEXT,
    "color" TEXT,
    "order" INTEGER NOT NULL DEFAULT 0,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateTable
CREATE TABLE "finance_entries" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "user_id" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "amount_cents" INTEGER NOT NULL,
    "date" TEXT NOT NULL,
    "category_id" TEXT,
    "description" TEXT,
    "payment_method" TEXT,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateTable
CREATE TABLE "finance_series" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "user_id" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "amount_cents" INTEGER NOT NULL,
    "installments" INTEGER,
    "start_date" TEXT NOT NULL,
    "end_date" TEXT,
    "day_of_month" INTEGER NOT NULL,
    "category_id" TEXT,
    "description" TEXT,
    "payment_method" TEXT,
    "supersedes_id" TEXT,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateTable
CREATE TABLE "finance_series_exceptions" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "user_id" TEXT NOT NULL,
    "series_id" TEXT NOT NULL,
    "month" TEXT NOT NULL,
    "skipped" BOOLEAN NOT NULL DEFAULT false,
    "amount_cents" INTEGER
);

-- CreateIndex
CREATE INDEX "finance_categories_user_id_idx" ON "finance_categories"("user_id");
CREATE INDEX "finance_entries_user_id_date_idx" ON "finance_entries"("user_id", "date");
CREATE INDEX "finance_series_user_id_start_date_idx" ON "finance_series"("user_id", "start_date");
CREATE INDEX "finance_series_exceptions_user_id_idx" ON "finance_series_exceptions"("user_id");
CREATE UNIQUE INDEX "finance_series_exceptions_series_id_month_key" ON "finance_series_exceptions"("series_id", "month");
