# 72 — Finanças, Fase A: lançamentos, recorrência/parcelas, categorias e visão do mês

Prompt 03 (Fase A). Página `#/financas`, no padrão da Saúde ([[68-Saude-Fase-A-Remedios]]). Painel: [[0-Painel]].

## O que entrou
- **Lançamentos** de gasto/renda (valor, data, categoria, descrição, forma de pagamento) com **adição rápida** (botão + → valor, tipo, categoria em chips, salvar).
- **Recorrência:** único, fixo mensal e parcelado (N×).
- **Categorias** editáveis, com padrão criadas na primeira leitura; excluir = arquivar.
- **Visão do mês:** entradas, saídas, saldo, rosca por categoria e comparação com o mês anterior.

## Decisão de modelagem: calcular na leitura
Séries (`FinanceSeries`) guardam a **regra**; as ocorrências são calculadas (`finance/recurrence.js`). Não se geram lançamentos futuros (evita job, linhas em massa e reescrita ao editar; a projeção da Fase B usa a mesma função).
Passado protegido: **revisar** encerra a série no mês anterior e cria outra a partir do mês (`supersedesId`); **encerrar** só define `endDate`; exceção por mês (`FinanceSeriesException`) pula/ajusta um mês. Parcelas só podem ser encerradas.
Valores em **centavos (Int)**; parcelas: `floor(total/n)` com o resto na 1ª (soma exata). Dia 31 → último dia do mês.

## Arquivos
Backend: `prisma/schema.prisma` + migration `20261115000000_financas_lancamentos` (aditiva), `src/finance/*`, `src/routes/financas/{categories,entries,series,summary}.js`, testes `finance.test.js` e `routes/financas/finance.routes.test.js` (isolamento por usuário, passado preservado, parcelas).
Frontend: `pages/FinancePage.tsx`, `components/finance/*`, `api/financas.ts`, `hooks/useFinance.ts`, `lib/{money,financeKeys,financeFormat}.ts`, `main.tsx`, `navItems.tsx` (ícone Wallet).

## Pendências
- **Fase B:** fontes de renda, rendas previstas (confirmada/provável/incerta), saldo inicial e projeção 3–6 meses com dois cenários.
- **Backlog:** fatura/fechamento do cartão (hoje cartão é só forma de pagamento), orçamento por categoria, backup/Análises.
