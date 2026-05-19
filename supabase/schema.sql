-- TaskFlow - Schema para Supabase
-- Execute este SQL no SQL Editor do Supabase (https://supabase.com/dashboard)

-- Tabela de tarefas
create table tasks (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  description text,
  completed boolean not null default false,
  created_at timestamptz not null default now(),
  priority integer not null default 4,
  due_date date
);

-- Itens de checklist das tarefas
create table checklist_items (
  id bigserial primary key,
  task_id uuid not null references tasks(id) on delete cascade,
  description text not null,
  completed boolean not null default false,
  "order" integer not null default 0
);

-- Tabela de rotinas
create table routines (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  description text,
  target_value float,
  unit text,
  current_progress float not null default 0,
  last_completed_date date,
  completion_history jsonb not null default '[]',
  created_at timestamptz not null default now()
);

-- Itens de checklist das rotinas
create table routine_checklist_items (
  id bigserial primary key,
  routine_id uuid not null references routines(id) on delete cascade,
  description text not null,
  completed boolean not null default false,
  "order" integer not null default 0
);

-- Habilitar Row Level Security
alter table tasks enable row level security;
alter table checklist_items enable row level security;
alter table routines enable row level security;
alter table routine_checklist_items enable row level security;

-- Políticas de acesso público (sem autenticação)
-- ATENÇÃO: qualquer pessoa com a URL pode ler/escrever.
-- Adicione autenticação quando necessário.
create policy "Acesso público" on tasks for all using (true) with check (true);
create policy "Acesso público" on checklist_items for all using (true) with check (true);
create policy "Acesso público" on routines for all using (true) with check (true);
create policy "Acesso público" on routine_checklist_items for all using (true) with check (true);
