# TaskFlow API — Backend

Backend Node.js com Fastify + Prisma para o TaskFlow.

## Setup

### 1. Preencher o `.env`

Copie `.env.example` → `.env` e preencha:

- **DATABASE_URL** e **DIRECT_URL**: Supabase → Settings → Database → Connection string
  - Transaction mode (porta 6543) para `DATABASE_URL`
  - Session mode (porta 5432) para `DIRECT_URL`
- **SUPABASE_JWT_SECRET**: Supabase → Settings → API → JWT Secret

### 2. Instalar dependências

```bash
npm install
```

### 3. Rodar migrations

Para sincronizar o schema com o banco (primeira vez):

```bash
npm run db:push
```

Para novas migrations após mudanças no `schema.prisma`:

```bash
npm run db:migrate
```

### 4. Iniciar o servidor

```bash
npm run dev    # desenvolvimento (hot reload)
npm start      # produção
```

O servidor sobe em `http://localhost:3001`.

## Rotas

| Método | Path | Descrição |
|--------|------|-----------|
| GET | /health | Health check |
| GET | /tasks | Listar tarefas |
| POST | /tasks | Criar tarefa |
| PATCH | /tasks/:id | Atualizar tarefa |
| DELETE | /tasks/:id | Deletar tarefa |
| POST | /tasks/:id/complete | Completar tarefa |
| POST | /tasks/:id/reopen | Reabrir tarefa |
| GET | /tasks/due-today | Tarefas com vencimento hoje |
| GET | /tasks/completed-today-count | Contagem de tarefas concluídas hoje |
| POST | /tasks/:id/checklist | Adicionar item ao checklist |
| PATCH | /tasks/:id/checklist/:itemId | Atualizar item |
| PATCH | /tasks/:id/checklist/:itemId/toggle | Marcar/desmarcar item |
| DELETE | /tasks/:id/checklist/:itemId | Deletar item |
| GET | /routines | Listar rotinas |
| POST | /routines | Criar rotina |
| PATCH | /routines/:id | Atualizar rotina |
| DELETE | /routines/:id | Deletar rotina |
| POST | /routines/:id/complete | Marcar rotina completa |
| POST | /routines/:id/uncomplete | Desmarcar rotina |
| POST | /routines/:id/complete-date | Marcar para data específica |
| POST | /routines/:id/progress | Adicionar progresso |
| GET | /daily-tasks/:date | Tarefas do dia |
| POST | /daily-tasks/:date/:taskId | Adicionar tarefa ao dia |
| DELETE | /daily-tasks/:date/:taskId | Remover tarefa do dia |
| GET | /mode-stats | Estatísticas de modos |
| POST | /mode-stats/:modeId/increment | Incrementar contador |
| POST | /daily-focus/sessions | Salvar sessão |
| GET | /daily-focus/sessions | Listar sessões |
| POST | /daily-focus/checkins | Registrar check-in |
| GET | /daily-focus/checkins | Listar check-ins |
| PATCH | /daily-focus/checkins/feedback | Atualizar feedback |
| GET | /daily-focus/day-state | Estado do dia |
| PUT | /daily-focus/day-state | Atualizar estado do dia |
| GET | /daily-focus/achievements | Listar conquistas |
| POST | /daily-focus/achievements/:id | Desbloquear conquista |

## Autenticação

Todas as rotas (exceto `/health`) exigem o header:

```
Authorization: Bearer <JWT do Supabase>
```

O frontend injeta isso automaticamente via `apiClient.js`.
