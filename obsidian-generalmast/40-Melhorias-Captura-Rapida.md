# 40 - Melhorias na Captura Rápida de Tarefas

> Ver também: [[0-Painel]] · [[36-Captura-Rapida-Global-de-Tarefas]] · [[8-Atualizacao-Imediata-de-Tarefas]] · [[24-Melhorias-Tarefas-Hoje]]

## Motivação
A captura rápida global ([[36-Captura-Rapida-Global-de-Tarefas]]) resolveu o "criar de
qualquer página". Este pacote reduz atrito, dá confiança e conecta a captura ao resto
da plataforma.

## O que mudou

1. **Feedback + Desfazer** — ao salvar, um toast de sucesso ("Tarefa criada") com botão
   **Desfazer** (6s). O undo remove do cache (`removeTask`) e faz soft-delete
   (`tasksApi.delete`). O `ToastProvider` ganhou suporte a `action` e `durationMs`
   (retrocompatível).
2. **Enter cria / Ctrl+Enter cria** — Enter no título já submete (form nativo);
   `Ctrl/⌘+Enter` também.
3. **Atalho Ctrl/⌘+K** — além da tecla **N**, abre a captura em qualquer contexto
   (padrão "quick add"). Ambos ignoram quando o foco está num campo de texto.
4. **Criar e adicionar outra** — botão secundário salva e mantém o painel aberto com os
   campos limpos e foco no título (despejo mental em sequência). Implementado via
   `onSubmit(payload, { keepOpen })` — a página de Tarefas ignora o 2º arg.
5. **Linguagem natural no título** — `parseQuickTask` (`lib/quickTaskParse.ts`) extrai
   **data** (`hoje`, `amanhã`, `depois de amanhã`, dias da semana, `dd/mm`), **hora**
   (`14h`, `14h30`, `9:30`) e **prioridade** (`!alta`, `!crítica`, `!1`…`!4`) — só
   preenche campos que o usuário não definiu manualmente. Tem testes
   (`quickTaskParse.test.ts`). ⚠️ Detalhe: `\b` não funciona após acento (ã, í, ç) →
   usamos lookahead `(?=\s|$)`.
6. **Captura de contexto** — se aberto dentro de um projeto (`#/tasks?project=<id>`),
   pré-seleciona o projeto (`initialProjectId`).
7. **Adicionar às Tarefas de Hoje** — checkbox opcional que, após criar, chama
   `dailyTasksApi.add` e trata o limite de 5 (409 → aviso no toast). Ver
   [[24-Melhorias-Tarefas-Hoje]].
8. **Rascunho persistente** — título/descrição salvos em `localStorage`
   (`taskflow.quicktask.draft`); reidrata ao reabrir, limpa ao salvar.
9. **Painel lateral (drawer) no desktop** — em telas ≥900px o modal ancora à direita
   (`ModalOverlay variant="side"`), reforçando "não saí de onde estava"; no mobile
   continua modal centralizado.
10. **Acessibilidade** — `ModalOverlay` agora tem **focus trap** (Tab/Shift+Tab ciclam)
    e **devolve o foco** ao elemento anterior ao fechar (beneficia todos os modais).
11. **Robustez offline** — se o create for enfileirado (sem id), subtarefas/Hoje são
    puladas e o toast avisa "salva offline". Falha em subtarefa isolada não derruba o lote.

## Arquivos
Novos:
- `frontend/src/lib/quickTaskParse.ts` (+ `quickTaskParse.test.ts`)

Modificados:
- `frontend/src/components/QuickTaskButton.tsx` — atalho Ctrl/⌘+K, prop `hidden`, projeto da URL, toast+undo, `variant="side"`, dica de linguagem natural
- `frontend/src/contexts/QuickTaskContext.tsx` — `save` com parsing + Hoje + resultado; `undoCreate`
- `frontend/src/components/AddTaskForm.tsx` / `.module.css` — props `initialProjectId`, `allowAddAnother`, `enableAddToday`, `draftKey`, `titlePlaceholder`; `onSubmit(payload, {keepOpen})`; reset + refocus
- `frontend/src/components/shared/Toast.tsx` / `.module.css` — `action` + `durationMs`
- `frontend/src/components/shared/ModalOverlay.tsx` / `.module.css` — focus trap, retorno de foco, `variant="side"`
- `frontend/src/main.tsx` — `hidden={hash === "#/tasks"}`

## Verificação
1. `cd frontend && npm run dev`.
2. **N** ou **Ctrl/⌘+K** em qualquer página abre a captura; na aba Tarefas o FAB some,
   mas o atalho funciona.
3. Digite "Pagar boleto amanhã 14h !alta" → salvar → tarefa entra com prazo amanhã, 14:00
   e prioridade Alta.
4. "Criar e adicionar outra" mantém o painel e limpa os campos.
5. Marque "Adicionar às Tarefas de Hoje" → conferir no painel Hoje (com 5, vem aviso).
6. Salvar → toast "Tarefa criada" com **Desfazer**; clicar remove a tarefa.
7. Fechar sem salvar e reabrir → título/descrição preservados.
8. Testes: `npx vitest run src/lib/quickTaskParse.test.ts` (8 passam).

## Relacionado
[[36-Captura-Rapida-Global-de-Tarefas]] · [[24-Melhorias-Tarefas-Hoje]] ·
[[8-Atualizacao-Imediata-de-Tarefas]] · [[9-Cache-Sync-e-Versionamento]]
