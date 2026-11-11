# CLAUDE.md — TaskFlow

PWA de organização de tarefas (uso principal: celular), em produção em `kflow.mlutegar.com`.
Abas: **Tarefas / Hábitos (Rotinas) / Modos**; nav inferior mobile: Tarefas · Hábitos · Foco (Daily Focus) + drawer (Modos, Análises, Perfil).
Priorização diária (5 tarefas "de Hoje"), pomodoro/foco, Daily Focus, modos de atividade.

> Documentação histórica detalhada: vault `obsidian-generalmast/` (começar por `0-Painel.md`; uma nota numerada por feature/fix). **Antes de qualquer tarefa, olhar o Painel; depois de concluir, criar nota nova (N+1) e linkar no Painel.**
> O `README.md` da raiz está **desatualizado** (fala de Supabase/GitHub Pages; a realidade é o backend próprio abaixo).

## 1. Stack e scripts

Monorepo sem workspaces (raiz = só orquestração dev; pacote raiz chama-se `generalmast`).

| Camada | Stack |
|---|---|
| Frontend (`frontend/`) | React 18 + Vite 5 + TypeScript (`strict: false`, `allowJs`), CSS Modules (+ Tailwind 4 plugin presente), TanStack Query 5, lucide-react, recharts, react-markdown, zod 3, vite-plugin-pwa (SW custom em `src/sw.ts`) |
| Backend (`backend/`) | Node 20, Fastify 4 (ESM, **JS puro**), Prisma 5 + **SQLite**, JWT + bcryptjs, zod 4, @fastify/{cors,multipart,rate-limit,static} |
| Testes | Frontend: Vitest + jsdom + Testing Library. Backend: `node --test` |
| Infra | Docker Compose (api + nginx + litestream), VPS |

Scripts:
- Raiz: `npm run dev` (API :3001 + Web :5175, libera portas antes), `npm run setup` (`prisma migrate`/db:push)
- Frontend: `npm run dev|build|lint|typecheck|typecheck:baseline|test|test:coverage` (CI roda lint → typecheck(informativo) → **typecheck:baseline (bloqueante)** → `test -- --run` → build)
- **Tipos (ratchet):** `tsc` ainda tem erros herdados (92 em 42 arquivos, ver `frontend/tsc-baseline.json`; a maioria é duplicação de tipos `Task`/`ChecklistItem`/`Mode` — etapa 04 do `PROMPTS.md`). `npm run typecheck:baseline` falha se o total **ou** o nº de erros de qualquer arquivo aumentar. Ao reduzir erros, rode `npm run typecheck:baseline -- --update` e commite o JSON (o baseline só pode diminuir). Código novo não pode entrar com erro de tipo. Lint está em 0 erros (só warnings) — mantenha; `rules-of-hooks` é o gate contra o React #310.
- Backend: `npm run dev` (migrate deploy + `node --watch`), `start`, `test`, `db:migrate`, `db:deploy`, `db:drift-check`, `db:studio`
- Dev: Vite proxia `/api/*` → `http://localhost:3001` (remove o prefixo `/api`). `base` do Vite = `/taskflow/`.
- Env: `.env` na raiz (JWT_SECRET, etc.), `frontend/.env.local`. Nunca commitar.

## 2. Deploy
- Produção: VPS via Docker Compose (`docker-compose.yml`: `taskflow-api` 127.0.0.1:3033→3001, frontend nginx em 3026, `litestream` replica o SQLite em `/data`).
- `deploy-git.ps1` (preferido: push → pull no VPS `kvm8` → rebuild → health), `deploy-vps.sh` (legado tar/scp idempotente, preserva `.env`), `deploy.ps1`.
- Frontend builda **dentro** do Docker (multi-stage, Debian — não Alpine, bug do vite-plugin-pwa); `APP_COMMIT` injetado → versão `pkg+hash` visível no app (`src/version.ts`).
- Backend roda `prisma migrate deploy` no start. CI extra: `.github/workflows/backend-migrations.yml` falha se `schema.prisma` divergir das migrations (`db:drift-check`) → **toda mudança de schema precisa de migration** em `backend/prisma/migrations/<timestamp>_nome/`.
- `.github/workflows/deploy.yml` (GitHub Pages) é legado.

## 3. Arquitetura

### Backend (`backend/src`)
`index.js` registra rotas com prefixo: `/auth /tasks /projects /routines /daily-tasks /mode-stats /daily-focus /preferences /session-usage-logs /mode-combo-log /ai /uploads /orbita /ical /saude/medications /saude/skincare /saude/shopping-list /saude/nutrition` + `GET /health`. Arquivos em `routes/*.js`; helpers de domínio em `src/` (`taskRecurrence.js`, `taskVersion.js`, `taskSyncInfrastructure.js`, `taskEstimatedTime.js`, `auth.js`, `prisma.js`).
Models (Prisma/SQLite): User, Task (+ChecklistItem, TaskCompletion, TaskChange, TaskMutationReceipt), Project, Routine (+RoutineChecklistItem), DailyTask, DailyFocus{Session,Checkin,Emotion,DayState,Achievement,ActiveSession}, UserPreferences, SessionUsageLog, UserModeActivation, ModeStat, ModeLog (legado), ModeComboLog.
**Atenção:** dono dos models é `userId` (não `createdBy`) — há teste-guard `taskOwnerField.test.js`. Tarefas usam versão otimista (409 em conflito).

### Frontend (`frontend/src`)
- **Roteamento por hash**, sem react-router: `main.tsx` mapeia `#/tasks #/routines #/modes #/daily-focus #/dashboard #/history #/profile`; rota desconhecida → `#/tasks`. Shell: `components/layout/{AppShell,Sidebar,BottomNav,MobileDrawer,navItems}`. `App.tsx` ≈ Tarefas/legado.
- **Providers acima do roteador** (`main.tsx`): `AuthContext`, `ActiveModeContext` (sessão de modo global, minimizável → `FloatingModeCard`), `QuickTaskContext` (captura rápida, atalho N / Ctrl+K), QueryClient, Toast. `DailyFocusFloatingCard` aparece fora de `#/daily-focus`.
- **Páginas**: `pages/{TasksPage,RoutinesPage,ModesPage,TaskDetailPage}`, `components/daily-focus/DailyFocusPage.tsx` (~125KB, maior arquivo), `components/dashboard`, `history`, `analytics`, `auth` (ProfilePage).
- **Dados**: TanStack Query (`hooks/useTasks|useRoutines|useProjects|…`, chaves em `lib/taskKeys.ts`; chaves de painéis agregados ficam FORA de `taskKeys.lists()` com invalidação explícita). Clientes HTTP em `api/*.ts` sobre `lib/apiClient.ts` (JWT, timeout, refresh em 401 single-flight, BroadcastChannel entre abas).
- **Persistência local**: `lib/storage.ts` (`storageGet/Set`, prefixo `taskflow.`) + chaves centralizadas em `lib/storageKeys.ts` (`SK.*`). Offline/sync: `syncQueue.ts`, `taskOfflineQueue.ts`, `syncToBackend.ts`, outbox de sessões (`clientId` + upsert), `useRemoteSync`.
- **Daily Focus**: fases (prepare → select → foco/pausa → celebrate), snapshot ancorado em timestamp em `lib/dailyFocusLive.ts` (sincroniza entre dispositivos via `DailyFocusActiveSession`), foco medido por modo em `lib/modeFocusTimer.ts`, log de uso em `lib/sessionUsageLog.ts` (**fonte única** de uso de modos; `session_usage_logs`).

## 4. Modos (aba "Modos")

**Fonte única do catálogo:** `frontend/src/data/modes.ts` (2168 linhas)
- `MODES` — array de **97** modos embutidos. Campos: `id, type ("durante"|"entre"), emoji, name, tagline, color, colorBg, category?, group?, session?, preset?, context[], prerequisite, whyItWorks, whenToUse, steps[], tips`. Tipo em `components/modes/types.ts` (`ModeConfig`).
- `CATEGORY_BY_ID` (fallback de categoria por id), `CATEGORY_ORDER = [Música, Ciclos, Foco, Memória, Ritual, Mobile, Personalizados]`, `HELPER_GROUPS` (ids que podem ser "apoio" no Daily Focus).
- `data/musicVariants.ts` (variantes de música), `data/presetCombos.ts` (combos), `lib/modeAliases.ts` (ids legados → canônicos, ex. `music → music_hundred`), `lib/customModes.ts` (modos do usuário, `custom_*`, + `deletedModeIds`/`hiddenModeIds`).
- Teste de integridade: `data/modes.coverage.test.ts` (ids únicos, helpers existem, etc.).

**Renderização:** `pages/ModesPage.tsx` → `components/ModesPanel.tsx` (~1200 linhas: filtros, busca, ordenação, favoritos, ocultar, combos, detox) → `ModePicker.tsx` / `modes/ModeCard.tsx` (card com chips categoria/tipo/contexto + botão Iniciar; segurar/botão-direito → `ModeDetailSheet`). Estilo: `ModesPanel.module.css`.

**Execução:** botão Iniciar → `useActiveMode().activate(mode, intention)` (`contexts/ActiveModeContext.tsx`; persiste snapshot `SK.ACTIVE_MODE_SESSION`) → `components/ModeSession.tsx` resolve `mode.session || mode.id` em `SESSION_MAP` e renderiza o componente em `components/sessions/*` (props `preset`, tarefas/rotinas e callbacks). Sessão sem entrada no mapa → **fallback `SpliteSession`** (com `console.warn`); `isCustom` → `CustomModeSession`. Ao fechar: `PostSessionForm` → `logQuickUsage`/`sessionUsageLog` + `modeStatsApi`. Multi-card ("Minha Sessão"): `MultiCardSession`/`SlotBoard`. Minimizado: `FloatingModeCard`. No Daily Focus, modos de apoio usam `components/daily-focus/helpers/index.ts` (`HELPER_REGISTRY`/`getHelper`: id → Component + defaultState; prefixos `splite_*`, `custom_*`).

**Para criar um modo novo:** (1) objeto em `MODES` (+ entrada em `CATEGORY_BY_ID` se sem `category`; + id em `HELPER_GROUPS` se for helper); (2) `session`/`preset` apontando para componente existente ou novo em `components/sessions/` registrado em `SESSION_MAP`; (3) helper no `HELPER_REGISTRY` se aplicável; (4) rodar `modes.coverage.test.ts`.

### Catálogo (id → categoria · session que executa)
- **Música:** `music_hundred`, `music_album`, `music_playlist`, `music_liked` (Músicas Curtidas), `music_dj` (DJ do Spotify) → `MusicSession` (preset.variant; `liked`/`dj` reutilizam o fluxo `hundred_*`, com botão "Abrir Spotify" via `lib/openSpotify.ts` — `spotify:` + fallback `open.spotify.com`; variantes em `data/musicVariants.ts`). *Melhoria futura:* botão "Abrir Spotify" nos 3 modos de música antigos; `sing_one`, `sing_ten` → `SingSession`; `cantar` (helper `CantarHelper`, sem sessão própria); `playlist_fixed`, `playlist_prog` → `TikTokSession`
- **Ciclos** (todos `TikTokSession` via `TIKTOK_LIKE_PLATFORMS` em `ModeSession.tsx`, `{plataforma}_{variante}`): `tiktok|reels|youtube|twitter|reddit` × `fixed, prog_videos, prog_both, detox`; `whatsapp_{fixed,prog_tasks,prog_both,detox}`; `gamer_{fixed,prog}`; `netflix_{episode,detox}`; `tiktok_salvos`, `instagram_salvos` → `SavedQueueSession`; `splite` → `SpliteSession`; `lazyfal` → `LazyFalconSession`; `modo_aleatorio`
- **Foco:** `momentum` → `MomentumSession`; `espresso` → `EspressoSession`; `rpg` → `RPGSession`; `pomodoro` → `PomodoroSession`; `sprint_pendencias` → `SprintPendenciasSession`; `papel_caneta`, `_frase`, `_estimativa` → `PapelCanetaSession`; `papel_caneta_revisao` → `SpliteSession`; `uma_coisa_5min|15min`; `cold_turkey`, `accountability`, `dead_deadline`, `papel_tela`, `estatua`, `em_pe`, `modo_serie`, `melhorar_taskflow`; `aba_navegador_{successao,igualdade}`, `aba_windows_{successao,igualdade}`
- **Memória:** `anki_atividade`, `orbita_atividade`, `orbita_successao`, `orbita_igualdade`, `orbita_voz`
- **Ritual:** `agua, meditar, ler_diario, esticar, livro, exercicio, caminhar, tomar_banho, embaixadinha, pausa_digital` → `SpliteSession` (preset); `diario_falado` → `DiarioFaladoSession`; `soneca_5|15` → `NapSession`; `respiracao` → `BreathingSession`; `caferitual`, `cafe_com_leite` (preset `leite`: só texto/emoji/cor, `data/cafeVariants.ts`) → `CafeRitualSession`; `morning_routine`, `comer_algo`, `recompensa`, `diario_celular|pc|mao`, `shot_dagua`, `comprar_bala`, `gratidao`
- **Mobile:** `tabhop` → `TabHopSession`
- **Personalizados:** `custom_*` → `CustomModeSession`
- Modos sem entrada em `SESSION_MAP`: ver **seção 7 — Pendências conhecidas**.
- Observação: no código as categorias de `tiktok_*`, `reels_*`, `youtube_*`, `twitter_*`, `reddit_*`, `whatsapp_*`, `gamer_*`, `netflix_*`, `playlist_*`, `splite`, `lazyfal`, `momentum`… vêm de `CATEGORY_BY_ID`, não do objeto.

## 5. Convenções
- Idioma: **PT-BR** em UI, comentários, commits e notas; identificadores de código em inglês/PT misto (ids de modo em snake_case PT: `ler_diario`, `papel_caneta`).
- Commits: Conventional Commits em PT (`fix:`, `feat:`, `docs:`, `fix(backup):`). Não pushar/deployar sem pedir.
- Frontend: componentes `PascalCase.tsx` com `*.module.css` ao lado; hooks `useX.ts`; libs `camelCase.ts`; clientes em `api/`; tipos em `types/`; testes `*.test.ts(x)` ao lado do arquivo. Páginas móveis específicas em `components/tasks-mobile/` usando `useIsMobile()` + `@media (max-width: 640px)` (desktop não deve mudar). Ícones: `lucide-react` (migrando dos emojis). Tema por variáveis CSS (`var(--text)`, `--surface-2`, `--border`).
- Estado/side effects: preferir React Query + invalidação explícita; localStorage só via `storageGet/Set` + `SK`; eventos cross-componente via `window` custom events (`lib/modeEvents.ts`, `DAILY_FOCUS_LIVE_EVENT`).
- Hooks: respeitar regra dos hooks (lint); cada painel com `ErrorBoundary`. Sourcemaps ligados no build.
- Backend: ESM, rotas = plugin Fastify por arquivo, validação com zod, queries Prisma escopadas por `userId`; mudanças de schema → migration versionada.
- Datas: usar helpers de `lib/dateUtils.ts` (bug histórico UTC vs fuso local).
- Mudou algo relevante? Criar nota no `obsidian-generalmast/` e linkar no `0-Painel.md`.
- `PROMPTS.md` (raiz) acompanha a sequência de prompts de trabalho; atualizar status ao concluir cada um.

## 6. Armadilhas conhecidas
- `.claude/worktrees/` é ignorado (worktrees de agentes já quebraram `git status`/clone).
- Litestream exige SQLite em WAL; roda como não-root — ver nota 61.
- Raiz limpa em 2026-11-11: pacotes `*.tar.gz` (agora no `.gitignore`), a pasta `UsersmlutePycharm...backend/` e os docs soltos de checklist/cronômetro/sync foram removidos ou movidos para `obsidian-generalmast/64-Anexos-Daily-Focus/`. **Não deixar docs/artefatos soltos na raiz**: documentação vai para o vault.
- Pacote/diretório antigo chamado `generalmast`; produto = TaskFlow.

## 7. Pendências conhecidas (NÃO corrigir sem pedido explícito)

### 7.1 Modos sem entrada em `SESSION_MAP` (não se sabe se é intencional)
Hoje `ModeSession.tsx` resolve `mode.session || mode.id`; sem entrada → **fallback `SpliteSession`** + `console.warn`. Levantamento (2026-11-11):

**A) Só fallback `SpliteSession` na aba Modos (sem helper no Daily Focus — `getHelper()` devolve `null`):**
| Categoria | Modos |
|---|---|
| Foco | `dead_deadline`, `papel_tela`, `estatua`, `em_pe`, `modo_serie`, `melhorar_taskflow`, `cold_turkey`*, `accountability`*, `aba_navegador_successao`, `aba_navegador_igualdade`, `aba_windows_successao`, `aba_windows_igualdade` |
| Memória | `anki_atividade`, `orbita_atividade`, `orbita_successao`, `orbita_igualdade`, `orbita_voz` |
| Ciclos | `modo_aleatorio` |
| Ritual | `morning_routine`*, `comer_algo`, `recompensa`*, `diario_celular`, `diario_pc`, `diario_mao`, `shot_dagua`, `comprar_bala`, `gratidao` |

\* referenciado em `data/presetCombos.ts` e/ou `components/daily-focus/stateToMode.ts` (combos/estados do check-in), mas continua sem sessão própria.

**B) Fallback `SpliteSession` na aba Modos + helper registrado no Daily Focus (`HELPER_REGISTRY`):**
`uma_coisa_5min`, `uma_coisa_15min` (`UmaCoisaHelper`), `cantar` (`CantarHelper`; as sessões de canto reais são `sing_one`/`sing_ten` → `SingSession`).

Obs.: vários ids de (A) aparecem em `HELPER_GROUPS` sem ter componente em `HELPER_REGISTRY`, ou seja, são oferecidos como "apoio" no Daily Focus mas `getHelper()` retorna `null`. O teste `modes.coverage.test.ts` não cobre esse caso. Nenhum desses modos tem teste próprio.

### 7.2 `base: "/taskflow/"` × domínio `kflow.mlutegar.com` — **ponto a verificar**
O que o repo mostra: `vite.config` usa `base: "/taskflow/"`; `frontend/nginx.conf` serve o build em `/taskflow/` (SPA fallback para `/taskflow/index.html`), redireciona `/` → `/taskflow/` (301) e faz proxy de `/api/` → `taskflow-api:3001`; compose expõe nginx em `127.0.0.1:3026` e a API em `127.0.0.1:3033`. Os hostnames públicos entram por **Cloudflare Tunnel**, configurado **fora do repo**: `deploy-vps.sh` cita `mlutegar.com` (túnel "emme") e `deploy-git.ps1`/nota 61 citam `taskflow.mrender.com.br` (túnel "iazan"). **`kflow.mlutegar.com` não aparece em nenhum arquivo do repo** (nem `CORS_ORIGIN` de exemplo, nem deploy). Logo, o mapeamento do domínio (hostname → porta 3026, e se mostra `/taskflow/` ou reescreve) está só na config do túnel/Cloudflare — confirmar lá. Também verificar se `CORS_ORIGIN` no `.env` do servidor inclui esse domínio.

### 7.3 Bugs conhecidos aguardando decisão (achados pelo `tsc`, prompt 01c)
- **Exportar tarefas anuais (.ics) está quebrado:** `lib/exportIcal.ts` usa `api.baseURL` (não existe → `undefined/ical/yearly`; o nginx devolve o `index.html` via SPA fallback e o app baixa um "`tarefas-anuais.ics`" com HTML). O correto seria `apiConnection()` de `lib/apiClient.ts` (`{baseUrl, token}`; o token também é lido da chave errada `"token"`). Botão em `TasksPage.tsx`.
- **"Métricas de Checklist" do celebrate nunca aparece:** em `DailyFocusPage.tsx` o bloco procura `tasks.find(t => t.id === t.supabaseId)`, mas `tasks` são os slots locais (sem `id`), então `checklist_count` é sempre 0 e o bloco retorna `null`. Para funcionar, precisa buscar `checklist_count`/`checklist_completed_count` das tarefas reais (backend já envia). O `checklistMetrics` no histórico foi removido (nunca era lido).

### 7.4 Convenções que evitam erro de tipo
- `showToast(msg)`, `showToast(msg, "error")`, `showToast(msg, "error", { durationMs })` ou `showToast(msg, { type, duration })`; tipos `info|success|error|warning`, default 3000 ms.
- `useTasks(filter, sort, …)` exige os 2 primeiros args (`useTasks(undefined, undefined)`) e devolve `{ tasks, … }` (não existe `data`).

### 7.5 Saúde (prompt 02) — em andamento
- Fases A (Remédios, nota 68), B (Skincare + lista de compras com seção "Remédios" de estoque ≤ `lowStockThreshold`, nota 69) e C (Alimentação: refeições + água sem calorias, e reposição rápida `POST /saude/medications/:id/restock`, nota 70) prontas. Falta D (Exercícios).
- Skincare: passos nunca são apagados (`active=false`), `productId` é SetNull, frequência por passo reaproveita `health/schedule.js`.
- Navegação: bottom nav = Tarefas · Hábitos · Foco · **Mais** (bottom sheet com todos os `NAV_ITEMS`; Finanças entra com 1 linha em `navItems.tsx`).
- API `/saude/*`: JWT obrigatório, camelCase, datas `YYYY-MM-DD`, horas `HH:MM`, zod em tudo. Nunca apagar horários/passos: usar `active=false`; intakes guardam snapshot de hora e dose. Lógica pura em `backend/src/health/` (reusa `recurrenceDays.js`, de onde `routines.js` importa `appliesToday`).
- **Pendência — Web Push:** os lembretes de remédio são só locais/best-effort (timers + Notification API, só com o app aberto, opt-in). Lembrete confiável com o app fechado exige VAPID + handler `push` no `sw.ts` + agendador no backend.
- Badge de pendências no item "Mais": adiado.

## 8. Backlog (funcionalidades que provavelmente ainda NÃO existem)
Verificado por busca no código em 2026-11-11 (nenhuma ocorrência de "adaptativ*"/"adaptive"):
- **Pomodoro adaptativo**: hoje só existe `sessions/PomodoroSession.tsx` + `PomodoroHelper` (ciclos fixos). Não há ajuste automático de duração por desempenho/energia/histórico.
- **Priorização semanal/mensal**: só existe a diária (5 "Tarefas de Hoje", `DailyTask`, `PrepareDayScreen`). Há apenas `WeeklyReview` (resumo semanal automático), `weeklyGoal` em preferências e `getWeeklyStats`/`WeekHeatmap` (métricas), sem planejamento/priorização de semana ou mês.
- Próximos prompts planejados (ver `PROMPTS.md`): 01 Novos modos · 02 Página de Saúde · 03 Página de Finanças.
