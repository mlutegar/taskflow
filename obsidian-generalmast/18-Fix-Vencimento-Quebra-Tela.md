# 18 - Fix: campo "Vencimento" quebra a tela no iPhone

Voltar ao [[0-Painel]] · Relacionado: [[15-Redesign-Card-Nova-Tarefa]] · [[17-Criar-Projeto-Inline-na-Tarefa]]

## Sintoma
No formulário **Nova Tarefa**, aberto no iPhone/Safari, o campo **📅 Vencimento**
estourava a largura do card e gerava **rolagem horizontal** — "a tela quebra".

## Causa raiz
O campo usa um `<input type="date">` nativo
(`frontend/src/components/AddTaskForm.tsx:214-221`). No WebKit do iOS esse input
tem uma **largura intrínseca mínima** e um `-webkit-appearance` padrão que
**ignoram `width: 100%` / `min-width: 0`**, então o elemento fica maior que o
container.

O reset global já aplica `box-sizing: border-box` (`frontend/src/index.css:1`),
portanto o problema **não** era padding/borda — era o comportamento nativo do
input de data no iOS.

## Correção
Em `frontend/src/components/AddTaskForm.module.css`:

- Adicionado `min-width: 0` na regra base `.input, .textarea, .select`.
- Nova regra específica para o input de data neutralizando a aparência nativa:

```css
.input[type="date"] {
  -webkit-appearance: none;
  appearance: none;
  min-width: 0;
  width: 100%;
  min-height: 42px;   /* evita colapso de altura ao remover appearance no iOS */
  line-height: 1.2;
}
.input[type="date"]::-webkit-date-and-time-value {
  text-align: left;
  margin: 0;
}
.input[type="date"]::-webkit-calendar-picker-indicator {
  margin-left: auto;
}
```

### Generalização
O tratamento de aparência nativa foi movido para **`frontend/src/index.css`**
cobrindo `input[type="date"|"time"|"datetime-local"]` — assim `TaskCard`,
`RoutineCard` e `TodayPanel` (que também têm inputs de data) ficam protegidos do
mesmo overflow. Em `AddTaskForm.module.css` sobrou só o ajuste de altura.

## Melhorias de UX do campo Vencimento
Implementadas junto do fix:

1. **Chip "Personalizada"** — quando a data escolhida não bate com nenhum atalho
   (Hoje/Amanhã/Próx. semana), aparece um indicador "Personalizada".
2. **Chip "✕ Limpar"** — atalho explícito para remover o vencimento (antes só
   dava pra reclicar o chip ativo).
3. **Rótulo relativo** (`.dueHint`) abaixo do input: "vence hoje" / "vence
   amanhã" / "vence em N dias" / "atrasada N dias", com cores por tom
   (`overdue`=danger, `today`=warning, `soon`=accent). Vem de
   `dueDateLabel()` em `lib/dateUtils.ts`.
4. **`min={todayISO()}`** no input — não permite escolher data no passado.
5. **Área de toque dos chips** aumentada (`min-height: 34px`, padding maior)
   para uso confortável no mobile.
6. **Fuso horário verificado**: `todayISO`/`daysAgoISO`/`daysUntilISO` operam
   todos em hora **local** (não UTC) — sem bug de virada de meia-noite.

Novos helpers em `lib/dateUtils.ts`: `daysUntilISO()`, `dueDateLabel()`,
tipo `DueTone`. Cobertos por `lib/dateUtils.test.ts` (vitest, 7 casos).

## Verificação
1. `cd frontend && npm run dev`, abrir o form de Nova Tarefa.
2. Safari responsivo / iPhone real (~390px): o campo Vencimento ocupa 100% do
   card **sem** rolagem horizontal.
3. O seletor de data ainda abre; os chips continuam sincronizando o valor e o
   rótulo relativo atualiza junto.
4. Desktop (Chrome/Firefox): sem regressão visual.
5. Testes: `npx vitest run src/lib/dateUtils.test.ts` (7 passam) e
   `npx vite build` (build ok).
