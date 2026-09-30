# 16 - Redesign do Formulário "Adicionar Projeto"

Voltar ao [[0-Painel]].

Redesign visual do formulário de criação/edição de projeto dentro do modal
**Projetos** (`ProjectManager`). Apenas estilo + marcação — **sem mudança de
lógica/validação** (`submit`, `reset`, `form`, `editingId`, `error` intactos).

## Motivação
No mobile o formulário ficava confuso (ver print original): emoji minúsculo,
seletor de cor renderizado como chip quebrado ("Nor"), campos só com placeholder
(sem rótulos) e grid rígido de 3 colunas que colapsava mal.

## Arquivos
- `frontend/src/components/ProjectManager.tsx`
- `frontend/src/components/ProjectManager.module.css`

## O que mudou
1. **Layout flex** — o form virou `display:flex; column` com `gap`, no lugar do
   grid `54px minmax(140px,1fr) 115px`. Fim do colapso amontoado.
2. **Rótulos visíveis** — cada campo agora é um `<label>` (`.field` + `.label`):
   Emoji, Cor, Nome, Descrição *(opcional)*, Projeto pai.
3. **Linha de identidade** (`.identityRow`) — Emoji + Cor + Nome lado a lado,
   alinhados pela base (`align-items:flex-end`). Nome ocupa o espaço restante.
4. **Seletor de cor limpo** — swatch quadrado (`.colorWrap/.colorInput`) que
   mostra a cor atual via `--project-color`; removida a borda/padding padrão do
   navegador (`::-webkit-color-swatch`, `::-moz-color-swatch`). Fim do "Nor".
5. **Emoji** — input dedicado (`.emojiInput`), centralizado, fonte 20px.
6. **Título do form** (`.formTitle`) — "Novo projeto" / "Editar projeto"
   conforme `editingId`.
7. **Foco visível** — halo roxo `box-shadow: 0 0 0 3px rgba(124,110,245,.22)`
   em inputs e no `<select>` do [[11-Projetos-e-Grupos|ProjectSelect]]
   (estilizado via `:global(select)` dentro de `.field`).
8. **Botão** — `Criar projeto` com hover `--accent-hover` e `:disabled`.
9. **Mobile** (`@media max-width:520px`) — ações viram coluna e botões
   full-width (`.actions button { width:100% }`).

## Tokens reutilizados
De `frontend/src/index.css`: `--surface`, `--surface-2`, `--border`,
`--text-muted`, `--accent`, `--accent-hover`, `--danger`, `--radius`,
`--radius-sm`.

## Melhorias de UX (2ª iteração — "implemente tudo")
1. **Emoji picker** — botão (`.emojiButton`) abre popover (`.emojiPopover`) com grade
   de ~40 emojis (`EMOJI_OPTIONS`) + campo para colar emoji personalizado. Fecha ao
   selecionar ou clicar fora (listener `mousedown`).
2. **Paleta de cores** — 12 swatches pré-definidos (`COLOR_PALETTE`, cores do tema)
   como bolinhas (`.swatch`, ativa com anel), além do `input[type=color]` para custom.
3. **Pré-visualização ao vivo** (`.preview/.previewCard`) — mini-card com
   `emoji + nome + borda colorida`, atualiza enquanto digita.
4. **Atalhos de teclado** — `Esc` fecha, `Ctrl/Cmd+Enter` salva (listener em `document`).
   Dica visível (`.kbdHint` com `<kbd>`), oculta no mobile.
5. **Contador de caracteres** na descrição (`DESC_MAX=500`, `.hint`) + slice defensivo.
6. **Aviso de nome duplicado** (`duplicateName`, mesmo pai) — `.warn` com `role="alert"`,
   `aria-describedby` ligando ao input. Não bloqueia o envio.
7. **Excluir com desfazer** — substitui `window.confirm`. `remove()` agenda a exclusão
   real (`onDelete`) para daqui a 5s e mostra toast (`.toast` + botão **Desfazer**);
   a linha some da lista enquanto pendente. Timer limpo no unmount.
8. **Busca + arquivados** — toolbar (`.toolbar`) com campo de busca (`.search`, filtra
   por nome) e checkbox "Mostrar arquivados" (`.toggle`). `filteredRows` via `useMemo`.
9. **Acessibilidade** — `aria-invalid` no nome, `aria-describedby`, `role="alert"`/`status`,
   `aria-expanded`/`aria-pressed` nos toggles.
10. **Foco inicial + trap de foco** — foco no campo Nome ao abrir; `trapFocus` cicla
    Tab/Shift+Tab dentro do painel. Editar/criar-subprojeto rolam ao topo e focam o nome.
11. **Componente `<Field>`** reutilizável (label + conteúdo + hint) dentro do arquivo.

## Verificação
- `cd frontend && npm run build` → OK. `npm run lint` → limpo (erro restante é do
  `vite.config.js`, pré-existente).
- `npm run dev` → tela **Tarefas** → abrir modal **Projetos**.
- Viewport mobile (~360px): rótulos, emoji+cor alinhados, botão full-width.
- Testar: emoji picker, paleta/cor custom, preview, criar/editar/subprojeto,
  buscar, alternar arquivados, excluir → **Desfazer**, `Ctrl+Enter`, `Esc`.

Relacionado: [[11-Projetos-e-Grupos]], [[14-Tempo-Estimado-e-Filtro]], [[15-Redesign-Card-Nova-Tarefa]].
