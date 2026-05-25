# Migration — Mode Stats

Adiciona a tabela `mode_stats` e a função `increment_mode_stat` ao banco Supabase.

## Como executar

1. Acesse [supabase.com/dashboard](https://supabase.com/dashboard)
2. Selecione seu projeto
3. Vá em **SQL Editor**
4. Cole o SQL abaixo e clique em **Run**

---

## SQL

```sql
-- Tabela de stats dos modos (tarefas concluídas por modo)
create table mode_stats (
  mode_id    text        primary key,
  task_count integer     not null default 0,
  updated_at timestamptz not null default now()
);

-- Row Level Security
alter table mode_stats enable row level security;
create policy "Acesso público" on mode_stats for all using (true) with check (true);

-- Função de incremento atômico (sem race condition)
create or replace function increment_mode_stat(p_mode_id text)
returns integer as $$
declare
  v_count integer;
begin
  insert into mode_stats (mode_id, task_count, updated_at)
  values (p_mode_id, 1, now())
  on conflict (mode_id) do update
    set task_count = mode_stats.task_count + 1,
        updated_at = now()
  returning task_count into v_count;
  return v_count;
end;
$$ language plpgsql;
```

---

## O que foi criado

| Objeto | Tipo | Descrição |
|--------|------|-----------|
| `mode_stats` | Tabela | Uma linha por modo (`music`, `tiktok`, etc.) com o total de tarefas concluídas |
| `increment_mode_stat` | Função RPC | Incrementa `task_count` de forma atômica via `INSERT ... ON CONFLICT DO UPDATE` |

### Colunas de `mode_stats`

| Coluna | Tipo | Descrição |
|--------|------|-----------|
| `mode_id` | `text` (PK) | ID do modo (`music`, `tiktok`, `splite`, `momentum`, `espresso`, `rpg`, `lazyfal`) |
| `task_count` | `integer` | Total acumulado de tarefas concluídas neste modo |
| `updated_at` | `timestamptz` | Última vez que o contador foi atualizado |

---

## Reverter (rollback)

```sql
drop function if exists increment_mode_stat(text);
drop table if exists mode_stats;
```
