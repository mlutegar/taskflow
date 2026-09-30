# 34 - Card Persistente do Daily Focus (camada always-on-screen)

> Ver também: [[0-Painel]] · [[26-Modo-Minimizavel-Card-Flutuante]] · [[30-Minha-Sessao-no-Daily-Focus]] · [[29-Atividade-Continua-Daily-Focus]]

## Motivação
O **Daily Focus** (`#/daily-focus`) era uma **página isolada**: todo o estado da sessão
(timer, tarefa atual, fase, foco/pausa) vivia dentro de `DailyFocusPage.tsx`. Como o
roteamento é por hash, navegar para Tarefas / Módulos / Análises **desmontava** a página
e o usuário perdia a referência da sessão.

Objetivo: transformar o Daily Focus numa **camada persistente**. Ao sair da página, a
sessão continua visível num **card flutuante compacto** sobre qualquer tela, mostrando:
tarefa atual, tempo, estado (**Em foco** / **Pausado**), controle rápido pausar/continuar
e um botão para voltar à tela cheia. Pausa automática ao sair é aceitável; retomar pelo
card faz o timer seguir rodando **em background**.

Reaproveita o padrão que já existia para sessões de Modo ([[26-Modo-Minimizavel-Card-Flutuante]]):
`createPortal` num provider acima do roteador + cronômetro ancorado em timestamp.

## Arquitetura: snapshot "live" ancorado em timestamp
Fonte de verdade compartilhada entre a página e o card = um snapshot leve no
`localStorage` (`taskflow.dailyFocus.live`). O tempo é uma **âncora temporal**:
`remainingSecs` é o restante capturado em `anchorTs`. Assim o card calcula o tempo ao
vivo sem "possuir" o interval, e a página rehidrata o mesmo valor ao voltar, descontando
o tempo decorrido em background.

`liveRemaining(snap)` = `running ? remainingSecs - (now - anchorTs)/1000 : remainingSecs`
(nunca abaixo de 0; `null` em rush/tab, que não têm contagem regressiva → mostram decorrido).

## Arquivos
- `frontend/src/lib/dailyFocusLive.ts` **(novo)** — tipo `DailyFocusLive`,
  `load/save/clear`, `liveRemaining()` e o evento `DAILY_FOCUS_LIVE_EVENT`.
- `frontend/src/lib/storageKeys.ts` — nova chave `DAILY_FOCUS_LIVE: "dailyFocus.live"`.
- `frontend/src/components/daily-focus/DailyFocusFloatingCard.tsx` **(novo)** — card
  flutuante (arrastável, portal), cronômetro de 1s quando rodando, botões pausar/continuar
  e tela cheia. Lê o snapshot no mount e reage a `DAILY_FOCUS_LIVE_EVENT` + `storage`.
- `frontend/src/components/daily-focus/DailyFocusFloatingCard.module.css` **(novo)** —
  estilo derivado do `FloatingModeCard` (posicionado à **esquerda** p/ não sobrepor o
  card de Modo, que fica à direita).
- `frontend/src/components/daily-focus/DailyFocusPage.tsx` — produtor do snapshot,
  rehidratação e auto-pausa.
- `frontend/src/main.tsx` — monta `<DailyFocusFloatingCard/>` no `Root`, condicionado a
  `hash !== "#/daily-focus"` (não aparece sobre a própria tela cheia).

## Comportamento (fluxo)
1. Página `DailyFocusPage` grava o snapshot num `useEffect` sempre que muda fase, tarefa,
   `timerRunning`, `timerRemaining`, rush/tab. Só existe em fases com timer
   (`work`/`between`); nas demais o snapshot é **limpo** e o card some.
2. **Auto-pausa ao sair:** o cleanup de unmount da página congela o restante e grava
   `running: false`. → "pausar automaticamente ao sair da página principal".
3. **Card:** mostra tarefa/tempo/estado; **Continuar** re-ancora (`anchorTs = agora`) e o
   timer segue contando em background; **Pausar** congela; **⤢** volta à tela cheia
   (`hash = "/daily-focus"`).
4. **Voltar:** `DailyFocusPage` lê o snapshot no mount (`liveInit`) e, se estava rodando,
   inicia `timerRemaining` já com `liveRemaining()` e `timerRunning = true`.
5. Fim/reset da sessão: fase deixa de ser work/between → `clearDailyFocusLive()`.

## Decisão de escopo
Se o tempo chega a 00:00 estando em outra página, o card apenas sinaliza **"Tempo
concluído"**. O fluxo real de avanço/conclusão de tarefa continua acontecendo na página
ao retornar — não foi replicada essa lógica complexa globalmente.

## Melhorias implementadas (v2)
Sobre a base acima, o card ganhou:
1. **Conclusão em background** — quando o countdown zera com o timer rodando em outra
   página, dispara `playTimerDone()` + `showNotification()` (uma vez por âncora, via
   `completedFiredRef`). Reaproveita `lib/sounds` e `lib/notifications`.
2. **Throttle da escrita** — o efeito produtor não depende mais de `timerRemaining`
   (evita gravar no `localStorage` a cada 1s). O restante é lido de `timerRemainingRef`
   no momento da gravação; o card recalcula o tempo pela âncora.
3. **Anel de progresso** — `conic-gradient` com `--p` (0..1) = `1 - secs/totalSecs`.
4. **Alerta de pausa longa** — pausado ≥ 10 min → borda de aviso + faixa
   "⚠ Pausado há N min" (usa `anchorTs` do momento da pausa).
5. **Encerrar pelo card** — botão com confirmação em 2 passos → `endDailyFocusSession()`
   (limpa o snapshot live **e** `taskflow_sess_daily_focus`, sem tocar no nível/dia).
6. **Painel expandido** — clique no card alterna um painel com "Próxima" tarefa, "Abrir
   tela cheia", "Resetar posição" e "Encerrar" (o ⤢ continua indo direto p/ tela cheia).
7. **Rush/Tab informativos** — tab mostra "N ciclos"; rush mostra "⚡ tempo"; countdown
   mostra o anel + `mm:ss`. Rótulo "Tarefa i/N" quando há mais de uma.
8. **Acessibilidade** — `aria-live="polite"` no tempo/estado; `role="group"`/`role="status"`.
9. **Empilhamento mobile** — no mobile o card sobe para `bottom: 140px` para não
   sobrepor o `FloatingModeCard` (que fica em `bottom: 76px`).

Campos extras no snapshot (`DailyFocusLive`): `tabMode`, `cycleCount`, `nextTaskTitle`,
`taskIndex`, `taskCount`.

## Verificação manual
1. `cd frontend && npm run dev`.
2. Iniciar tarefa com timer → navegar p/ Tarefas: card aparece "Pausado" com tempo congelado.
3. **Continuar** no card → tempo decrementa; trocar de página e conferir persistência.
4. **⤢ / clique** → volta à tela cheia refletindo o tempo decorrido em background.
5. Encerrar/reset → snapshot limpo, card some em todas as páginas.
6. F5 fora do Daily Focus com sessão ativa → card rehidrata do `localStorage`.
