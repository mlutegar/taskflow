-- CreateTable
CREATE TABLE "users" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "email" TEXT NOT NULL,
    "password_hash" TEXT NOT NULL,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateTable
CREATE TABLE "tasks" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "user_id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "completed" BOOLEAN NOT NULL DEFAULT false,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "version" INTEGER NOT NULL DEFAULT 0,
    "completed_at" DATETIME,
    "deleted_at" DATETIME,
    "priority" INTEGER NOT NULL DEFAULT 4,
    "due_date" DATETIME,
    "recurrence" TEXT,
    "recurrence_rule" TEXT,
    "project_id" TEXT,
    CONSTRAINT "tasks_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "projects" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "projects" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "user_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "color" TEXT NOT NULL DEFAULT '#7c6ef5',
    "emoji" TEXT NOT NULL DEFAULT '📁',
    "parent_id" TEXT,
    "archived" BOOLEAN NOT NULL DEFAULT false,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "projects_parent_id_fkey" FOREIGN KEY ("parent_id") REFERENCES "projects" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "task_completions" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "task_id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "scheduled_for" DATETIME,
    "previous_due_date" DATETIME,
    "next_due_date" DATETIME,
    "completed_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "undone_at" DATETIME,
    CONSTRAINT "task_completions_task_id_fkey" FOREIGN KEY ("task_id") REFERENCES "tasks" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "checklist_items" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "task_id" TEXT NOT NULL,
    "parent_id" INTEGER,
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
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
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
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
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
    "deleted_mode_ids" TEXT NOT NULL DEFAULT '[]',
    "hidden_mode_ids" TEXT NOT NULL DEFAULT '[]',
    "weekly_goal" INTEGER NOT NULL DEFAULT 5,
    "activities" TEXT NOT NULL DEFAULT '[]',
    "estados_custom" TEXT NOT NULL DEFAULT '[]',
    "paper_reminders" TEXT NOT NULL DEFAULT '[]',
    "last_estado_id" TEXT,
    "onboarded" BOOLEAN NOT NULL DEFAULT false,
    "timezone" TEXT NOT NULL DEFAULT 'America/Sao_Paulo',
    "updated_at" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "session_usage_logs" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "user_id" TEXT NOT NULL,
    "mode_id" TEXT NOT NULL,
    "date" TEXT NOT NULL,
    "hour" INTEGER NOT NULL,
    "worked" BOOLEAN,
    "focused_minutes" INTEGER NOT NULL DEFAULT 0,
    "idle_minutes" INTEGER NOT NULL DEFAULT 0,
    "idle_reason" TEXT NOT NULL DEFAULT '[]',
    "feeling" TEXT NOT NULL DEFAULT '[]',
    "combo_with" TEXT,
    "started_at" DATETIME,
    "ended_at" DATETIME,
    "session_duration_minutes" INTEGER,
    "efficiency_pct" INTEGER,
    "note" TEXT,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateTable
CREATE TABLE "user_mode_activations" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "user_id" TEXT NOT NULL,
    "mode_id" TEXT NOT NULL,
    "date" TEXT NOT NULL,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateTable
CREATE TABLE "mode_logs" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "user_id" TEXT NOT NULL,
    "mode_id" TEXT NOT NULL,
    "date" TEXT NOT NULL,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateTable
CREATE TABLE "mode_combo_logs" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
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
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- CreateIndex
CREATE INDEX "tasks_user_id_idx" ON "tasks"("user_id");

-- CreateIndex
CREATE INDEX "tasks_user_id_completed_idx" ON "tasks"("user_id", "completed");

-- CreateIndex
CREATE INDEX "tasks_user_id_due_date_idx" ON "tasks"("user_id", "due_date");

-- CreateIndex
CREATE INDEX "tasks_user_id_deleted_at_idx" ON "tasks"("user_id", "deleted_at");

-- CreateIndex
CREATE INDEX "tasks_user_id_project_id_idx" ON "tasks"("user_id", "project_id");

-- CreateIndex
CREATE INDEX "projects_user_id_archived_idx" ON "projects"("user_id", "archived");

-- CreateIndex
CREATE INDEX "projects_parent_id_idx" ON "projects"("parent_id");

-- CreateIndex
CREATE UNIQUE INDEX "projects_user_id_parent_id_name_key" ON "projects"("user_id", "parent_id", "name");

-- CreateIndex
CREATE INDEX "task_completions_user_id_completed_at_idx" ON "task_completions"("user_id", "completed_at");

-- CreateIndex
CREATE INDEX "task_completions_task_id_completed_at_idx" ON "task_completions"("task_id", "completed_at");

-- CreateIndex
CREATE INDEX "checklist_items_task_id_idx" ON "checklist_items"("task_id");

-- CreateIndex
CREATE INDEX "routines_user_id_idx" ON "routines"("user_id");

-- CreateIndex
CREATE INDEX "daily_tasks_user_id_idx" ON "daily_tasks"("user_id");

-- CreateIndex
CREATE INDEX "daily_tasks_task_id_idx" ON "daily_tasks"("task_id");

-- CreateIndex
CREATE UNIQUE INDEX "daily_tasks_date_task_id_user_id_key" ON "daily_tasks"("date", "task_id", "user_id");

-- CreateIndex
CREATE INDEX "daily_focus_sessions_user_id_created_at_idx" ON "daily_focus_sessions"("user_id", "created_at");

-- CreateIndex
CREATE INDEX "daily_focus_checkins_user_id_date_idx" ON "daily_focus_checkins"("user_id", "date");

-- CreateIndex
CREATE INDEX "session_usage_logs_user_id_date_idx" ON "session_usage_logs"("user_id", "date");

-- CreateIndex
CREATE UNIQUE INDEX "session_usage_logs_user_id_mode_id_date_hour_key" ON "session_usage_logs"("user_id", "mode_id", "date", "hour");

-- CreateIndex
CREATE UNIQUE INDEX "user_mode_activations_user_id_mode_id_date_key" ON "user_mode_activations"("user_id", "mode_id", "date");

-- CreateIndex
CREATE INDEX "mode_logs_user_id_date_idx" ON "mode_logs"("user_id", "date");

-- CreateIndex
CREATE UNIQUE INDEX "mode_logs_user_id_mode_id_date_key" ON "mode_logs"("user_id", "mode_id", "date");

-- CreateIndex
CREATE UNIQUE INDEX "mode_combo_logs_user_id_mode_id_a_mode_id_b_date_hour_key" ON "mode_combo_logs"("user_id", "mode_id_a", "mode_id_b", "date", "hour");

