# 38 - Fluxo Direto + Checkpoint Emocional no Play (Daily Focus)

> Ver também: [[0-Painel]] · [[31-Preparacao-Priorizacao-Daily-Focus]] · [[34-Card-Persistente-Daily-Focus]] · [[30-Minha-Sessao-no-Daily-Focus]]

## Motivação
Ao entrar no **Daily Focus**, a primeira tela era o `CheckInScreen` ("Como você está
agora?"), que perguntava o estado emocional e **recomendava um modo de foco**. Essa etapa
de recomendação deixou de fazer sentido por ora. O fluxo desejado ficou mais direto:

1. Escolher as **5 tarefas** mais importantes do dia (`PrepareDayScreen`, fase `prepare`)
2. Entrar na **tela principal** (fase `select` → `work`)
3. Escolher a tarefa e **iniciar o timer**

No lugar da recomendação, entra um **checkpoint emocional**: toda vez que o usuário clica
em **Play** (iniciar ou retomar), aparece um modal rápido **"Como você está se sentindo
agora?"** com opções visuais e um **Pular**. É **leve, opcional e não bloqueante** — o
timer inicia junto e a plataforma **não interpreta nem recomenda** nada por enquanto. O
objetivo é apenas **coletar o dado** para, no futuro, cruzar emoção × pausas × foco ×
produtividade.

## Parte A — Fluxo direto (remover a tela de recomendação)
`frontend/src/components/daily-focus/DailyFocusPage.tsx`:
- Fase inicial passou de `"checkin"` → **`"prepare"`** (default do `useState`).
- `handleNextLevel()` também passou a ir para `"prepare"` (subir de nível pula o check-in).
- O bloco de render de `CheckInScreen` foi mantido no código (reversível), mas `phase`
  nunca mais assume `"checkin"`, então a tela não aparece. `handleCheckinSelect` e a
  lógica de estados/combos permanecem sem uso, prontos para reativação futura.

Novo fluxo de fases: `prepare` → `select` → `work` → `celebrate`.

## Parte B — Checkpoint emocional a cada Play / Retomar
Modelo mental: **checkpoint**, não questionário. 1 clique registra e fecha.

- `frontend/src/data/emotions.ts` **(novo)** — catálogo `EMOTIONS` (emoji + label):
  tranquilo, focado, animado, cansado, ansioso, estressado, desmotivado.
- `frontend/src/lib/emotionLog.ts` **(novo)** — `logEmotion({emotion, moment, taskTitle,
  taskIndex})` grava em `localStorage` (`taskflow.emotionLog`, máx. 500) e sincroniza com
  o backend (fire-and-forget). `moment` = `"start"` | `"resume"`. Também `getEmotionLog()`
  e `loadRemoteEmotions()` (merge no boot, dedup por `timestamp|emotion|moment`).
- `frontend/src/api/dailyFocusEmotions.ts` **(novo)** — `saveEmotion()` / `fetchEmotions()`,
  espelhando `api/dailyFocusCheckins.ts`.
- `frontend/src/components/daily-focus/components/EmotionCheckModal.tsx` **(novo)** +
  `.module.css` — modal via `shared/ModalOverlay` (fecha no ESC / clique fora), grid de
  botões visuais e um **Pular** discreto.
- `frontend/src/lib/storageKeys.ts` — nova chave `EMOTION_LOG: "emotionLog"`.
- `frontend/src/hooks/useRemoteSync.ts` — novo loader `emotions` (`loadRemoteEmotions`).

### Integração no timer (`DailyFocusPage.tsx`)
- Estado `emotionModal: null | "start" | "resume"`.
- Helper `requestStart(moment)`: `setTimerRunning(true)` + `setLongPause(false)` + abre o
  modal (**não bloqueia** — o timer já começa a correr).
- Pontos que passaram a chamar `requestStart`:
  - Botão principal **▶ Iniciar** (quando parado; ao **Pausar** apenas pausa, sem modal).
  - Botão **▶ Retomar tarefa** no painel de pausa entre-tarefas → `requestStart("resume")`.
  - Atalho **Espaço**: ativa → `requestStart(...)`; pausa → só pausa.
- `moment` = `"start"` quando `timerRemaining === totalSecs` (início do zero), senão
  `"resume"`. O modal **reaparece a cada Play** (sem flag de "só uma vez"), pois o estado
  emocional muda ao longo do dia.

## Backend
`backend/prisma/schema.prisma` — novo model **`DailyFocusEmotion`** (`daily_focus_emotions`):
`id, userId, emotion, moment, date, hour, taskTitle?, taskIndex?, createdAt`, índice
`(userId, date)`. Migração: `20260929000000_add_daily_focus_emotions`.

`backend/src/routes/dailyFocus.js` — novas rotas espelhando `/checkins`:
- `POST /daily-focus/emotions` (valida `emotion`, `moment∈{start,resume}`, `date`, `hour`).
- `GET /daily-focus/emotions` → lista `{ emotion, moment, date, hour, timestamp, taskTitle?, taskIndex? }`.

## Melhorias implementadas (v2)
Sobre a base acima, o checkpoint ganhou:

**UX do modal** (`EmotionCheckModal.tsx`)
- **Atalhos 1–7** selecionam a emoção; **Esc/Pular** fecham; foco inicial no 1º botão (a11y).
- **Memória**: realça a **última emoção** usada (`getLastEmotionId`, chave `emotionLastId`).
- **Auto-dismiss** (~12s) como "Pular" implícito — nunca dá sensação de bloqueio.
- **Passo opcional de intensidade** (Leve/Forte) após escolher, com micro-confirmação (✓).
- Título contextual por momento (início / retomada / fim).

**Anti-fadiga** (`DailyFocusPage.tsx`)
- **Cooldown de 2 min** (`EMOTION_COOLDOWN_MS`, `lastEmotionTsRef`): Play→Pause→Play em
  segundos **não** reabre o modal (evita viés de "Pular" no automático). O fim de tarefa
  ignora o cooldown.

**Dado mais rico** (`emotionLog.ts` + tipo `SessionEmotion` em `types/index.ts`)
- Novo momento **`end`**: ao concluir a tarefa (`handleCompleteTask`), pergunta como
  terminou — permite comparar início×fim.
- **Contexto de sessão** anexado a cada registro: `taskId`, `modeIds`, `level`, `rushMode`,
  `tabMode`, `pauseSecs` (duração da pausa anterior), e no `end`: `completed`, `usedSecs`,
  `totalSecs`. É o elo emoção→modo→resultado.
- **Emoções configuráveis**: `getEmotions()` aceita override via `taskflow.emotionsCustom`.

**Retorno de valor**
- **Resumo no `celebrate`**: linha "Hoje você registrou: 😌 Tranquilo · 🎯 Focado ×2 …".
- **Heatmap no `HistoryPanel`**: seção "💗 Emoção ao longo do dia" — ranking compacto +
  grade por hora (cor = emoção dominante, opacidade = volume). Emoções entram no export JSON.
- **Conquista** `emotion_aware` ("Sintonia Emocional") ao atingir 10 checkpoints
  (`dailyFocusAchievements.ts`, desbloqueio em `completeSession`).

**Backend / robustez**
- Colunas novas em `daily_focus_emotions` (migração `20260929010000_expand_daily_focus_emotions`):
  `intensity, timestamp, task_id, mode_ids, level, rush_mode, tab_mode, pause_secs,
  completed, used_secs, total_secs`.
- `POST /daily-focus/emotions`: valida `moment∈{start,resume,end}` e `intensity∈{leve,forte}`;
  **dedup idempotente** por `(userId, timestamp, moment)` para tolerar reenvios/spam de Play.

## Usos futuros do dado (não implementados agora)
Identificar padrões emocionais ao longo do dia · relacionar emoção com pausas/interrupções
· entender quais estados favorecem/prejudicam o foco · comparar emoção no início e no fim
da sessão · análises pessoais de produtividade · recomendações com IA baseadas no próprio
histórico.

## Verificação manual
1. `cd frontend && npm run dev`.
2. Abrir Daily Focus → 1ª tela é a de **escolher 5 tarefas** (sem "Como você está agora?").
3. Entrar na tela principal, escolher tarefa, **Play** → modal do checkpoint aparece e o
   timer inicia. Selecionar emoção → conferir `localStorage["taskflow.emotionLog"]`
   (`moment:"start"`).
4. Pausar e **Play** de novo → modal reaparece (`moment:"resume"`).
5. **Pular** → nada é gravado, timer segue.
6. Subir de nível → volta para a tela de tarefas, sem o check-in.
7. Backend: `POST /daily-focus/emotions` grava e `GET` retorna (migração já aplicada).
