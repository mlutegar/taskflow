# 29 - Atividade Contínua (Daily Focus)

Voltar ao [[0-Painel]]

## O que é
Uma **atividade de fundo do dia** no Daily Focus — algo como *revisar flashcards no
Anki* — que roda em paralelo à sequência de tarefas **sem competir** com o foco atual.

Características:
- **Não tem temporizador** próprio (não concorre com o timer da tarefa principal).
- **Não conta** como uma das tarefas da sequência (não altera `level` nem a
  progressão de tempo `(level - i) * 15`).
- Fica disponível **o dia inteiro** (persiste por dia; reseta à meia-noite).
- É pensada para tarefas **curtas e fragmentadas** e funciona no **celular**
  (título + link opcional).

A ideia é aproveitar os micro-momentos ociosos — timer pausado, esperando algo,
longe do PC, transporte, celular — sem incentivar multitarefa: durante o foco existe
**uma única tarefa principal**; a atividade contínua só é destacada nas pausas.

Também resolve melhor o **autodesenvolvimento** (ver [[28-Recomendacao-Autodesenvolvimento-Daily-Focus]]):
em dias com uma prioridade urgente (ex.: estudar para prova), o autodesenvolvimento
pode ser a atividade contínua e acontecer aos poucos, em vez de ocupar a Tarefa 1.

## Modelo de dados (`ContinuousActivity`)
`title`, `link`, `note`, `icon`, `goalTarget` (meta opcional), `goalUnit`,
`ticks` (nº de acessos/avanços hoje) e `progress` (progresso manual até a meta).

## Como funciona
1. **Fase `select`**:
   - **Presets rápidos** (🃏 Anki, 📖 artigo, 🦉 idioma, 🎧 podcast, 📚 livro) que
     já preenchem ícone/unidade.
   - Botão **"↩ Repetir de ontem"** que recupera a última configuração
     (a maioria das atividades é recorrente).
   - Campo de título + link opcional + **meta opcional** (`🎯 20 cards`).
   - **Streak** "🔥 N dias" de dias seguidos com atividade contínua.
2. **Fase `work`**: **chip flutuante minimizável** (canto inferior direito),
   sempre visível mas discreto, **sem timer**.
   - Auto-**minimiza no foco profundo** (timer rodando) e **revela na pausa** —
     `useEffect([timerRunning, phase])`.
   - `↗` abre o link e **conta um avanço** (`registerTick`); `⧉` **copia o link**
     (útil pra abrir no celular); `+1`/`−` ajustam o **progresso** da meta.
   - A bolinha minimizada mostra um **badge** com o nº de acessos do dia.
   - **Concluir/Trocar durante a sessão** (ver [[43-Concluir-Trocar-Atividade-Continua]]):
     no chip expandido, `✓` **conclui** a atividade atual (registra no log do dia
     e mantém o streak) e abre um **picker inline** para escolher outra; `↻`
     apenas **troca** sem concluir. Tudo isso **sem** interferir na tarefa/timer
     em andamento — o estado da atividade contínua é independente de
     `tasks`/`currentIdx`/`timerRemaining`.
3. **Pausas**: CTA quando o timer está pausado (`!timerRunning`) e na tela
   `between`, mostrando `Nx hoje` ou `progresso/meta`. Se a atividade parece
   autodesenvolvimento, o texto vira *"🌱 Seu 1% de hoje mora aqui"*.
4. **Celebração**: linha de resumo "Você avançou <atividade> Nx hoje 👏".

## Persistência
- **Por dia** em `localStorage`, chave `taskflow.dailyFocus.continuousActivity`
  (com `date` via `todayISO()`; ver [[23-Fix-Tarefas-Hoje-Fuso]]).
- `…continuousActivity.last` — última config (sem expirar) → "repetir de ontem".
- `…continuousActivity.history` — dias com atividade → cálculo do streak.
- **Cross-device**: coluna `continuous_activity` (JSON) em `daily_focus_day_state`,
  gravada/lida pelos endpoints `PUT/GET /daily-focus/day-state` (atualização
  **parcial** — só toca nos campos presentes no body). Sync fire-and-forget e
  merge no boot via `loadRemoteContinuousActivity` (registrado em `useRemoteSync`).
  Migration: `20260928000000_add_daily_focus_continuous_activity`.
- **Não** entra no `useSessionPersist` (é por dia, não por sessão).

## Distinção dos "modos"
Não confundir com os modos ligados a tarefas:
- `helperModeIds` = modos **"durante"** a tarefa;
- `interModeIds` = modos **"entre"** tarefas;
- **Atividade contínua** = entidade nova, do **dia**, independente de qualquer
  tarefa e sem timer.

## Arquivos
- `frontend/src/lib/continuousActivity.ts` — estado por dia, ticks, meta,
  streak, presets, "repetir", e `loadRemoteContinuousActivity`.
- `frontend/src/api/dailyFocusDayState.ts` — `upsertContinuousActivity`,
  `fetchTodayState` (agora tipado `RemoteDayState`).
- `frontend/src/hooks/useRemoteSync.ts` — loader `continuousActivity`.
- `frontend/src/components/daily-focus/DailyFocusPage.tsx` — estado, callbacks
  (`registerTick`/`addProgress`/`copy`), presets/meta na `select`, chip na `work`,
  CTAs nas pausas/`between`, resumo na `celebrate`.
- `frontend/src/components/daily-focus/DailyFocus.module.css` — `.contActField*`,
  `.contActChip*`, `.contActPauseCta*`, `.contActPreset*`, `.contActGoal*`,
  `.contActStreak`, `.contActCelebrate`.
- `backend/prisma/schema.prisma` + migration + `backend/src/routes/dailyFocus.js`.

## Verificação
1. `npm run db:deploy` no backend (aplica a migration) e rodar o app
   (ver [[19-Ambiente-de-Dev]]).
2. Fase `select`: escolher um preset ou "repetir de ontem", definir meta →
   iniciar sessão e confirmar que `level`/progressão NÃO muda.
3. Fase `work`: com timer rodando o chip fica minimizado; ao pausar ele revela.
   Abrir o link incrementa o contador; `⧉` copia; `+`/`−` mexem no progresso.
4. Pausar (Espaço) → CTA aparece com "Nx hoje" / progresso.
5. Concluir tarefa com modo "entre" → CTA na tela `between`.
6. Concluir a sessão → resumo na `celebrate`.
7. Recarregar no mesmo dia → persiste; virar o dia → reseta e a config vira
   sugestão de "repetir de ontem". Streak sobe a cada dia com atividade.
8. Cross-device: `GET /daily-focus/day-state` retorna `continuousActivity`.

Relacionado a [[28-Recomendacao-Autodesenvolvimento-Daily-Focus]],
[[26-Modo-Minimizavel-Card-Flutuante]] (padrão do card flutuante) e
[[3-Modos-Feitos-Hoje]] (estado por dia).
