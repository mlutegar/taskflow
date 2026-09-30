# 37 - Redesign: Ícones na Tela de Tarefas

Troca dos **emojis coloridos** da tela principal de Tarefas por **ícones vetoriais** (`lucide-react`, já instalado), padronizando alinhamento e cor com o tema. Segue o mesmo caminho já adotado em [[32-Redesign-Tela-Perfil]].

## Motivação
Emojis (✅ 🔁 📅 ▶ 🙈 👁 🔄 🔍 ⏳ 🔴🟠🟡🟢 ➕ ✨ ⚠) renderizam de forma inconsistente entre SO/navegadores, desalinham verticalmente e destoam do visual dark/roxo. Ícones SVG herdam a cor via `currentColor`/tema (claro e escuro) e alinham com `inline-flex + gap`.

## Arquivos alterados
- `frontend/src/pages/TasksPage.tsx` — cabeçalho e barra de controles:
  - ✅ título → `ListChecks`; badges 🔴/⏳ → `AlertCircle`/`Clock`
  - 🔄 Atualizar → `RotateCw`; +/✕ Nova tarefa → `Plus`/`X`
  - 🔍 busca → `Search`; ✕ limpar → `X`; ⚙ Projetos → `Settings2`
  - ⊞ agrupar → `LayoutGrid`; ⚠️ sobrecarga → `AlertTriangle`
- `frontend/src/components/DailyRoutinePanel.tsx` — painel "Rotina Diária":
  - 🔁 título → `Repeat`; ▶ Foco → `Play`; 👁/🙈 → `Eye`/`EyeOff`
  - 🔥 streak → `Flame`; ⠿ alça → `GripVertical`; ✓ conclusão/subtarefa → `Check` (renderizado só quando concluído); 🎉/✅ → `PartyPopper`
- `frontend/src/components/DueTodayPanel.tsx` — painel "Hoje & Atrasadas":
  - 📅 título → `CalendarClock`; ↕ → `ArrowDownUp`; ⤴ → `ArrowUpToLine`
  - 🔴🟠🟡🟢 prioridade → componente `PriorityDot` (`Circle` preenchido na cor da prioridade)
  - ⏱ hora → `Clock`; ➕ foco → `Plus`; 📅 redefinir data → `Calendar`
  - ✨ Livre → `Sparkles`; ⚠ + ▲/▼ → `AlertTriangle` + `ChevronUp`/`ChevronDown`; ✅ vazio → `CheckCircle2`
- `frontend/src/App.module.css` — `.searchIcon` agora usa flex centering + cor de tema (não depende de `font-size`).

## Padrão adotado
- `import { Icon } from "lucide-react"` por componente.
- Tamanhos: títulos ~15, badges/subs ~11–13, botões ~14.
- Ícones dentro de botão com texto: `display:inline-flex; align-items:center; gap:6px`.
- Checkbox (`.checkBtn`/`.subtaskCheck`): o `Check` só é renderizado quando `completed` (antes o `✓` era ocultado via `color:transparent`).

## Refinos de design (2ª leva)
Além da troca de ícones, ajustes de hierarquia e cor com significado:
- **Prioridade → barra lateral** (`.priorityBar`, 3px à esquerda do bloco) em vez de colorir o contorno do checkbox. Aplicado em `DailyRoutinePanel` e `DueTodayPanel`.
- **Checkbox neutro** (`--border`) até ser concluído; ao marcar, preenche com `--success`. Micro-interação de `scale` no hover/active.
- **Vermelho suavizado nas atrasadas**: "atrasada há Xd" virou badge compacto (`danger-bg`/`danger-border`) + data em `--text-muted`, em vez de linha inteira em vermelho vivo.
- **Mais respiro**: `.taskItem` padding 12px e divisores mais sutis (`rgba(accent, .06)`).
- **Hierarquia tipográfica**: título de painel 14px, título de tarefa 14px, metadados 11px muted; ícone do título em `--accent`.
- **Barra de progresso** da Rotina com gradiente `accent→success`, virando `--success` sólido quando tudo concluído (`.progressFillDone`).
- **Mini-heatmap** 7 dias maior (10px) e com destaque reforçado no dia de hoje.

Arquivo extra: `frontend/src/components/TodayPanel.module.css` (classes `.priorityBar`, `.progressFillDone`, ajustes de `.taskItem`/`.taskBlock`/`.checkBtn`/`.title`/`.taskTitle`).

## Notas
- O projeto tem erros de `tsc` pré-existentes (padrões `unknown`) não relacionados a esta mudança; os componentes editados compilam sem erros novos. Build real via Vite.
- Botões de colapsar/expandir (`‹`/`›`) foram mantidos (chevrons CSS, não emoji).
- Escopo desta leva = tela da captura. Outras telas com emojis podem ser migradas depois.
