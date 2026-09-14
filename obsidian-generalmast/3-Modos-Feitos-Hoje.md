# 3 - Modos Feitos Hoje + Funções de Data

Voltar ao [[0-Painel]]. Usado em [[1-Tela-Escolher-Modo]].

## Função para saber "que dia é hoje"
Já existem em `frontend/src/lib/dateUtils.ts` (não precisa criar novas):
- `todayISO()` → `"2026-09-14"` (formato `YYYY-MM-DD`, local).
- `todayPtBR()` → `"14/09/2026"` (formato `DD/MM/YYYY`).

## Como o app sabe o que foi feito hoje
`frontend/src/components/SlotBoard.tsx`:
```
usedTodayIds = getUsageLogs().filter(l => l.date === hoje).map(l => l.modeId)
```
`getUsageLogs()` vem de `frontend/src/lib/sessionUsageLog.ts` (logs por data `YYYY-MM-DD`).

## Banner explícito no ModePicker
O `ModePicker` **calcula o uso de hoje sozinho** (`computeTodayUsage()` a partir de
`getUsageLogs()` + `todayISO()`), agregando por modo **contagem** e **última hora**.
A prop `usedTodayIds` continua existindo como fallback.

> **Hoje (14/09/2026) você já realizou 2 modos:** Music Mode ×2 (11h), TikTok Progressivo (9h)

- Recalcula ao focar a janela / `visibilitychange` → corrige a virada de meia-noite.
- Estado vazio: "Nenhum modo realizado hoje ainda — comece por um 👇".
- Banner usa `role="status"` / `aria-live="polite"`.

## Melhorias na lista
- **Filtro "Só não feitos hoje"** (toggle) — esconde os já realizados.
- **Ordenação**: modos não feitos hoje primeiro; os feitos vão para o fim e ficam esmaecidos (`.modeCardUsed`).
- **Badge "hoje ×N"** quando o modo foi feito mais de uma vez.
- **Modo aleatório** continua preferindo modos ainda não feitos hoje.

## Testes
`frontend/src/components/ModePicker.test.tsx` (vitest + testing-library): estado vazio, resumo com contagem, filtro "só não feitos hoje".
