-- Financas (Fase B). Migration ADITIVA: so CREATE TABLE/INDEX.

-- CreateTable
CREATE TABLE "income_sources" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "user_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateTable
CREATE TABLE "expected_incomes" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "user_id" TEXT NOT NULL,
    "source_id" TEXT,
    "amount_cents" INTEGER NOT NULL,
    "expected_date" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "description" TEXT,
    "received_entry_id" TEXT,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateTable
CREATE TABLE "finance_settings" (
    "user_id" TEXT NOT NULL PRIMARY KEY,
    "opening_balance_cents" INTEGER NOT NULL DEFAULT 0,
    "opening_date" TEXT,
    "updated_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateIndex
CREATE INDEX "income_sources_user_id_idx" ON "income_sources"("user_id");
CREATE INDEX "expected_incomes_user_id_expected_date_idx" ON "expected_incomes"("user_id", "expected_date");
