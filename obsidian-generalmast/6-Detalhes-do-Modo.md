# 6 - Painel de Detalhes do Modo

Voltar ao [[0-Painel]]. Faz parte da tela [[1-Tela-Escolher-Modo]].

## O que é
Abre um painel com informações detalhadas de um modo **sem iniciá-lo**:
- **Mobile**: segurar o card (long-press ~0,45s).
- **Desktop**: clicar com o **botão direito** (context menu).

Toque/clique curto continua **selecionando** o modo normalmente.

## Componentes
- `frontend/src/lib/useLongPress.ts` — hook: dispara `onLongPress` ao segurar (touch, cancela se arrastar >10px) ou no `onContextMenu` (botão direito). Expõe `shouldSuppressClick()` para o clique seguinte não selecionar.
- `frontend/src/components/modes/LongPressButton.tsx` — encapsula o hook para uso dentro de listas (`.map`); substitui o `<button>` do card no `ModePicker`.
- `frontend/src/components/modes/ModeDetailSheet.tsx` (+ `.module.css`) — o painel em si.

## O painel (ModeDetailSheet)
Usa o `ModalOverlay` (`components/shared/ModalOverlay.tsx`: portal, fecha no Esc e clique-fora). Mostra, condicionalmente (só o que o modo tem):
- Cabeçalho: emoji, nome, tagline, chips de **categoria** (colorida) e **tipo**.
- Uso: "Feito hoje ×N (11h)" e "N× nos últimos 7 dias" (dados vindos do `ModePicker`).
- ✅ Pré-requisito · 🧠 Por que funciona · 🕐 Quando usar
- 🪜 **O que fazer** (`steps`, lista numerada na cor do modo)
- 🎭 Classes (quando houver, ex.: RPG) · 🏷️ Contexto · 💡 Dica
- Rodapé: **Usar este modo** (chama `onSelect` e fecha) + Fechar.

## Ligação no ModePicker
Estado `detailMode`. O card usa `LongPressButton` com `onLongPress={() => setDetailMode(mode)}`;
o `onContextMenu` já é tratado pelo hook. O sheet é renderizado quando `detailMode` existe.

## Melhorias de UX/A11y
- **Pointer Events unificados** (mouse+touch+caneta) no `useLongPress`; mouse usa o botão direito.
- **Feedback ao segurar**: `pressing` aplica scale/opacity no card + **vibração** (`navigator.vibrate`).
- **Cancela no scroll**: se a página rolar durante o press, o long-press é abortado (listener em `capture`).
- **Teclado**: tecla de menu de contexto ou **Shift+F10** abrem os detalhes; card com `aria-haspopup="dialog"`.
- **iOS**: `-webkit-touch-callout: none` + `user-select: none` no card (evita o callout de seleção).
- **Dica de descoberta** (1ª vez): banner "Segure um card…", dispensável, salvo em `modePicker.detailHintSeen`.

## Painel — foco/scroll e ações
- **Focus-trap + restauração de foco** via `useDialog` (`lib/useDialog.ts`); **scroll-lock** do body enquanto aberto.
- **Ações rápidas**: Favoritar ★, Ocultar 🚫 (com undo), Filtrar por categoria (chip clicável), **Copiar passos** 📋.
- **Estatísticas reais**: taxa de sucesso (`getModeSuccessRate`) e melhor horário (`getBestHourForMode`) de `sessionUsageLog`.
- **Modos parecidos**: mesma categoria (até 6), abrem o detalhe do modo clicado.

## Testes
`frontend/src/components/ModePicker.test.tsx`: botão-direito abre o `dialog` com "O que fazer"/passo/"Usar";
e long-press (fake timers) abre ao **segurar** mas **não ao arrastar**.
