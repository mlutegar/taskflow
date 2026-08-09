-- CreateTable
CREATE TABLE "tasks" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "user_id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "completed" BOOLEAN NOT NULL DEFAULT false,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completed_at" DATETIME,
    "priority" INTEGER NOT NULL DEFAULT 4,
    "due_date" DATETIME,
    "recurrence" TEXT
);

-- CreateTable
CREATE TABLE "checklist_items" (
    "id" BIGINT NOT NULL PRIMARY KEY,
    "task_id" TEXT NOT NULL,
    "parent_id" BIGINT,
    "description" TEXT NOT NULL,
    "note" TEXT,
    "completed" BOOLEAN NOT NULL DEFAULT false,
    "order" INTEGER NOT NULL DEFAULT 0,
    CONSTRAINT "checklist_items_task_id_fkey" FOREIGN KEY ("task_id") REFERENCES "tasks" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "checklist_items_parent_id_fkey" FOREIGN KEY ("parent_id") REFERENCES "checklist_items" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "routines" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "user_id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "target_value" REAL,
    "unit" TEXT,
    "current_progress" REAL NOT NULL DEFAULT 0,
    "last_completed_date" DATETIME,
    "completion_history" TEXT NOT NULL DEFAULT '[]',
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateTable
CREATE TABLE "routine_checklist_items" (
    "id" BIGINT NOT NULL PRIMARY KEY,
    "routine_id" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "completed" BOOLEAN NOT NULL DEFAULT false,
    "order" INTEGER NOT NULL DEFAULT 0,
    CONSTRAINT "routine_checklist_items_routine_id_fkey" FOREIGN KEY ("routine_id") REFERENCES "routines" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "mode_stats" (
    "mode_id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "task_count" INTEGER NOT NULL DEFAULT 0,
    "updated_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,

    PRIMARY KEY ("mode_id", "user_id")
);

-- CreateTable
CREATE TABLE "daily_tasks" (
    "id" BIGINT NOT NULL PRIMARY KEY,
    "user_id" TEXT NOT NULL,
    "date" DATETIME NOT NULL,
    "task_id" TEXT NOT NULL,
    "position" INTEGER NOT NULL DEFAULT 0,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "daily_tasks_task_id_fkey" FOREIGN KEY ("task_id") REFERENCES "tasks" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "daily_focus_sessions" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "user_id" TEXT NOT NULL,
    "date" DATETIME NOT NULL,
    "completed_at" TEXT,
    "level" INTEGER NOT NULL DEFAULT 1,
    "tasks" TEXT NOT NULL DEFAULT '[]',
    "timings" TEXT NOT NULL DEFAULT '[]',
    "rush_mode" BOOLEAN NOT NULL DEFAULT false,
    "estado_id" TEXT,
    "tab_mode" BOOLEAN NOT NULL DEFAULT false,
    "cycle_count" INTEGER NOT NULL DEFAULT 0,
    "tabs_opened" INTEGER NOT NULL DEFAULT 0,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateTable
CREATE TABLE "daily_focus_checkins" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "user_id" TEXT NOT NULL,
    "estado_id" TEXT NOT NULL,
    "mode_id" TEXT NOT NULL,
    "date" DATETIME NOT NULL,
    "hour" INTEGER NOT NULL,
    "rating" INTEGER,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateTable
CREATE TABLE "daily_focus_day_state" (
    "user_id" TEXT NOT NULL,
    "date" DATETIME NOT NULL,
    "level" INTEGER NOT NULL DEFAULT 0,
    "used_modes" TEXT NOT NULL DEFAULT '{}',
    "updated_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,

    PRIMARY KEY ("user_id", "date")
);

-- CreateTable
CREATE TABLE "daily_focus_achievements" (
    "user_id" TEXT NOT NULL PRIMARY KEY,
    "achievement_ids" TEXT NOT NULL DEFAULT '[]',
    "updated_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateTable
CREATE TABLE "user_preferences" (
    "user_id" TEXT NOT NULL PRIMARY KEY,
    "custom_modes" TEXT NOT NULL DEFAULT '[]',
    "weekly_goal" INTEGER NOT NULL DEFAULT 5,
    "activities" TEXT NOT NULL DEFAULT '[]',
    "estados_custom" TEXT NOT NULL DEFAULT '[]',
    "paper_reminders" TEXT NOT NULL DEFAULT '[]',
    "updated_at" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "user_mode_activations" (
    "id" BIGINT NOT NULL PRIMARY KEY,
    "user_id" TEXT NOT NULL,
    "mode_id" TEXT NOT NULL,
    "date" TEXT NOT NULL,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateIndex
CREATE UNIQUE INDEX "daily_tasks_date_task_id_user_id_key" ON "daily_tasks"("date", "task_id", "user_id");

-- CreateIndex
CREATE UNIQUE INDEX "user_mode_activations_user_id_mode_id_date_key" ON "user_mode_activations"("user_id", "mode_id", "date");
