# 31 - Etapa de Preparação e Priorização do Dia (Daily Focus)

Ligação entre o **Daily Focus** e as **Tarefas de Hoje** da página inicial:
antes de escolher as tarefas da sessão, o usuário passa por uma etapa de
**preparação** que pergunta *"Quais são as cinco tarefas mais importantes de
hoje?"* — usando a **mesma lista e os mesmos dados** da home (sem lista paralela).

Relacionado: [[24-Melhorias-Tarefas-Hoje]], [[28-Recomendacao-Autodesenvolvimento-Daily-Focus]], [[29-Atividade-Continua-Daily-Focus]], [[23-Fix-Tarefas-Hoje-Fuso]].

## Problema / Motivação
- O Daily Focus era isolado: no `select` o usuário preenchia N slots buscando
  tarefas soltas por texto, sem relação com as 5 prioridades já definidas na home.
- A home já tinha a lógica das 5 prioridades (tabela `DailyTask` via `dailyTasksApi`).
- Objetivo: **Lista geral → 5 prioridades do dia → seleção do Daily Focus → execução**,
  e permitir criar/editar/detalhar tarefas sem sair do fluxo.

## Fluxo (fases)
`checkin → prepare (nova) → select → work → …`

- **prepare** exibida após o check-in; tem botão **Pular**.
- Ao **Continuar**, os slots do nível atual são pré-preenchidos com as prioridades
  (na ordem), sem sobrescrever slots já preenchidos manualmente.
- No **select**, as 5 prioridades aparecem destacadas (⭐) no topo das sugestões
  e priorizadas na busca de cada slot.

## Fonte única de dados
- Usa `dailyTasksApi` (`load/add/remove/reorder`) — **mesma** tabela `DailyTask`
  da home. Selecionar aqui reflete na home e vice-versa (limite `DAILY_LIMIT = 5`).

## Melhorias de preparação (2ª iteração)
- **✨ Sugerir minhas N** — preenche automaticamente a partir de sinais que já
  existem: atrasadas → vence hoje → prioridade (1=crítica) → menor estimativa.
  Adiciona via `dailyTasksApi.add` e recarrega o painel (`reloadSignal`).
- **Estimativa x capacidade** — soma `estimated_minutes` das prioridades e compara
  com `taskflow.overloadMinutes` (padrão 480min/8h); alerta "dia sobrecarregado".
- **Sessão x reserva** — quando há mais prioridades que o `level`, mostra que as N
  primeiras entram nesta sessão e as demais ficam de reserva.
- **Ordem = execução** — reforça que a ordem das prioridades define a sequência.
- **Quebrar tarefa grande** — detecta prioridades com estimativa ≥60min e sem
  checklist e oferece abrir o `TaskDetailModal` para dividir em subtarefas.
- **Sugestão por estado emocional** — usa o `estadoId` do check-in: baixa energia
  (travado/cansado/ansioso/sobrecarregado/procrastinando) sugere ~3; alta energia
  (energizado/bem) sugere 5.
- **Guard / empty-state** — "Continuar" fica desabilitado sem nenhuma prioridade;
  atalho para pular inline.
- **Nudge de autodesenvolvimento** — dica para reservar 1 das prioridades ([[28-Recomendacao-Autodesenvolvimento-Daily-Focus]]).
- **Aderência ao plano** (fase `celebrate`) — "X/N prioridades do dia concluídas
  nesta sessão (%)", comparando `dayPriorities` (planejado) com os slots concluídos
  por `supabaseId`. Fecha o ciclo planejamento → execução.

### Comunicação controlada com o TodayPanel
- `onSelectionChange(ids)` — o painel notifica o pai a cada mudança de seleção
  (para estimativa/guard/sessão-reserva/tarefas grandes).
- `reloadSignal` — o pai incrementa para forçar recarga do BD após "Sugerir N".

## Arquivos
- **Novo** `frontend/src/components/daily-focus/PrepareDayScreen.tsx`
  - Reaproveita `TodayPanel` (seletor das 5 prioridades), `AddTaskForm` (criar),
    `TaskDetailModal` (editar + checklist/subtarefas) e os hooks `useTasks`,
    `useProjects`, `useTaskDetail`.
  - `onContinue` lê `dailyTasksApi.load()` (ordenado) e mapeia p/ `{id,title}`.
- `frontend/src/components/TodayPanel.tsx`
  - Nova prop `forceExpanded` (inicia expandido na etapa de preparação).
- `frontend/src/components/daily-focus/DailyFocusPage.tsx`
  - Fase `"prepare"`, estado `dayPriorities` (persistido em `useSessionPersist`),
    `handlePrepareContinue` (prefill dos slots), navegação "← Voltar" por fase,
    passa `todayPriorities` ao `TaskSlot`; `handleReset` limpa `dayPriorities`.
- `frontend/src/components/daily-focus/components/TaskSlot.tsx`
  - Nova prop `todayPriorities`; bloco "⭐ prioridades de hoje" e ordenação dos
    resultados de busca com as prioridades primeiro.
- `frontend/src/components/daily-focus/DailyFocus.module.css`
  - Estilos `.prepare*` (intro, ações, form, footer, botões continuar/pular).

## Verificação
1. Definir prioridades em "Tarefas de Hoje" na home; abrir Daily Focus e conferir
   que a fase `prepare` mostra as **mesmas** tarefas.
2. Na `prepare`: selecionar até 5, reordenar (persiste na home), criar nova tarefa,
   editar e adicionar checklist/subtarefa — sem sair do Daily Focus.
3. **Continuar** → slots do `select` pré-preenchidos na ordem; **Pular** → vazios.
4. No `select`, digitar no slot e ver prioridades destacadas/no topo.
5. Concluir a sessão e checar consistência de `daily_tasks` com a home; testar
   limite de 5, revert otimista offline e rollover de dia.
