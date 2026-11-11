# 75 — Finanças: botões Gasto / Ganho (prompt 06)

Problema: ao testar, não se achava como adicionar ganho (tipo "Renda" ficava em "Mais opções" do **+**).

## O que mudou
- O FAB **+** virou uma barra fixa com **− Gasto** (vermelho) e **+ Ganho** (verde) em todas as abas (`FinancePage.tsx`, `.addBar` em `Finance.module.css`).
- `QuickAddSheet` recebe `initialType`: abre no tipo certo, valor em foco (o focus trap do Modal focava o 1º botão; agora um efeito devolve o foco ao valor), data = hoje, chips só do tipo, forma de pagamento lembrada (`finance.lastPayment`).
- Seletor Gasto/Ganho no topo; data e forma de pagamento saem de "Mais opções", que ficou só com **descrição e recorrência**.
- Aba Mês: cards Entradas/Saídas são botões (abrem Ganho/Gasto) — `MonthTab onAdd`.
- Termo **Ganho** padronizado para o lançamento de entrada (toasts, lista). A aba **Rendas** (fontes/previstas) mantém o nome.
- Testes: `QuickAddSheet.test.tsx` (modo certo, categorias por tipo, troca no topo, MonthTab).
- Sem migration.

Ver [[72-Financas-Fase-A-Lancamentos]], [[73-Financas-Fase-B-Rendas-e-Projecao]].
