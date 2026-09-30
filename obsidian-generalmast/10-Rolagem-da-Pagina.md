# 10 - Rolagem da página

Voltar ao [[0-Painel]].

## Sintoma

Na página inicial, a roda do mouse, o trackpad e o gesto vertical podiam não mover a página,
embora arrastar diretamente a barra de rolagem à direita funcionasse.

## Causa

`html` e `body` usavam `overflow-x: hidden`. Pelas regras de CSS Overflow, ocultar apenas um
eixo faz o outro eixo deixar de ser `visible` e se comportar como `auto`. Isso criava um
contêiner de rolagem vertical secundário. Como o `body` também usava
`overscroll-behavior: none`, eventos de roda/toque podiam ficar presos nesse contêiner sem
ser encadeados para a rolagem do documento.

## Correção

- `html` e `body`: `overflow-x: clip` e `overflow-y: visible`.
- `body`: bloqueio de overscroll apenas no eixo horizontal; eixo vertical em `auto`.
- `.pageArea`: `touch-action: pan-y`, preservando rolagem vertical mesmo com cards que possuem
  gesto horizontal de concluir/excluir.

Arquivos: `frontend/src/index.css` e
`frontend/src/components/layout/Sidebar.module.css`.
