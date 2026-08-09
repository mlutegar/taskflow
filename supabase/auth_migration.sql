-- ============================================================
-- Migração: Adicionar autenticação por usuário ao TaskFlow
-- Execute este SQL no SQL Editor do Supabase
-- (https://supabase.com/dashboard → SQL Editor)
-- ============================================================

-- 1. Adicionar coluna user_id nas tabelas principais
-- ------------------------------------------------------------

alter table tasks
  add column if not exists user_id uuid references auth.users(id) on delete cascade;

alter table routines
  add column if not exists user_id uuid references auth.users(id) on delete cascade;

alter table daily_tasks
  add column if not exists user_id uuid references auth.users(id) on delete cascade;

-- mode_stats tem PK simples (mode_id); precisa virar PK composta.
-- Apagamos os dados antigos (são só contadores, serão recriados automaticamente)
-- e recriamos a tabela com a estrutura correta.
drop table if exists mode_stats cascade;

create table mode_stats (
  mode_id  text not null,
  user_id  uuid not null references auth.users(id) on delete cascade,
  task_count integer not null default 0,
  updated_at timestamptz not null default now(),
  primary key (mode_id, user_id)
);

alter table mode_stats enable row level security;

-- 2. Triggers para preencher user_id automaticamente no INSERT
-- ------------------------------------------------------------

create or replace function set_user_id()
returns trigger as $$
begin
  new.user_id := auth.uid();
  return new;
end;
$$ language plpgsql security definer;

-- tasks
drop trigger if exists set_tasks_user_id on tasks;
create trigger set_tasks_user_id
  before insert on tasks
  for each row execute function set_user_id();

-- routines
drop trigger if exists set_routines_user_id on routines;
create trigger set_routines_user_id
  before insert on routines
  for each row execute function set_user_id();

-- mode_stats
drop trigger if exists set_mode_stats_user_id on mode_stats;
create trigger set_mode_stats_user_id
  before insert on mode_stats
  for each row execute function set_user_id();

-- daily_tasks
drop trigger if exists set_daily_tasks_user_id on daily_tasks;
create trigger set_daily_tasks_user_id
  before insert on daily_tasks
  for each row execute function set_user_id();

-- 3. Remover políticas públicas antigas e criar políticas por usuário
-- ------------------------------------------------------------

-- tasks
drop policy if exists "Acesso público" on tasks;
create policy "Usuário acessa apenas seus dados" on tasks
  for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- checklist_items: filtra via task do usuário
drop policy if exists "Acesso público" on checklist_items;
create policy "Usuário acessa apenas seus checklist_items" on checklist_items
  for all
  using (
    exists (
      select 1 from tasks
      where tasks.id = checklist_items.task_id
        and tasks.user_id = auth.uid()
    )
  )
  with check (
    exists (
      select 1 from tasks
      where tasks.id = checklist_items.task_id
        and tasks.user_id = auth.uid()
    )
  );

-- routines
drop policy if exists "Acesso público" on routines;
create policy "Usuário acessa apenas seus dados" on routines
  for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- routine_checklist_items: filtra via routine do usuário
drop policy if exists "Acesso público" on routine_checklist_items;
create policy "Usuário acessa apenas seus routine_checklist_items" on routine_checklist_items
  for all
  using (
    exists (
      select 1 from routines
      where routines.id = routine_checklist_items.routine_id
        and routines.user_id = auth.uid()
    )
  )
  with check (
    exists (
      select 1 from routines
      where routines.id = routine_checklist_items.routine_id
        and routines.user_id = auth.uid()
    )
  );

-- mode_stats
create policy "Usuário acessa apenas seus dados" on mode_stats
  for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- daily_tasks
drop policy if exists "Acesso público" on daily_tasks;
create policy "Usuário acessa apenas seus dados" on daily_tasks
  for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- 4. Atualizar a função de incremento atômico para respeitar user_id
-- ------------------------------------------------------------

create or replace function increment_mode_stat(p_mode_id text)
returns integer as $func$
declare
  v_count integer;
  v_user_id uuid;
begin
  v_user_id := auth.uid();

  insert into mode_stats (mode_id, user_id, task_count, updated_at)
  values (p_mode_id, v_user_id, 1, now())
  on conflict (mode_id, user_id) do update
    set task_count = mode_stats.task_count + 1,
        updated_at = now()
  returning task_count into v_count;

  return v_count;
end;
$func$ language plpgsql security definer;

-- 5. Ajustar unique constraint de daily_tasks para incluir user_id
-- ------------------------------------------------------------
alter table daily_tasks drop constraint if exists daily_tasks_date_task_id_key;
alter table daily_tasks add constraint daily_tasks_date_task_id_user_id_key
  unique (date, task_id, user_id);

-- ============================================================
-- Pronto! Agora cada usuário vê e edita apenas seus próprios dados.
-- ============================================================
