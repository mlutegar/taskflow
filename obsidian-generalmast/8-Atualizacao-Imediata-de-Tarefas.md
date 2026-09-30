# 8 - Atualização imediata de tarefas

Voltar ao [[0-Painel]]. Relacionado a [[7-Tarefas-Recorrentes]].

## Sintoma corrigido

Depois de editar uma tarefa ou alterar seu checklist/subtarefas, o servidor e o cache eram
atualizados, mas o cartão continuava mostrando os dados anteriores até recarregar o aplicativo.

## Causa

`frontend/src/components/TaskCard.tsx` usava uma comparação personalizada no `React.memo`
baseada somente em `id`, `updatedAt` e `updated_at`. O modelo `Task` do backend não possui
esses campos. Assim, para a mesma tarefa, a comparação sempre considerava as props iguais e
bloqueava a nova renderização, inclusive quando o cache entregava um novo objeto.

## Correção

O cartão mantém `React.memo`, mas usa a comparação rasa padrão. As mutações do
`useTasks.ts` substituem a tarefa afetada por um novo objeto; portanto, o cartão redesenha
imediatamente quando título, descrição, prioridade, prazo ou checklist mudam.

Ao criar ou editar, `useTasks.ts` também atualiza imediatamente a lista ativa e invalida as
demais combinações de filtro/ordenação do React Query. Isso evita que outra visão em cache
continue exibindo a coleção anterior.

## Teste

`frontend/src/components/TaskCard.test.tsx` cobre a regressão: recebe a mesma tarefa sem
timestamps, troca o objeto com um novo título e confirma que o conteúdo visível muda sem reload.
