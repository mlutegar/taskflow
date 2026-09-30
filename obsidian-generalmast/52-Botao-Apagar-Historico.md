# 52 - Botão de Apagar Histórico (por aba)

> Voltar ao [[0-Painel]]

## Motivação
Os registros de modos vinham sendo gravados de forma incorreta, e a tela **Histórico**
era somente leitura — não havia como limpar os dados. Adicionado um botão
**🗑 Apagar histórico** em cada aba para o usuário zerar o que quiser.

## Escopo
Um botão **por aba** (não um "apagar tudo"), pois o problema estava concentrado nos
registros de modos/uso. Cada botão apaga em **dois lugares** (senão o dado volta do
servidor no próximo carregamento):
- **localStorage** (offline-first)
- **Banco** (Fastify + Prisma), filtrando por `userId`

> Nota: o `main` atual tem 3 abas — **Sessões**, **Uso** e **Check-ins**. A antiga aba
> "Modos" (mode-log) foi consolidada; hoje o registro por modo vive na aba **Uso**
> (`session_usage_logs`, cada linha tem `modeId`).

## Melhorias (v2 — "implemente tudo")
- **Modal de confirmação** (`ClearHistoryDialog` via `ModalOverlay`) no lugar do
  `window.confirm()`. Mostra um resumo do que será apagado.
- **Escopo de exclusão** no modal:
  - **Período**: pills Tudo / 7 / 30 / 90 dias → query `?days=N`.
  - **Modo** (apenas Uso/Check-ins): dropdown agrupado por categoria → query `?modeId=X`.
    Pré-seleciona o filtro de modo ativo da aba Uso.
- **Desfazer (undo)**: ao confirmar, a exclusão é **adiada 5s**; os itens no escopo são
  **ocultados otimisticamente** (`hidePending` + `entryInScope`) e um toast
  ("Histórico apagado — Desfazer") permite reverter sem tocar em nada. Só após o timeout
  o `DELETE` remoto + `clearLocal(scope)` realmente rodam.
- **Feedback de erro + robustez**: se o `DELETE` remoto falhar, **o local NÃO é limpo**
  (evita divergência com o servidor) e um toast de erro é exibido.
- **Loading**: botão "Apagar" vira "Apagando…" e desabilita durante a finalização.

## Mapa aba → endpoint → storage
| Aba       | Endpoint DELETE (+ escopo)              | Modelo Prisma       | localStorage (`clear*`)                   |
|-----------|-----------------------------------------|---------------------|-------------------------------------------|
| Sessões   | `/daily-focus/sessions?days=`           | `dailyFocusSession` | `daily_focus_history`                     |
| Uso       | `/session-usage-logs?modeId=&days=`     | `sessionUsageLog`   | `taskflow.sessionUsageLog`                |
| Check-ins | `/daily-focus/checkins?modeId=&days=`   | `dailyFocusCheckin` | `taskflow.checkinLog` + `checkinFeedback` |

Todos os DELETE fazem `deleteMany({ where: { userId, ...modeId?, ...date>=cutoff? } })`
e respondem `{ ok: true, deleted: count }`. As funções `clear*(scope)` no frontend
aplicam o mesmo filtro no `localStorage` (mantêm o que está fora do escopo).

## Fluxo no frontend (`HistoryPage.tsx`)
1. Botão 🗑 abre `ClearHistoryDialog` (`setClearDialogTab(tab)`).
2. Usuário escolhe período/modo → **Apagar** → `handleConfirmClear(scope)`.
3. Inicia janela de Desfazer: `setPendingClear({tab, scope})` + `setTimeout(finalizeClear, 5000)`
   + toast com ação Desfazer. Itens no escopo somem da lista via `hidePending`.
4. **Desfazer** → `clearTimeout` + `setPendingClear(null)` (nada foi removido).
5. **Timeout** → `finalizeClear`: `api.delete(endpoint + scopeToQuery)` →
   `clearLocal(scope)` → `invalidateQueries(["history", key])` → `refreshKey++`.
   Em erro: mantém tudo e mostra toast de erro.

Botão estilizado com `.dangerBtn` (variante vermelha de `.exportBtn`) ao lado do `⬇ CSV`.

## Arquivos
- `frontend/src/components/history/HistoryPage.tsx` — `handleClear`, `refreshKey`, prop `onClear` nas abas, botões.
- `frontend/src/components/history/HistoryPage.module.css` — `.dangerBtn`.
- `frontend/src/lib/dailyFocusHistory.ts` — `clearSessionHistory()`.
- `frontend/src/lib/sessionUsageLog.ts` — `clearUsageLog(scope)` (filtro por modo/período).
- `frontend/src/lib/checkinLog.ts` — `clearCheckinLog(scope)`.
- `backend/src/routes/dailyFocus.js` — `DELETE /sessions?days=` e `DELETE /checkins?modeId=&days=`.
- `backend/src/routes/sessionUsageLogs.js` — `DELETE /?modeId=&days=`.

## Como testar
1. Backend rodando; em cada aba, clicar **🗑 Apagar histórico** → escolher período/modo →
   **Apagar**. Os itens somem na hora; toast com **Desfazer** por 5s.
2. **Desfazer** dentro dos 5s → itens voltam e nada é apagado (nem local nem servidor).
3. Sem desfazer → após 5s a exclusão efetiva ocorre; recarregar a página confirma que
   não voltam. Conferir no banco (Prisma Studio) que só as linhas do escopo sumiram.
4. Escopo: apagar só "últimos 7 dias" ou só um modo específico e verificar que o resto
   permanece. `curl -X DELETE ".../session-usage-logs?modeId=X&days=7"` → `{ ok: true, deleted: N }`.
5. `cd frontend && npx vite build` (OK).

## Follow-ups não implementados (decisão consciente)
- **Apagar registro individual** (✕ por card): exige propagar `id` pelo merge local+remoto
  e tratar entradas só-locais sem `id` — maior risco, adiado.
- **Soft-delete (tombstone)** e **editar `modeId` de um registro**: features arquiteturais
  próprias; a correção de dados errados hoje é coberta pelo escopo por modo/período.
