# 70 — Saúde, Fase C: Alimentação + reposição rápida de remédio (prompt 02)

Voltar ao [[0-Painel]] · anterior: [[69-Saude-Fase-B-Skincare-e-Compras]]

## Alimentação (aba "Comida") — versão simples, sem calorias
- **Água:** contador por dia (`WaterLog`, único por usuário+dia). Botão **+1 copo** e **Desfazer** (-1); nunca fica abaixo de 0. Meta visual de 8 copos (copo = 250 ml). Update otimista com rollback.
- **Refeições:** tipo (café da manhã, almoço, lanche, jantar), horário `HH:MM` e descrição; agrupadas por tipo e ordenadas por horário. Criar, editar e excluir. A hora atual pré-seleciona horário e um palpite de tipo (editável).
- **Dias:** setas ‹ › navegam entre dias (não passa de hoje), para registrar ou corrigir um dia anterior.
- API `/saude/nutrition`: `GET/POST /meals`, `PATCH/DELETE /meals/:id`, `GET /water?date=`, `POST /water/add {date, delta}`. JWT em tudo; zod valida data, hora, tipo, descrição e `delta` (inteiro, ≠ 0, ±50). Lógica pura em `src/health/nutrition.js`.

## Reposição rápida de remédio
- `POST /saude/medications/:id/restock { qty }`: `qty` numérico **> 0** (≤ 100000), soma ao estoque com `increment` atômico, escopo por `userId` (404 para outro usuário). Devolve o remédio atualizado.
- Na lista de compras (seção "Remédios") o botão **Repor** abre um campo de quantidade; **OK** soma ao estoque e o item sai da lista quando o estoque passa do limite. Substitui o antigo botão "Repor estoque" que só levava à edição.

## Migration
`20261113000000_saude_alimentacao` — aditiva (2 `CREATE TABLE` + índices). Deploy como nas fases anteriores (`./deploy-git.ps1`; `prisma migrate deploy` no start; Litestream replica via WAL). Rollback = reverter o código.

## Testes
Backend: `health/nutrition.test.js` (água, ordenação, validação), `routes/saude/nutrition.test.js` (401, validação, ordenação, isolamento, água +1/-1/clamp/dias separados) e o teste de `restock` em `routes/saude/medications.test.js`. Frontend: `lib/healthFormat.test.ts`.
