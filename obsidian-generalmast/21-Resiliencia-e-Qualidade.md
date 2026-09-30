# 21 - Resiliência e Qualidade

Voltar ao [[0-Painel]].

Medidas para evitar (e conter) erros como o **React #310** que derrubou a aba Tarefas
(ver o incidente em [[7-Tarefas-Recorrentes]]).

## Prevenção — pegar o bug antes do deploy

### Regra dos Hooks no ESLint (o gate que teria pego o #310)
- O `eslint.config.js` agora lint também `**/*.{ts,tsx}` (antes só `.js/.jsx`, por isso
  os painéis `.tsx` passavam batido).
- Usa `typescript-eslint` (parser) + `eslint-plugin-react-hooks`. A regra
  `react-hooks/rules-of-hooks` é **erro** → falha o `npm run lint` (e o CI).
- Ao ativar, foram encontradas e **corrigidas 7 violações reais** pré-existentes em
  `DashboardPage.tsx` (hooks `useMemo` após `return` condicional) — mesma classe do #310.

### TypeScript fixado em 5.6
- `typescript` estava em `^7.0.2` (preview, incompatível com typescript-eslint e com
  type-check real). Fixado em **5.6.3**. Build/testes usam esbuild, então runtime não muda.

### Type-check (informativo, não-bloqueante)
- Novo `frontend/tsconfig.json` (leniente) + script `npm run typecheck` (`tsc --noEmit`).
- Há ~472 erros de tipagem herdados → **não** é gate ainda; roda no CI com
  `continue-on-error: true`. Meta futura: zerar aos poucos e então tornar bloqueante.

### CI (`.github/workflows/ci.yml`)
Ordem: `lint` (bloqueia) → `typecheck` (informativo) → `test` → `build`.

## Contenção — não deixar a tela toda cair

### Error Boundary por painel
- `frontend/src/components/ErrorBoundary.tsx` ganhou modo `compact` + `label`.
- Em `TasksPage.tsx`, cada painel (Rotina Diária, Hoje & Atrasadas, Tarefas de Hoje)
  é envolvido por `<ErrorBoundary compact label="...">`. Um painel que quebra mostra
  "⚠ Falha ao carregar … / Tentar de novo" sem derrubar a aba inteira.
- O fallback de tela cheia agora tem **Tentar novamente** + **Recarregar app**.

### Sourcemaps em produção
- `vite.config.js` → `build.sourcemap = true`. Erros minificados (ex.: #310) passam a
  apontar arquivo/linha reais no console.

## Testes
- `frontend/src/components/DueTodayPanel.test.tsx` — smoke test do cenário exato do
  incidente: renderiza `DueTodayPanel` e `DailyRoutinePanel` com lista **vazia** e
  **cheia** (early return + hooks), garantindo que não quebram. (79 testes no total.)

## Deploy — healthcheck e rollback rápido

### Healthcheck do frontend
- `docker-compose.yml`: o serviço `taskflow` (nginx) agora tem `healthcheck` (wget na
  porta 80), além do que a API já tinha.

### Rollback rápido (VPS) — #8
Antes de rebuildar no VPS, tagueie a imagem atual como `:prev` para reverter em segundos:
```bash
cd /root/taskflow
docker tag taskflow:latest taskflow:prev
docker tag taskflow-api:latest taskflow-api:prev
docker compose up -d --build          # deploy normal

# se quebrar, reverter:
docker tag taskflow:prev taskflow:latest
docker tag taskflow-api:prev taskflow-api:latest
docker compose up -d                  # sem --build, sobe a imagem anterior
```

## Arquivos
- `frontend/eslint.config.js` — lint de ts/tsx + regra dos hooks
- `frontend/tsconfig.json`, `frontend/package.json` — `typecheck`, typescript 5.6
- `.github/workflows/ci.yml` — step de type-check
- `frontend/src/components/ErrorBoundary.tsx` — modo compact/label + recarregar
- `frontend/src/pages/TasksPage.tsx` — painéis envolvidos por ErrorBoundary
- `frontend/vite.config.js` — sourcemaps
- `frontend/src/components/DueTodayPanel.test.tsx` — smoke test
- `docker-compose.yml` — healthcheck do frontend
