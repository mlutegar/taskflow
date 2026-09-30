# 28 - Recomendação de Autodesenvolvimento no Daily Focus

Voltar ao [[0-Painel]].

## O que é
Na primeira tela do **Daily Focus** (fase `select`), no momento em que o usuário escolhe a
**primeira tarefa do dia**, exibimos uma recomendação **leve e inspiradora** sugerindo que a
Tarefa 1 seja, de preferência, uma tarefa de **autodesenvolvimento**.

Não é regra nem obrigação — o usuário continua livre para escolher qualquer tarefa. É apenas um
empurrãozinho da plataforma.

## Por quê (a lógica do ganho composto)
Começar o dia investindo em algo que melhora a própria capacidade de trabalhar, estudar ou
produzir gera **ganhos acumulados** ao longo do tempo. Se você melhora um pouco sua capacidade,
seu sistema ou sua produtividade todos os dias — mesmo que **1% por dia** — esse ganho se compõe.

Exemplos de tarefa de autodesenvolvimento:
- estudar algo importante para o próprio desenvolvimento;
- melhorar uma ferramenta pessoal de produtividade (ex.: o próprio dashboard da plataforma, ou o **Orbiter**);
- trabalhar num projeto próprio;
- organizar/evoluir o próprio sistema de estudos;
- aprender uma nova habilidade;
- melhorar um processo que será reutilizado no futuro.

Mesmo sem resultado imediato para uma demanda externa, isso melhora **como** você fará as
próximas tarefas.

## Onde aparece
- Título ajustado para **"Qual será sua primeira tarefa do dia?"** (antes: "Qual é a tarefa mais
  importante do seu dia?").
- Card de recomendação logo abaixo do subtítulo:
  > 🌱 **Sempre que possível, comece por uma tarefa de autodesenvolvimento.** Invista primeiro em
  > algo que torne você melhor nas próximas tarefas — estudar, evoluir uma ferramenta pessoal,
  > trabalhar num projeto próprio. Melhorar 1% por dia se acumula ao longo do tempo.

## Condição de exibição
Aparece **apenas quando `tasks.length === 1`** (nível 1 — o momento de escolher a *primeira*
tarefa). Em níveis com múltiplas tarefas o foco é priorização, então a dica não é exibida.

## Melhorias implementadas (v2)
O card evoluiu de texto estático para um componente interativo e mensurável:

1. **Dispensável** — botão `×` que oculta a recomendação por **7 dias** (localStorage).
2. **Rotação de exemplos** — a frase mostra um exemplo diferente por dia (determinístico pelo
   dia do ano), sem repetir no mesmo dia.
3. **Chip "É autodesenvolvimento"** — marca a Tarefa 1 do dia como autodesenvolvimento; vira
   `✓ Autodesenvolvimento` quando ativo. É o dado que alimenta o streak.
4. **Streak** 🔥 — mostra "N dias seguidos" começando por autodesenvolvimento (mesma lógica de
   ganho composto que a mensagem prega). Não zera logo no início do dia (conta a partir de ontem
   até você marcar hoje).
5. **Micro-visual do 1%** — "Melhorar 1% por dia ≈ 38× em um ano" (1.01³⁶⁵ ≈ 37,78, arredondado).
6. **Acessibilidade** — emoji com `aria-hidden`, chip com `aria-pressed`, botão de fechar com
   `aria-label`; animação suave de entrada.

## Implementação
- `frontend/src/lib/selfDevelopment.ts` — **novo**. Persistência em localStorage (log por dia,
  streak, dispensa temporária), rotação de exemplos e `COMPOUND_YEAR_FACTOR`. Segue o padrão de
  `dailyFocusDay.ts` (data local, não UTC — fix #11/#23).
- `frontend/src/components/daily-focus/DailyFocusPage.tsx` — import do novo módulo, estados
  (`selfDevMarked`, `recDismissed`, `selfDevStreak`, `selfDevExample`) e o card
  `selectRecommendation` interativo, renderizado quando `tasks.length === 1 && !recDismissed`.
- `frontend/src/components/daily-focus/DailyFocus.module.css` — classes `.selectRecommendation*`,
  `.selfDevChip`, `.selfDevChipActive`, `.selfDevStreak`, usando tokens de tema
  (`var(--accent)`, `var(--text)`, `var(--text-muted)`, `var(--surface-2)`, `var(--radius-sm)`).

O tracking é **frontend-only** (localStorage): não altera o fluxo de início da sessão nem exige
mudança de schema/backend.

## Futuro (dependem de backend / schema)
Sugestões estratégicas ainda não implementadas por exigirem migração no Supabase e endpoints:
- **Categoria "Autodesenvolvimento"** no modelo de tarefa/projeto + relatório semanal
  ("X% do tempo focado foi em autodesenvolvimento").
- **Sugestão inteligente**: oferecer preenchimento de 1 clique a partir de tarefas/projetos já
  marcados como autodesenvolvimento (ex.: dashboard, Orbiter).
- **Reflexão de fim de sessão** quando a Tarefa 1 foi autodesenvolvimento.
- **Sincronização do streak** com o backend (hoje é local ao dispositivo).

## Relacionados
- [[1-Tela-Escolher-Modo]] — outra tela de entrada do app.
- [[7-Tarefas-Recorrentes]] — painel de foco das tarefas do dia.
- [[0-Painel]] — índice do vault.
