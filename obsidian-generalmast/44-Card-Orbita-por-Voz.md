# 44 - Card "Órbita por Voz"

Novo **modo de apoio** (card de suporte) chamado **Órbita por Voz** — variação dos cards Órbita já existentes, focada em usar o assistente **por comandos de voz** durante a atividade, sem interromper o fluxo da tarefa.

Ver contexto geral dos modos em [[2-Modos-e-Tipos]] e a tela onde os cards aparecem em [[1-Tela-Escolher-Modo]].

## O que é
Ao selecionar o card, o usuário dá comandos de voz ao Órbita enquanto realiza a atividade — pedir o próximo prompt, responder, avançar, repetir e marcar acerto/erro, tudo falando, com mãos e olhos livres.

## Onde foi implementado
Tudo em `frontend/src/data/modes.ts` (fonte única dos cards — **sem** persistência em banco):

1. Novo objeto no array `MODES` (`id: "orbita_voz"`), logo após `orbita_igualdade`.
   - `type: "durante"`, `emoji: 🪐`, `category: "Memória"`, cores da identidade Órbita (`#00897b`).
   - `context: ["📱 Mobile", "🎙️ Voz", "🧠 Memória"]`, com `prerequisite`, `whyItWorks`, `whenToUse`, `steps` e `tips`.
2. `HELPER_GROUPS` → `"orbita_voz"` adicionado à categoria **Memória**.
3. `CATEGORY_BY_ID` → `orbita_voz: "Memória"` (junto dos demais cards Órbita).

## Cards Órbita irmãos
- `orbita_atividade` — Órbita & Atividade Física
- `orbita_successao` — Sucessão de Órbita
- `orbita_igualdade` — Igualdade de Órbita
- `orbita_voz` — **Órbita por Voz** (este)

## Verificação
- Build/typecheck do frontend sem erros de TS.
- Painel de modos → categoria **Memória** exibe o card com emoji, tagline, passos e dicas.
- Iniciar sessão pelo card segue o fluxo padrão de modo "durante".
