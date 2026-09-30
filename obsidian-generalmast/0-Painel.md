# 0 - Painel — generalmast

Vault de documentação do projeto **generalmast** (app de foco com "modos").

## Índice
- [[1-Tela-Escolher-Modo]] — o seletor de modos (`ModePicker`)
- [[2-Modos-e-Tipos]] — tipos, categorias e a fonte de dados dos modos
- [[3-Modos-Feitos-Hoje]] — como o app sabe o que foi feito hoje + funções de data
- [[4-Preencher-Modo-com-IA]] — botão que usa IA para preencher o modo no `CreateModeModal`
- [[5-Filtros-Ordenacao-Favoritos]] — filtros, ordenação persistida, favoritos e densidade no `ModePicker`
- [[6-Detalhes-do-Modo]] — segurar/botão-direito no card abre painel de detalhes
- [[7-Tarefas-Recorrentes]] — conclusão diária, reabertura automática e filtro Hoje
- [[48-Fix-Atividade-Continua-Sobreposicao-Mobile]] — fix/UX mobile: Atividade Contínua não fica mais atrás do FAB "Nova tarefa"
- [[8-Atualizacao-Imediata-de-Tarefas]] — renderização após criar, editar e alterar subtarefas
- [[9-Cache-Sync-e-Versionamento]] — Service Worker, updates otimistas com rollback e versão de tarefa (409)
- [[11-Projetos-e-Grupos]] — projetos hierárquicos, vínculo e filtros de tarefas
- [[10-Rolagem-da-Pagina]] — correção de roda, trackpad e gesto vertical na página inicial
- [[12-Troubleshooting-DB-Drift]] — erro `updated_at does not exist` e sincronização do banco
- [[13-Deploy-e-Build]] — build no Docker (multi-stage), versão visível, roteamento resiliente, cache, CI e o incidente `#/tasks` (404)
- [[14-Tempo-Estimado-e-Filtro]] — tempo estimado por tarefa, badge no card, filtro por faixa e sort
- [[15-Redesign-Card-Nova-Tarefa]] — redesign visual do card de criação de tarefa (`AddTaskForm`)
- [[16-Redesign-Form-Adicionar-Projeto]] — redesign do formulário de criar/editar projeto (`ProjectManager`)
- [[17-Criar-Projeto-Inline-na-Tarefa]] — botão ＋ Novo cria projeto direto do card de tarefa (`AddTaskForm`)
- [[18-Fix-Vencimento-Quebra-Tela]] — input de data nativo estourava a largura no iPhone (`AddTaskForm`)
- [[19-Ambiente-de-Dev]] — portas, scripts de dev, shutdown gracioso e troubleshooting de `EADDRINUSE`
- [[20-Modal-Detalhes-na-Rotina]] — clicar num item da Rotina Diária abre modal de detalhes/edição (`TaskDetailModal`)
- [[21-Resiliencia-e-Qualidade]] — regra dos hooks no lint, Error Boundary por painel, sourcemaps, smoke tests e rollback (pós React #310)
- [[22-Imagens-na-Descricao-da-Tarefa]] — upload de imagens na descrição (multipart no backend, markdown no front)
- [[23-Fix-Tarefas-Hoje-Fuso]] — painel "Tarefas de Hoje" perdia a tarefa focada no reload por bug de fuso (UTC vs local) em `api/dailyTasks.ts`
- [[24-Melhorias-Tarefas-Hoje]] — limite de 5 no backend (409), reorder por drag&drop, rollover de dia, toasts e teste de regressão de fuso
- [[25-Fix-Loading-Infinito-Primeiro-Acesso]] — skeleton eterno na aba Tarefas no 1º acesso: `refreshSession` sem timeout travava a query (fix + retry/backoff)
- [[26-Modo-Minimizavel-Card-Flutuante]] — sessão de modo elevada a provider global; botão minimizar → card flutuante persistente que sobrevive à navegação (`ActiveModeContext`, `FloatingModeCard`)
- [[27-Redesign-Bottom-Nav-Mobile]] — redesign do menu inferior mobile: pill de ativo com glow, barra com blur, micro-interações e acessibilidade (`Sidebar.module.css`)
- [[28-Recomendacao-Autodesenvolvimento-Daily-Focus]] — dica leve na 1ª tela do Daily Focus sugerindo começar por uma tarefa de autodesenvolvimento (ganho composto de 1%/dia)
- [[29-Atividade-Continua-Daily-Focus]] — atividade de fundo do dia (ex.: Anki) sem timer e fora da sequência: presets, meta, streak, "repetir de ontem", chip que revela na pausa, contador de avanços e sync cross-device (`continuousActivity.ts`, `DailyFocusPage`)
- [[30-Minha-Sessao-no-Daily-Focus]] — ao pausar uma tarefa, a área de pausa passa a reaproveitar a "Minha Sessão" (`SlotBoard` + `activateMultiCard`) em vez da lógica isolada de módulo de apoio/entre tarefas
- [[33-PWA-Update-e-Deploy]] — banner "Nova versão disponível" (registerType prompt + `UpdatePrompt`), ícones SVG inline, atalho M/dica no multi-card e `deploy-vps.sh` idempotente
- [[31-Preparacao-Priorizacao-Daily-Focus]] — nova fase `prepare` liga Daily Focus às "Tarefas de Hoje": escolher as 5 prioridades (mesma fonte `DailyTask`), criar/editar/detalhar tarefas no fluxo e pré-preencher/destacar os slots do `select` (`PrepareDayScreen`)
- [[32-Redesign-Tela-Perfil]] — redesign da tela de Perfil e troca dos emojis por ícones `lucide-react` (`ProfilePage.tsx`)
- [[34-Card-Persistente-Daily-Focus]] — Daily Focus vira camada persistente: card flutuante com tarefa/tempo/estado (Em foco·Pausado), pausar/continuar e voltar à tela cheia; snapshot ancorado em timestamp sobrevive à navegação (`dailyFocusLive.ts`, `DailyFocusFloatingCard`)
- [[35-Rotina-Diaria-na-Pagina-Rotinas]] — painel "🔁 Rotina Diária" (tarefas recorrentes do dia) passa a aparecer também no topo de `#/routines`, reaproveitando `DailyRoutinePanel` + `useTasks` (`RoutinesPage.tsx`)
- [[36-Captura-Rapida-Global-de-Tarefas]] — botão flutuante "+ Nova tarefa" em todas as páginas abre modal de cadastro rápido (título, data, prioridade, descrição, subtarefas) sem sair da página atual (`QuickTaskContext`, `QuickTaskButton`, `AddTaskForm` com `enableChecklist`)
- [[37-Redesign-Icons-Tela-Tarefas]] — troca dos emojis da tela de Tarefas por ícones `lucide-react` (cabeçalho, "Rotina Diária" e "Hoje & Atrasadas"), com alinhamento e cor de tema (`TasksPage.tsx`, `DailyRoutinePanel.tsx`, `DueTodayPanel.tsx`)
- [[38-Fluxo-Direto-e-Checkpoint-Emocional]] — Daily Focus começa direto na escolha das 5 tarefas (remove a tela de recomendação `CheckInScreen`) e ganha um **checkpoint emocional** rápido/opcional a cada Play/retomada do timer ("Como você está se sentindo agora?"), gravando emoção+momento local e no backend (`emotionLog.ts`, `EmotionCheckModal`, `daily_focus_emotions`). **v2**: atalhos 1–7, memória da última emoção, auto-dismiss, cooldown anti-fadiga, intensidade opcional, momento `end` (fim de tarefa) com contexto de sessão (modo/nível/pausa/resultado), resumo no celebrate, heatmap por hora no histórico e conquista "Sintonia Emocional"
- [[39-Tempo-Modo-Sincronizado-Daily-Focus]] — modos de auxílio abrem **já minimizados** (card compacto) e o tempo do modo passa a ser o **tempo de foco efetivo**: só acumula com o Daily Focus rodando, congela na pausa e retoma junto — métrica comparável de eficiência por modo (`modeFocusTimer.ts`, `ActiveModeContext`, `FloatingModeCard`, `MultiCardSession`, `sessionUsageLog`)
- [[40-Melhorias-Captura-Rapida]] — evolução da captura rápida: toast+**Desfazer**, atalho **Ctrl/⌘+K**, **"Criar e adicionar outra"**, **linguagem natural** no título (data/hora/prioridade), projeto do contexto, **Adicionar a Hoje**, rascunho persistente, painel lateral no desktop e focus trap (`quickTaskParse.ts`, `QuickTaskButton`, `AddTaskForm`, `Toast`, `ModalOverlay`)
- [[41-Metricas-Ricas-e-Robustez-Tempo-Modo]] — evolução da nota 39: acumulador de foco robusto (heartbeat + descarte de background/reload) e **métricas ricas** por sessão (pausas, tempo pausado, **fragmentação**/blocos, tarefas concluídas), pré-preenchimento do foco medido no pós-sessão, `getFocusQualityByMode` e testes unitários (`modeFocusTimer.ts`, `sessionUsageLog.ts`, `session_usage_logs`)
- [[42-Melhorias-Habitos-e-Recorrencia]] — aba "Rotinas" renomeada para **Hábitos**; painel Rotina Diária ganha modal de detalhes + toast de conclusão em `#/routines`; recorrência opcional de hábitos (schema+migração+`appliesToday`, seletor no form, badge no card), filtro "Hoje"/`?filter=today` e testes de `dailyRoutine` (`RoutinesPage.tsx`, `AddRoutineForm.tsx`, `RoutineCard.tsx`, `routines.js`)
- [[43-Concluir-Trocar-Atividade-Continua]] — permite **concluir** (`✓`) e **trocar** (`↻`) a atividade contínua **durante** o Daily Mode, sem finalizar a sessão nem interferir na tarefa/timer da rodada; conclusões vão para um log do dia e o picker de presets reaparece inline (`continuousActivity.ts` `completeContinuousActivity`/`getCompletedToday`, `DailyFocusPage`)
- [[44-Card-Orbita-por-Voz]] — novo card de apoio **Órbita por Voz** (`orbita_voz`), variação dos cards Órbita focada em dar comandos de voz ao assistente durante a atividade (`frontend/src/data/modes.ts`: `MODES`, `HELPER_GROUPS`, `CATEGORY_BY_ID`)
- [[45-Sessao-Ativa-Sincronizada-Daily-Focus]] — a **sessão de foco em andamento** (cronômetro/`remainingSecs`, fase, tarefa, `modeFocusTimer`) passa a **sincronizar entre dispositivos**: novo model `DailyFocusActiveSession` + rotas `GET/PUT/DELETE /daily-focus/active-session`, push debounced no `saveDailyFocusLive`, restore via `loadRemoteActiveSession` no `useRemoteSync` e reidratação por `DAILY_FOCUS_LIVE_EVENT` na página (`dailyFocusLive.ts`, `api/dailyFocusActiveSession.ts`, `DailyFocusPage.tsx`, `backend/src/routes/dailyFocus.js`)

- [[46-Integracao-TaskFlow-Orbita]] — associar **projetos do Órbita** (Claude Web) a uma tarefa e, com um botão, **abrir uma aba no Claude com o prompt já enviado**; backend Fastify atua como proxy (`/orbita/projects`, `/orbita/launch`), campos `orbita_projects`/`orbita_prompt` na Task, `OrbitaLauncher` no `TaskDetailModal` e deep-link `?key=` no frontend do Órbita (`orbita.js`, `orbita.ts`, `orbitaPrompt.ts`, `OrbitaLauncher.tsx`, `App.jsx`)
- [[47-Fix-Encerrar-pelo-Card-Registra-Sessao]] — **fix + melhorias:** encerrar pelo **card minimizado** ("MODO ATIVO") não salvava para análise. Corrigido (expande/registra via `autoEnd`/`endSignal`) e evoluído: **registro rápido inline 👍/👎** (`logQuickUsage`), **Pular** agora persiste registro mínimo, **Descartar vs Detalhar**, preview do foco no card, toast de confirmação, nudge de sessão órfã (>6h) e testes (`FloatingModeCard.test.tsx`) — `ActiveModeContext`, `FloatingModeCard`, `sessionUsageLog`, `PostSessionForm`
- [[51-Unificacao-Modos-e-Uso]] — abas "Modos" e "Uso" do Histórico unificadas numa só; logs fundidos em `session_usage_logs` (fonte única), `usageStats` derivado dela e remoção de `modeLog`/`/mode-log`
- [[52-Botao-Apagar-Historico]] — botão **🗑 Apagar histórico** por aba (Sessões/Uso/Check-ins); apaga local (`clear*`) + banco (novos `DELETE`) com `confirm()` e `invalidateQueries`

## Feature recente
**Apagar histórico por aba**: a tela **Histórico** ganhou um botão **🗑 Apagar histórico**
em cada aba (Sessões, Uso, Check-ins). Ele limpa tanto o `localStorage` quanto o banco
(novos endpoints `DELETE`), com confirmação antes. Útil quando os registros foram gravados
errado. Ver [[52-Botao-Apagar-Historico]].

**Integração TaskFlow ↔ Órbita (Claude Web)**: criei tarefas com checklist e associo os
**projetos do Órbita**; um botão abre a aba no Claude naquele projeto e **envia o prompt
automaticamente** (montado da tarefa, editável). O backend do TaskFlow faz proxy para o
Órbita local (evita CORS, guarda o token). Ver [[46-Integracao-TaskFlow-Orbita]].

**Sessão ativa sincronizada entre dispositivos**: comecei o Daily Focus no PC (nível +
cronômetro) e, ao abrir no celular com a mesma conta, a **sessão em andamento** agora é
reidratada — o cronômetro continua de onde parou (âncora temporal), com fase, tarefa e
tempo de foco preservados. Backend guarda a sessão ativa (LWW por usuário) e o front
reidrata no login. Ver [[45-Sessao-Ativa-Sincronizada-Daily-Focus]].

**Métricas ricas e robustez do tempo de foco por modo**: o acumulador virou à prova de
background/reload (heartbeat + grace) e passou a registrar **pausas, tempo pausado,
fragmentação (blocos) e tarefas concluídas** por sessão — com o pós-sessão já
pré-preenchendo o foco medido. Ver [[41-Metricas-Ricas-e-Robustez-Tempo-Modo]].

**Melhorias na captura rápida**: toast de sucesso com **Desfazer**, atalho **Ctrl/⌘+K**,
botão **"Criar e adicionar outra"**, **linguagem natural** no título (ex.: "amanhã 14h
!alta"), pré-seleção de projeto pelo contexto, **Adicionar às Tarefas de Hoje**, rascunho
persistente, **painel lateral** no desktop e focus trap nos modais. Ver
[[40-Melhorias-Captura-Rapida]].

**Tempo do modo sincronizado com o Daily Focus**: modos de auxílio agora abrem **já
minimizados** e o tempo de uso vira **tempo de foco efetivo** — só conta com o Daily
Focus rodando, congela na pausa e retoma junto (ex.: 25 + 10 pausa + 20 = 45 min, não
55). Métrica comparável de eficiência por modo. Ver
[[39-Tempo-Modo-Sincronizado-Daily-Focus]].

**Captura rápida global de tarefas**: botão flutuante **"+ Nova tarefa"** (atalho **N**)
presente em toda a plataforma abre um modal de cadastro rápido sobre a página atual —
lembrei → clico → cadastro → salvo → continuo. Ver [[36-Captura-Rapida-Global-de-Tarefas]].

Painéis rápidos na aba Tarefas: **🔁 Rotina Diária** (recorrências diárias) e
**📅 Hoje & Atrasadas** (tarefas com prazo hoje/vencido + sinal de "sem prazo");
o painel de foco das 5 tarefas passou a iniciar **minimizado**.
Ver [[7-Tarefas-Recorrentes]].

Melhoria na tela **Escolher modo** ([[1-Tela-Escolher-Modo]]):
1. Banner explícito "Hoje (DD/MM) você já realizou: …" → ver [[3-Modos-Feitos-Hoje]]
2. Chips de tipo/categoria em cada card → ver [[2-Modos-e-Tipos]]
3. **Ocultar/reexibir modos** que o usuário não usa (ex.: `splite`) → ver [[1-Tela-Escolher-Modo]]

No **Histórico**, o filtro por modo das abas Modos/Uso virou um **dropdown agrupado por
categoria** (antes eram ~70 chips que poluíam a tela) → ver [[49-Simplificar-Filtro-Modos-Historico]].

**Fix: histórico de sessões não salvava (~1 mês perdido)**: o salvamento era
fire-and-forget sem retry — sessões concluídas offline/com falha nunca chegavam ao backend
e sumiam ao trocar de dispositivo. Adicionada **fila de reenvio (outbox)** com flag
`synced`, flush no boot e no evento `online`, e `fetchSessions()` **paginado** para trazer
todo o histórico. **v2 (robustez):** idempotência via `clientId`+**upsert** (sem duplicatas),
backoff exponencial com distinção erro transitório/permanente, guard de concorrência, flush
também em `visibilitychange`/periódico, banner "N aguardando sincronização" + **"Tentar
agora"** e testes. Ver [[50-Fix-Sincronizacao-Historico-Sessoes]].

**Unificação de "Modos" e "Uso"**: as duas abas quase idênticas do Histórico viraram **uma
só** (Uso, a versão rica) e os logs foram fundidos — `session_usage_logs` é a **fonte única de
verdade** e o ranking "mais usados" (`usageStats`) passou a derivar dela (soma de
`tasksCompleted`). Removidos `modeLog`/`/mode-log`. Ver [[51-Unificacao-Modos-e-Uso]].
