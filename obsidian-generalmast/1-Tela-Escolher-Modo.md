# 1 - Tela "Escolher Modo"

Voltar ao [[0-Painel]].

## Componente
`frontend/src/components/ModePicker.tsx` + `ModePicker.module.css`.

Recebe as props:
- `usedTodayIds: string[]` — IDs dos modos já realizados hoje (calculados no `SlotBoard`).
- `selectedIds`, `onSelect`, `onClose`.

## Layout (de cima para baixo)
1. Header (voltar + título).
2. **Banner "Hoje você já realizou…"** (compacto) — ver [[3-Modos-Feitos-Hoje]].
3. Busca.
4. Filtros de categoria (`ALL_CATEGORIES`, rolável).
5. **Barra de ferramentas** (`.toolbar`, rolável no mobile) — ver abaixo.
6. Botão "modo aleatório" (escolhe **um** modo, preferindo não usados hoje).
7. Lista de cards. Cada card mostra emoji, nome, tagline e **no máx. 2 chips** (categoria colorida + tipo). Ver [[2-Modos-e-Tipos]].

## Correção de layout (mobile)
Bug antigo: `.modeMeta` não era coluna e nome/tagline (spans inline) grudavam e vazavam da tela.
Fix: `.modeMeta { display:flex; flex-direction:column }` + nome/tagline `display:block` com truncamento em 1 linha. Context tags removidos (poluíam/duplicavam a categoria).

## Barra de ferramentas — filtro + ordenação
Chips roláveis (`.toolBtn`):
- **☐ Só não feitos hoje** — toggle (`hideUsedToday`).
- **↕ Ordem: Padrão / A–Z / Aleatória** — botão que cicla `sortMode`. Persistido em `storage` (`modePicker.sortMode`).
- **🎲 Embaralhar** — só no modo Aleatória; gera nova ordem (Fisher–Yates) e salva em `modePicker.randomOrder`.
- **⚙ Gerenciar (N)** — toggle (`showHidden`); N = qtde de modos ocultos. Entra no "modo gerenciar".
- **🚫/↩ Ocultar/Reexibir "Categoria"** — só aparece no modo gerenciar com uma categoria ativa; oculta/reexibe todos os modos dela em lote (`bulkCategory`).

## Ocultar / reexibir modos
Modos que o usuário não usa podem ser **ocultados** (reversível, diferente de deletar).

**Modo gerenciar (`showHidden`)** — decluttering: no uso normal os cards ficam limpos e os
ocultos somem da lista/busca/filtros/sorteio. Ao ligar **⚙ Gerenciar**:
- os modos ocultos reaparecem esmaecidos (`.modeCardHidden`);
- surge o botão **🚫/↩** em cada card (`handleToggleHidden`);
- surge o botão de ocultar/reexibir **categoria inteira** na toolbar.

**Atalhos e feedback:**
- Rodapé **"+N modos ocultos — gerenciar"** (`.hiddenFooter`) aparece quando há ocultos e o
  modo gerenciar está desligado → liga o modo gerenciar. Torna o recurso descobrível.
- Toda ação de ocultar/reexibir (individual ou por categoria) mostra a barra **Desfazer**
  (`.undoBar`, `flashUndo`, 5s).

**Persistência / sync:**
- `taskflow.hiddenModeIds` no localStorage + `setHiddenModeIds` → `PUT /preferences`
  (coluna `hidden_mode_ids`). Helpers em `frontend/src/lib/customModes.ts`.
- Merge no boot (`userPreferences.ts`): **o servidor vence (last-write-wins)**, não união —
  porque ocultar é reversível (união faria um modo reexibido "reviver" ao sincronizar).
- Sync entre abas/componentes via evento `hiddenModesUpdated` + `storage` event.

Ordenação em `filtered`:
- `default`: catálogo, feitos hoje ao fim.
- `alpha`: `name.localeCompare(pt-BR)`, feitos hoje ao fim.
- `random`: ordem salva em `randomOrder` (ids ausentes ao fim); não reordena por "feito hoje".
