# 15 - Redesign do Card "Nova Tarefa"

Voltar ao [[0-Painel]].

Redesign visual do card de criação de tarefa (`AddTaskForm`) na tela **Tarefas**.
Apenas estilo + marcação — **sem mudança de lógica/validação**.

## Arquivos
- `frontend/src/components/AddTaskForm.tsx`
- `frontend/src/components/AddTaskForm.module.css`

## O que mudou
1. **Card** — borda sutil `--border`, `border-radius: 14px`, sombra de profundidade
   (`box-shadow: 0 10px 30px …`) e **barra de acento no topo** (`::before` com
   gradiente `--accent → --accent-hover`).
2. **Header novo** (`.header`) — título "Nova Tarefa" com um *dot* de acento
   luminoso (`.heading::before`) à esquerda e botão **×** de fechar (`.btnClose`)
   à direita, separados por divisória (`border-bottom`). O × chama `onCancel`.
3. **Campos** — mais respiro (`padding: 11px`) e foco mais visível com halo
   roxo (`box-shadow: 0 0 0 3px rgba(124,110,245,.15)`).
4. **Prioridade** — select ganha `data-priority` + classe `.selectPriority`,
   com borda-esquerda colorida por nível usando `--critical/--high/--medium/--low`.
5. **Ações** — separadas por `border-top`; botão **Criar tarefa** ocupa `flex:1`,
   com hover elevado (`translateY(-1px)` + sombra). "Cancelar" mantido como
   secundário (além do × no header).
6. **Mobile** (`@media max-width:520px`) — `.row` empilha, padding/gap reduzidos.

## Tokens reutilizados
Definidos em `frontend/src/index.css`: `--surface`, `--surface-2`, `--border`,
`--accent`, `--accent-hover`, `--danger`, `--radius-sm`, e as cores de
prioridade `--critical/--high/--medium/--low`.

## Melhorias de UX (2ª iteração — "implemente tudo")
1. **Atalhos de teclado** — `Esc` cancela, `Ctrl/Cmd+Enter` salva (`handleKeyDown` no `<form>`).
   Dica visível no rodapé (`.hint` com `<kbd>`), oculta no mobile.
2. **Prioridade em pills** — 4 botões redondos (`.pills/.pill`) com `aria-pressed`,
   substituindo o `<select>`. Ativo ganha anel colorido por nível
   (`--critical/--high/--medium/--low`).
3. **Chips de data** — "Hoje / Amanhã / Próx. semana" (`.chips/.chip`) acima do
   date picker. Usam `todayISO()` e `daysAgoISO(-1)` / `daysAgoISO(-7)` de `dateUtils`.
   Clicar de novo no chip ativo limpa a data.
4. **Ícones nos labels** — emojis (🚩📅🔁⏱📁) para escaneabilidade — evitei
   `lucide-react` (dependência não usada e em versão suspeita 1.33.0).
5. **Campos avançados recolhíveis** — Repetição, Tempo estimado e Projeto vão para
   um bloco "Mais opções" (`.advanced`) recolhido por padrão, com chevron animado.
   Deixa o card mais leve (queixa original do print).
6. **Contador de caracteres** na descrição (`DESC_MAX = 1000`, alinhado ao `taskSchema`)
   + `maxLength` + slice defensivo.
7. **Título maior** (`.inputTitle`, 16px/500) para hierarquia.
8. **Acessibilidade** — `aria-invalid`, `aria-describedby` ligando input ↔ erro,
   `role="alert"` nas mensagens.

Nota: o card é renderizado **inline** em `TasksPage` (`.formWrapper`), não é modal —
por isso não há "clique fora para fechar".

## Verificação
- `cd frontend && npm run build` → OK.
- `npm run dev` → tela **Tarefas** → **+** para abrir o card.
- Testar: pills de prioridade, chips de data, expandir "Mais opções",
  contador da descrição, `Ctrl+Enter` e `Esc`.

Relacionado: [[8-Atualizacao-Imediata-de-Tarefas]], [[14-Tempo-Estimado-e-Filtro]].
