-- Saúde / Skincare (Fase B). Migration ADITIVA: só CREATE TABLE/INDEX.

-- CreateTable
CREATE TABLE "skincare_products" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "user_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "category" TEXT NOT NULL DEFAULT 'outro',
    "status" TEXT NOT NULL DEFAULT 'have',
    "notes" TEXT,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateTable
CREATE TABLE "skincare_steps" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "user_id" TEXT NOT NULL,
    "period" TEXT NOT NULL,
    "order" INTEGER NOT NULL DEFAULT 0,
    "product_id" TEXT,
    "label" TEXT NOT NULL,
    "frequency" TEXT NOT NULL DEFAULT 'daily',
    "days_of_week" TEXT NOT NULL DEFAULT '[]',
    "interval_days" INTEGER,
    "start_date" TEXT NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "skincare_steps_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "skincare_products" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "skincare_checks" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "user_id" TEXT NOT NULL,
    "step_id" TEXT NOT NULL,
    "date" TEXT NOT NULL,
    "step_label" TEXT NOT NULL,
    "done_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "skincare_checks_step_id_fkey" FOREIGN KEY ("step_id") REFERENCES "skincare_steps" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE INDEX "skincare_products_user_id_idx" ON "skincare_products"("user_id");

-- CreateIndex
CREATE INDEX "skincare_steps_user_id_period_idx" ON "skincare_steps"("user_id", "period");

-- CreateIndex
CREATE INDEX "skincare_steps_product_id_idx" ON "skincare_steps"("product_id");

-- CreateIndex
CREATE UNIQUE INDEX "skincare_checks_step_id_date_key" ON "skincare_checks"("step_id", "date");

-- CreateIndex
CREATE INDEX "skincare_checks_user_id_date_idx" ON "skincare_checks"("user_id", "date");
