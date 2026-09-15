# 0 - Painel — generalmast

Vault de documentação do projeto **generalmast** (app de foco com "modos").

## Índice
- [[1-Tela-Escolher-Modo]] — o seletor de modos (`ModePicker`)
- [[2-Modos-e-Tipos]] — tipos, categorias e a fonte de dados dos modos
- [[3-Modos-Feitos-Hoje]] — como o app sabe o que foi feito hoje + funções de data
- [[4-Preencher-Modo-com-IA]] — botão que usa IA para preencher o modo no `CreateModeModal`
- [[5-Filtros-Ordenacao-Favoritos]] — filtros, ordenação persistida, favoritos e densidade no `ModePicker`
- [[6-Detalhes-do-Modo]] — segurar/botão-direito no card abre painel de detalhes

## Feature recente
Melhoria na tela **Escolher modo** ([[1-Tela-Escolher-Modo]]):
1. Banner explícito "Hoje (DD/MM) você já realizou: …" → ver [[3-Modos-Feitos-Hoje]]
2. Chips de tipo/categoria em cada card → ver [[2-Modos-e-Tipos]]
3. **Ocultar/reexibir modos** que o usuário não usa (ex.: `splite`) → ver [[1-Tela-Escolher-Modo]]
