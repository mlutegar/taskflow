-- Índices para melhorar performance de queries frequentes

-- tasks: queries por userId (listar), userId+completed (filtrar), userId+dueDate (ordenar)
CREATE INDEX IF NOT EXISTS "tasks_user_id_idx" ON "tasks"("user_id");
CREATE INDEX IF NOT EXISTS "tasks_user_id_completed_idx" ON "tasks"("user_id", "completed");
CREATE INDEX IF NOT EXISTS "tasks_user_id_due_date_idx" ON "tasks"("user_id", "due_date");

-- checklist_items: queries por task_id (eager load)
CREATE INDEX IF NOT EXISTS "checklist_items_task_id_idx" ON "checklist_items"("task_id");

-- daily_tasks: queries por userId e taskId
CREATE INDEX IF NOT EXISTS "daily_tasks_user_id_idx" ON "daily_tasks"("user_id");
CREATE INDEX IF NOT EXISTS "daily_tasks_task_id_idx" ON "daily_tasks"("task_id");

-- daily_focus_sessions: queries por userId+createdAt (listar sessões do usuário)
CREATE INDEX IF NOT EXISTS "daily_focus_sessions_user_id_created_at_idx" ON "daily_focus_sessions"("user_id", "created_at");

-- daily_focus_checkins: queries por userId+date (feedback, listagem)
CREATE INDEX IF NOT EXISTS "daily_focus_checkins_user_id_date_idx" ON "daily_focus_checkins"("user_id", "date");

-- session_usage_logs: queries por userId+date (paginação, sync)
CREATE INDEX IF NOT EXISTS "session_usage_logs_user_id_date_idx" ON "session_usage_logs"("user_id", "date");

-- mode_logs: queries por userId+date (últimos 90 dias)
CREATE INDEX IF NOT EXISTS "mode_logs_user_id_date_idx" ON "mode_logs"("user_id", "date");
