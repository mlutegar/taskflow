# 14 - Tempo Estimado e Filtro

Volta ao [[0-Painel]] · relacionado a [[5-Filtros-Ordenacao-Favoritos]], [[8-Atualizacao-Imediata-de-Tarefas]] e [[11-Projetos-e-Grupos]].

## O que é
Cada tarefa passou a ter um **tempo estimado para ser concluída** (`estimated_minutes`, em minutos, opcional).
O valor aparece no **card** e pode ser usado para **filtrar** por faixa de duração.

## Fluxo ponta a ponta
1. **Formulário** (`AddTaskForm.tsx` e edição inline em `TaskCard.tsx`): `select` com presets
   (Sem estimativa, 5, 10, 15, 30, 45, 60, 90, 120, 240 min). Presets e o formatador ficam em
   `frontend/src/lib/estimatedTime.ts`.
2. **Card** (`TaskCard.tsx`): badge `⏱ 30 min` na linha de meta (usa `formatMinutes`).
3. **Filtro "Tempo"** (`TasksPage.tsx`): dropdown ao lado de *Ordenar*, com faixas:
   - `fast` — ⚡ Rápida (≤15 min)
   - `medium` — ⏳ Média (16–60 min)
   - `long` — 🕰 Longa (>60 min)
   - `none` — Sem estimativa
   O valor é persistido na URL (`?time=`) e mandado ao backend. Há também o sort
   **"Tempo estimado"** (`sort=estimated`).

## Backend
- **Modelo** (`backend/prisma/schema.prisma`): `estimatedMinutes Int? @map("estimated_minutes")`.
- **Migração**: `prisma/migrations/20260918000000_add_task_estimated_minutes/`.
- **Rotas** (`backend/src/routes/tasks.js`):
  - Zod `create/updateTaskSchema`: `estimated_minutes` (int 0–1440, opcional/nullable).
  - `shapeTask` expõe `estimated_minutes`.
  - `GET /tasks?time=fast|medium|long|none` filtra por faixa via `where.estimatedMinutes`.
  - `sort=estimated` ordena por `estimatedMinutes asc` (nulos por último).

## Melhorias (v2)
1. **Faixas centralizadas**: limites (`fast ≤15`, `medium ≤60`, `long >60`) numa fonte única —
   `backend/src/taskEstimatedTime.js` (`bucketOf`, `estimatedTimeWhere`, `TIME_BUCKET_BOUNDS`) e
   `frontend/src/lib/estimatedTime.ts` (`bucketOf`, `TIME_BUCKET_BOUNDS`). Testado em `tasks.test.js`.
2. **Entrada livre**: componente `EstimatedTimeSelect.tsx` (presets + "Outro…" que aceita
   `90`, `1h30`, `45m` via `parseMinutesInput`). Usado no criar, editar e no ProjectManager.
3. **Cor por faixa** no badge do card (`.time_fast/medium/long`).
4. **Soma + alerta de sobrecarga** na `TasksPage`: "~Xh estimados" no cabeçalho e aviso quando o
   filtro Hoje passa do limite (`localStorage taskflow.overloadMinutes`, padrão 8 h).
5. **Tempo real gasto** (`actual_minutes`) editável no card + **badge de variância** (🎯 no alvo /
   ▲▼ %). Alimenta uma **calibração local** (`recordEstimationSample`/`getCalibrationFactor`) que
   sugere no formulário "você costuma levar ~X".
6. **Tempo padrão por projeto** (`Project.defaultEstimatedMinutes`): novas tarefas herdam o tempo do
   projeto quando não há estimativa explícita (herança no `POST /tasks` + prefill no `AddTaskForm`).

## Arquivos-chave
- Frontend: `lib/estimatedTime.ts`, `components/EstimatedTimeSelect.tsx`, `types/tasks.ts`,
  `lib/schemas.ts`, `api/tasks.ts`, `api/projects.ts`, `lib/taskKeys.ts`, `hooks/useTasks.ts`,
  `components/AddTaskForm.tsx`, `components/TaskCard.tsx`, `components/ProjectManager.tsx`,
  `pages/TasksPage.tsx`.
- Backend: `prisma/schema.prisma`, `src/routes/tasks.js`, `src/routes/projects.js`,
  `src/taskEstimatedTime.js`, migrações `..._add_task_estimated_minutes` e
  `..._add_actual_and_project_default_minutes`.

## Verificação
- `cd backend && npm test` (27 testes passam, inclui faixas) e servidor sobe em `:3001`.
- `cd frontend && npm run build` compila; `npx eslint .` limpo (exceto erro pré-existente em `vite.config.js`).
- Manual: criar/editar tarefa com tempo (preset ou livre) → badge colorido `⏱`; preencher "real gasto"
  → badge de variância; dropdown **Tempo** filtra e persiste (`?time=`); definir tempo padrão num
  projeto → novas tarefas herdam; filtro Hoje mostra soma e alerta de sobrecarga.
