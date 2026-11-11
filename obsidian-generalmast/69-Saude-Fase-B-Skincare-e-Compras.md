# 69 — Saúde, Fase B: Skincare + lista de compras (prompt 02)

Voltar ao [[0-Painel]] · anterior: [[68-Saude-Fase-A-Remedios]]

## Skincare (aba "Pele")
- Sub-abas: **Manhã**, **Noite** (check separado), **Produtos**, **Compras** (com contador).
- Cada rotina tem passos ordenados; cada passo aponta para um produto (opcional) e tem **frequência própria** (diária, seg–sex, dias específicos, a cada N dias com âncora em `startDate`). `GET /today` só devolve passos que se aplicam ao dia, e `PUT /checks` recusa (400) marcar um passo em dia que não se aplica.
- **Soft delete:** passo removido = `active=false` (não existe DELETE de passo); checks antigos ficam. `SkincareStep.productId` é `onDelete: SetNull`: apagar o produto deixa o passo com o `label`.
- Produtos: categoria (protetor, hidratante, esfoliante, limpeza, sérum, outro) e status **tenho / acabando / preciso comprar** (troca rápida na lista). Passos mostram aviso quando o produto está acabando/comprar.

## Lista de compras (`GET /saude/shopping-list`)
Gerada automaticamente (`src/health/shoppingList.js`):
- **Cuidado de pele:** produtos `need_to_buy` (primeiro) e `low`. "Comprei" = `POST /saude/skincare/products/:id/purchased` → status volta a `have`.
- **Remédios (seção separada):** ativos com `stockQty <= lowStockThreshold`, mais crítico primeiro. Sem "comprei" automático: o botão "Repor estoque" leva a Remédios → Editar (o item sai da lista quando o estoque sobe). *Pendência opcional:* endpoint de reposição rápida (`restock`).

## API (JWT em todas; zod em data/hora/enums)
`/saude/skincare`: `GET/POST /products`, `PATCH/DELETE /products/:id`, `POST /products/:id/purchased`, `GET/POST /steps`, `PATCH /steps/:id`, `PUT /steps/reorder`, `GET /today?date=`, `PUT /checks`. `/saude/shopping-list`: `GET /`.

## Migration
`20261112000000_saude_skincare` — aditiva (3 `CREATE TABLE` + índices). Deploy igual à Fase A: `./deploy-git.ps1` (o `prisma migrate deploy` roda no start; Litestream replica via WAL). Rollback = reverter o código.

## Testes
Backend: `health/skincare.test.js` (frequência de passos, lista de compras, validação) e `routes/saude/skincare.test.js` (401, isolamento, frequência no dia, check manhã/noite, soft delete preservando checks, SetNull, reordenação, lista de compras com remédios). Frontend: `lib/healthLabels.test.ts`.
