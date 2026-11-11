# 73 — Finanças, Fase B: fontes de renda, rendas previstas, saldo inicial e projeção

Prompt 03 (Fase B), continuação de [[72-Financas-Fase-A-Lancamentos]]. Painel: [[0-Painel]].

## O que entrou
- **Fontes de renda** (emprego/freelas/vendas/outro), arquivar em vez de apagar.
- **Rendas previstas** com status confirmada / provável / incerta. **"Recebi"** cria o lançamento de renda (valor e data editáveis) e vincula por `receivedEntryId`; a previsão recebida sai da lista e da projeção, então não conta duas vezes. Apagar o lançamento reabre a previsão.
- **Saldo inicial** (`FinanceSettings`) com data de referência.
- **Projeção 3–6 meses:** saldo inicial + lançamentos reais + séries (`recurrence.js`, já refletindo revisões e meses pulados) + previstas pendentes. Cenários **só confirmadas** e **+ prováveis**; **incertas nunca entram**. Gráfico de barras, alerta e vermelho nos meses negativos.

## Decisões
- `from` (mês atual) vem do cliente para evitar bug de UTC.
- Previsão atrasada cai no 1º mês projetado.
- Migration aditiva `20261116000000_financas_rendas`.

## Arquivos
Backend: `finance/projection.js` (+ teste), `routes/financas/incomes.js`, `entries.js` (reabre previsão ao apagar), validações. Frontend: `IncomesTab`, `ProjectionTab`, `api/financas.ts`, `hooks/useIncomes.ts`, `financeKeys.ts`.

## Pendências
Previsão recorrente, fatura do cartão, orçamento por categoria, Análises/backup. Ver `CLAUDE.md` §7.6.
